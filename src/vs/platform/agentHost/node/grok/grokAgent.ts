/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Spawn-per-turn `IAgent` implementation for the xAI Grok CLI.
 *
 * Behaviour at a glance
 * ─────────────────────
 * • `createSession` — allocates an in-memory placeholder (provisional) until
 *   the first `sendMessage` writes an on-disk grok session.
 * • `sendMessage` — spawns `grok -p <prompt> --output-format streaming-json`
 *   (first turn) or `grok -r <id> -p <prompt> --output-format streaming-json`
 *   (resume). Parses stdout as NDJSON and maps each record to a protocol
 *   `SessionAction` dispatched via `onDidSessionProgress`.
 * • `abortSession` — sends `SIGTERM` to the in-flight child.
 * • `setPendingMessages` (steering, DN-5) — `SIGTERM` + immediately spawns a
 *   resume turn with the steering message so the response stream continues
 *   without a visible gap.
 * • `listSessions` — walks `~/.grok/sessions/<encodeURIComponent(cwd)>/`
 *   and parses every `summary.json` found.
 *
 * Layer isolation note
 * ────────────────────
 * This file lives in `src/vs/platform/` and CANNOT import from
 * `extensions/copilot/` (the extension layer). All grok-specific logic that
 * would normally live in the common extension layer (flag constants, NDJSON
 * parsing, session-directory layout, steering signal) is therefore inlined
 * here as private constants / helpers.  Keep them in sync with
 * `extensions/copilot/src/extension/chatSessions/grok/common/` when either
 * side changes.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { Emitter, type Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { type IObservable, observableValue } from '../../../../base/common/observable.js';
import { join } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ILogService } from '../../../log/common/log.js';
import {
	AgentSession,
	type AgentProvider,
	type AgentSignal,
	type IAgent,
	type IAgentCreateSessionConfig,
	type IAgentCreateSessionResult,
	type IAgentDescriptor,
	type IAgentMaterializeSessionEvent,
	type IAgentModelInfo,
	type IAgentResolveSessionConfigParams,
	type IAgentSessionConfigCompletionsParams,
	type IAgentSessionMetadata,
} from '../../common/agentService.js';
import type { ISyncedCustomization } from '../../common/agentPluginManager.js';
import { ActionType } from '../../common/state/sessionActions.js';
import type { SessionAction } from '../../common/state/sessionActions.js';
import {
	MessageKind,
	ResponsePartKind,
	SessionInputResponseKind,
	ToolCallConfirmationReason,
	ToolCallStatus,
	ToolResultContentType,
} from '../../common/state/sessionState.js';
import type {
	ClientPluginCustomization,
	MessageAttachment,
	ModelSelection,
	PendingMessage,
	SessionInputAnswer,
	ToolCallPendingConfirmationState,
	ToolCallResult,
	Turn,
} from '../../common/state/sessionState.js';
import type { ProtectedResourceMetadata, ToolDefinition } from '../../common/state/protocol/state.js';
import type { ResolveSessionConfigResult, SessionConfigCompletionsResult } from '../../common/state/protocol/commands.js';

// ---- Inlined grok CLI constants (must stay in sync with grok common layer) --

/** `grok -p <prompt>` flag — headless single-turn mode. */
const GROK_HEADLESS_FLAG = '-p';

/** `--output-format streaming-json` — NDJSON streaming output. */
const GROK_OUTPUT_FORMAT_FLAG = '--output-format';

/** Streaming NDJSON output format value. */
const GROK_STREAMING_OUTPUT_FORMAT = 'streaming-json';

/** `grok -r <sessionId>` flag — resume an existing grok session. */
const GROK_RESUME_FLAG = '-r';

/**
 * Signal used to abort in-flight grok child for emulated steering (DN-5).
 * Matches `GROK_STEERING_ABORT_SIGNAL` in `grokSteering.ts`.
 */
const GROK_STEERING_ABORT_SIGNAL = 'SIGTERM';

/** Stable provider id — matches `GROK_PROVIDER_ID` in `grokProviderDescriptor.ts`. */
const GROK_PROVIDER_ID: AgentProvider = 'grok';

// ---- Internal session state -------------------------------------------------

interface IGrokSession {
	readonly sessionId: string;
	readonly sessionUri: URI;
	readonly workingDirectory: URI | undefined;
	/**
	 * The UUID of the on-disk grok session directory under
	 * `~/.grok/sessions/<cwd-encoded>/`. Undefined until the first turn
	 * completes and the directory is discovered.
	 */
	grokSessionId: string | undefined;
	/** Protocol turn id for the turn that is currently in flight. */
	currentTurnId: string | undefined;
	/** The currently-running grok child process (undefined when idle). */
	currentProcess: ChildProcess | undefined;
	/** User-selected model (passed through but grok manages its own model selection). */
	model: ModelSelection | undefined;
	disposed: boolean;
	/**
	 * Response part id for the current turn's markdown text stream.
	 * A new part is created on the first text chunk and reused for subsequent
	 * deltas in the same turn.
	 */
	currentMarkdownPartId: string | undefined;
	/**
	 * Response part id for the current turn's reasoning / thinking stream.
	 */
	currentReasoningPartId: string | undefined;
}

// ---- Grok summary.json shape ------------------------------------------------

interface IGrokSummaryInfo {
	readonly id: string;
	readonly cwd?: string;
}

interface IGrokSummary {
	readonly info?: IGrokSummaryInfo;
	readonly generated_title?: string;
	readonly session_summary?: string;
	readonly created_at?: string;
	readonly updated_at?: string;
	readonly last_active_at?: string;
}

// ---- GrokAgent --------------------------------------------------------------

/**
 * Spawn-per-turn `IAgent` for the xAI Grok CLI.
 *
 * Registered in the agent host by instantiation service:
 * ```ts
 * agentService.registerProvider(instantiationService.createInstance(GrokAgent));
 * ```
 */
export class GrokAgent extends Disposable implements IAgent {

	// #region Identity

	readonly id: AgentProvider = GROK_PROVIDER_ID;

	// #endregion

	// #region Events

	private readonly _onDidSessionProgress = this._register(new Emitter<AgentSignal>());
	readonly onDidSessionProgress: Event<AgentSignal> = this._onDidSessionProgress.event;

	private readonly _onDidMaterializeSession = this._register(new Emitter<IAgentMaterializeSessionEvent>());
	readonly onDidMaterializeSession: Event<IAgentMaterializeSessionEvent> = this._onDidMaterializeSession.event;

	// #endregion

	// #region Models

	private readonly _models = observableValue<readonly IAgentModelInfo[]>(this, []);
	readonly models: IObservable<readonly IAgentModelInfo[]> = this._models;

	// #endregion

	// #region Session bookkeeping

	private readonly _sessions = new Map<string, IGrokSession>();

	// #endregion

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	// #region Descriptor / auth

	getDescriptor(): IAgentDescriptor {
		return {
			provider: GROK_PROVIDER_ID,
			displayName: localize('grok.agent.displayName', "Grok"),
			description: localize('grok.agent.description', "xAI Grok CLI agent (spawn-per-turn)"),
		};
	}

	getProtectedResources(): ProtectedResourceMetadata[] {
		// Grok manages its own credentials (GROK_API_KEY / xAI API key). The
		// agent host does not mediate auth on behalf of grok.
		return [];
	}

	async authenticate(_resource: string, _token: string): Promise<boolean> {
		return false;
	}

	// #endregion

	// #region Session lifecycle

	async createSession(config?: IAgentCreateSessionConfig): Promise<IAgentCreateSessionResult> {
		if (config?.fork) {
			throw new Error('[GrokAgent] Session forking is not supported');
		}

		const sessionId = config?.session ? AgentSession.id(config.session) : generateUuid();
		const sessionUri = config?.session ?? AgentSession.uri(this.id, sessionId);

		const existing = this._sessions.get(sessionId);
		if (existing) {
			if (config?.model) {
				existing.model = config.model;
			}
			return {
				session: sessionUri,
				workingDirectory: existing.workingDirectory ?? config?.workingDirectory,
				provisional: existing.grokSessionId === undefined,
			};
		}

		const session: IGrokSession = {
			sessionId,
			sessionUri,
			workingDirectory: config?.workingDirectory,
			grokSessionId: undefined,
			currentTurnId: undefined,
			currentProcess: undefined,
			model: config?.model,
			disposed: false,
			currentMarkdownPartId: undefined,
			currentReasoningPartId: undefined,
		};
		this._sessions.set(sessionId, session);

		return {
			session: sessionUri,
			workingDirectory: config?.workingDirectory,
			provisional: true,
		};
	}

	async disposeSession(sessionUri: URI): Promise<void> {
		const session = this._getSession(sessionUri);
		if (!session) {
			return;
		}
		session.disposed = true;
		this._killSession(session, 'SIGKILL');
		this._sessions.delete(session.sessionId);
	}

	async abortSession(sessionUri: URI): Promise<void> {
		const session = this._getSession(sessionUri);
		if (!session?.currentProcess) {
			return;
		}
		this._logService.info(`[GrokAgent:${session.sessionId}] aborting in-flight turn`);
		this._killSession(session, GROK_STEERING_ABORT_SIGNAL);
	}

	async changeModel(sessionUri: URI, model: ModelSelection): Promise<void> {
		const session = this._getSession(sessionUri);
		if (session) {
			session.model = model;
		}
	}

	// #endregion

	// #region Message dispatch

	async sendMessage(
		sessionUri: URI,
		prompt: string,
		_attachments?: readonly MessageAttachment[],
		turnId?: string,
	): Promise<void> {
		const session = this._getSession(sessionUri);
		if (!session) {
			this._logService.error(`[GrokAgent] sendMessage: unknown session ${sessionUri.toString()}`);
			return;
		}

		const effectiveTurnId = turnId ?? generateUuid();
		session.currentTurnId = effectiveTurnId;
		session.currentMarkdownPartId = undefined;
		session.currentReasoningPartId = undefined;

		// Turn started — announce the user message.
		this._fire(sessionUri, {
			type: ActionType.SessionTurnStarted,
			turnId: effectiveTurnId,
			message: {
				text: prompt,
				origin: { kind: MessageKind.User },
			},
		});

		// Build the grok CLI arg list. On first turn: `-p <prompt>`. On
		// subsequent turns: `-r <sessionId> -p <prompt>` (resume mode).
		const spawnArgs: string[] = session.grokSessionId
			? [GROK_RESUME_FLAG, session.grokSessionId, GROK_HEADLESS_FLAG, prompt, GROK_OUTPUT_FORMAT_FLAG, GROK_STREAMING_OUTPUT_FORMAT]
			: [GROK_HEADLESS_FLAG, prompt, GROK_OUTPUT_FORMAT_FLAG, GROK_STREAMING_OUTPUT_FORMAT];

		this._logService.info(`[GrokAgent:${session.sessionId}] spawn: grok ${spawnArgs.join(' ')}`);

		const child = spawn('grok', spawnArgs, {
			stdio: ['ignore', 'pipe', 'pipe'],
			cwd: session.workingDirectory?.fsPath,
		});
		session.currentProcess = child;

		// Pipe stderr to the log (grok emits informational diagnostics there).
		child.stderr?.setEncoding('utf8');
		child.stderr?.on('data', (chunk: string) => {
			for (const line of String(chunk).split('\n')) {
				if (line.trim()) {
					this._logService.trace(`[GrokAgent:${session.sessionId}:stderr] ${line}`);
				}
			}
		});

		// Read stdout as NDJSON line by line.
		let lineBuf = '';
		child.stdout?.setEncoding('utf8');
		child.stdout?.on('data', (chunk: string) => {
			lineBuf += String(chunk);
			const lines = lineBuf.split('\n');
			lineBuf = lines.pop() ?? '';
			for (const line of lines) {
				this._processNdjsonLine(session, effectiveTurnId, line);
			}
		});

		await new Promise<void>(resolve => {
			child.once('error', err => {
				session.currentProcess = undefined;
				const msg = err.message;
				this._logService.error(`[GrokAgent:${session.sessionId}] spawn error: ${msg}`);
				this._fire(sessionUri, {
					type: ActionType.SessionError,
					turnId: effectiveTurnId,
					error: { errorType: 'GrokSpawnError', message: msg },
				});
				this._fire(sessionUri, { type: ActionType.SessionTurnComplete, turnId: effectiveTurnId });
				session.currentTurnId = undefined;
				resolve();
			});

			child.once('close', (code, signal) => {
				session.currentProcess = undefined;

				// Flush any partial line left in the buffer.
				if (lineBuf.trim()) {
					this._processNdjsonLine(session, effectiveTurnId, lineBuf);
					lineBuf = '';
				}

				if (signal === GROK_STEERING_ABORT_SIGNAL) {
					// The in-flight turn was aborted for steering; the steering
					// handler will immediately start a resume spawn. Don't emit
					// TurnComplete here — the resume turn's events close the turn.
					resolve();
					return;
				}

				if (code !== 0 && signal === null) {
					const msg = localize('grok.exitError', "grok exited with code {0}", String(code));
					this._logService.warn(`[GrokAgent:${session.sessionId}] ${msg}`);
					this._fire(sessionUri, {
						type: ActionType.SessionError,
						turnId: effectiveTurnId,
						error: { errorType: 'GrokExitError', message: msg },
					});
				}

				this._fire(sessionUri, { type: ActionType.SessionTurnComplete, turnId: effectiveTurnId });
				session.currentTurnId = undefined;
				resolve();
			});
		});

		// After the first turn, try to discover the on-disk grok session UUID so
		// that subsequent turns can use resume mode (`-r <id>`).
		if (!session.grokSessionId && session.workingDirectory) {
			const discovered = await this._discoverNewestGrokSessionId(session.workingDirectory);
			if (discovered) {
				session.grokSessionId = discovered;
				this._logService.info(`[GrokAgent:${session.sessionId}] discovered grok session id: ${discovered}`);
				this._onDidMaterializeSession.fire({
					session: sessionUri,
					workingDirectory: session.workingDirectory,
					project: undefined,
				});
			}
		}
	}

	setPendingMessages(
		sessionUri: URI,
		steeringMessage: PendingMessage | undefined,
		_queuedMessages: readonly PendingMessage[],
	): void {
		if (!steeringMessage) {
			return;
		}
		const session = this._getSession(sessionUri);
		if (!session || !session.grokSessionId) {
			// No on-disk grok session yet — the framework will retry this as a
			// regular sendMessage once the session materialises.
			return;
		}
		const steeringText = steeringMessage.message.text;
		if (!steeringText) {
			return;
		}

		// Emulated steering (DN-5): abort the in-flight child, then immediately
		// spawn a resume turn with the steering message. The SIGTERM close
		// handler suppresses TurnComplete so the turn stays "open" and the
		// resume turn's events land on it seamlessly.
		if (session.currentProcess) {
			this._logService.info(`[GrokAgent:${session.sessionId}] steering: aborting in-flight turn`);
			this._killSession(session, GROK_STEERING_ABORT_SIGNAL);
		}

		// Keep the existing turnId (the resume turn continues the same turn).
		void this.sendMessage(sessionUri, steeringText, undefined, session.currentTurnId);
	}

	// #endregion

	// #region Configuration / tools (no-ops — grok manages its own config)

	resolveSessionConfig(_params: IAgentResolveSessionConfigParams): Promise<ResolveSessionConfigResult> {
		return Promise.resolve({ values: {}, schema: { type: 'object', properties: {} } });
	}

	sessionConfigCompletions(_params: IAgentSessionConfigCompletionsParams): Promise<SessionConfigCompletionsResult> {
		return Promise.resolve({ items: [] });
	}

	setClientTools(_session: URI, _clientId: string | undefined, _tools: ToolDefinition[]): void {
		// Grok manages its own tool registry internally; client tool definitions
		// are not forwarded to the grok process.
	}

	onClientToolCallComplete(_session: URI, _toolCallId: string, _result: ToolCallResult): void {
		// Not applicable — grok executes all tools inside its own process.
	}

	setClientCustomizations(_session: URI, _clientId: string, _customizations: ClientPluginCustomization[]): Promise<ISyncedCustomization[]> {
		return Promise.resolve([]);
	}

	setCustomizationEnabled(_id: string, _enabled: boolean): void {
		// Not applicable.
	}

	respondToPermissionRequest(_requestId: string, _approved: boolean): void {
		// Grok manages permission prompts inside its own process via its terminal
		// UI. The agent host cannot inject decisions into a running grok child.
		// A future enhancement could use a named pipe or grok's plugin API.
	}

	respondToUserInputRequest(
		_requestId: string,
		_response: SessionInputResponseKind,
		_answers?: Record<string, SessionInputAnswer>,
	): void {
		// Not implemented.
	}

	// #endregion

	// #region Session messages / listing

	async getSessionMessages(_session: URI): Promise<readonly Turn[]> {
		// Replay from chat_history.jsonl is a future work item (AC-P3.3).
		return [];
	}

	async listSessions(): Promise<IAgentSessionMetadata[]> {
		return this._listAllGrokSessions();
	}

	async getSessionMetadata(session: URI): Promise<IAgentSessionMetadata | undefined> {
		const sessionId = AgentSession.id(session);
		const existing = this._sessions.get(sessionId);
		if (existing?.grokSessionId) {
			const all = await this._listAllGrokSessions();
			return all.find(m => AgentSession.id(m.session) === existing.grokSessionId);
		}
		const all = await this._listAllGrokSessions();
		return all.find(m => AgentSession.id(m.session) === sessionId)
			?? all.find(m => m.session.toString() === session.toString());
	}

	// #endregion

	// #region Shutdown / dispose

	async shutdown(): Promise<void> {
		for (const session of this._sessions.values()) {
			this._killSession(session, 'SIGKILL');
		}
		this._sessions.clear();
	}

	override dispose(): void {
		for (const session of this._sessions.values()) {
			this._killSession(session, 'SIGKILL');
		}
		this._sessions.clear();
		super.dispose();
	}

	// #endregion

	// #region NDJSON event mapping

	/**
	 * Parse a single NDJSON line from the grok stdout stream and map it to
	 * protocol `SessionAction`s.
	 *
	 * Grok event types handled:
	 * - `assistant` — markdown response text
	 * - `reasoning` — thinking / chain-of-thought text
	 * - `backend_tool_call` / `tool_started` — tool call start
	 * - `tool_result` / `tool_completed` — tool call complete
	 * - `permission_requested` — emits a `pending_confirmation` signal
	 *
	 * All other record types (turn_started, turn_ended, loop_started,
	 * first_token, phase_changed, permission_resolved, mcp_*, …) are
	 * lifecycle bookkeeping events that the protocol layer does not need.
	 */
	private _processNdjsonLine(session: IGrokSession, turnId: string, rawLine: string): void {
		const line = rawLine.trim();
		if (!line) {
			return;
		}
		let record: Record<string, unknown>;
		try {
			record = JSON.parse(line) as Record<string, unknown>;
		} catch {
			// Ignore non-JSON lines (e.g. grok startup diagnostics).
			return;
		}
		const type = typeof record['type'] === 'string' ? record['type'] : undefined;
		if (!type) {
			return;
		}

		switch (type) {
			case 'assistant':
				this._handleTextRecord(session, turnId, record, /* isReasoning */ false);
				break;
			case 'reasoning':
				this._handleTextRecord(session, turnId, record, /* isReasoning */ true);
				break;
			case 'backend_tool_call':
			case 'tool_started':
				this._handleToolStart(session, turnId, record);
				break;
			case 'tool_result':
			case 'tool_completed':
				this._handleToolComplete(session, turnId, record);
				break;
			case 'permission_requested':
				this._handlePermissionRequested(session, turnId, record);
				break;
			default:
				// Lifecycle / bookkeeping events are intentionally dropped here.
				break;
		}
	}

	private _handleTextRecord(
		session: IGrokSession,
		turnId: string,
		record: Record<string, unknown>,
		isReasoning: boolean,
	): void {
		const text = _extractText(record);
		if (!text) {
			return;
		}

		if (isReasoning) {
			if (!session.currentReasoningPartId) {
				session.currentReasoningPartId = generateUuid();
				this._fire(session.sessionUri, {
					type: ActionType.SessionResponsePart,
					turnId,
					part: {
						kind: ResponsePartKind.Reasoning,
						id: session.currentReasoningPartId,
						content: '',
					},
				});
			}
			this._fire(session.sessionUri, {
				type: ActionType.SessionDelta,
				turnId,
				partId: session.currentReasoningPartId,
				content: text,
			});
		} else {
			if (!session.currentMarkdownPartId) {
				session.currentMarkdownPartId = generateUuid();
				this._fire(session.sessionUri, {
					type: ActionType.SessionResponsePart,
					turnId,
					part: {
						kind: ResponsePartKind.Markdown,
						id: session.currentMarkdownPartId,
						content: '',
					},
				});
			}
			this._fire(session.sessionUri, {
				type: ActionType.SessionDelta,
				turnId,
				partId: session.currentMarkdownPartId,
				content: text,
			});
		}
	}

	private _handleToolStart(
		session: IGrokSession,
		turnId: string,
		record: Record<string, unknown>,
	): void {
		const toolCallId = _extractToolCallId(record);
		if (!toolCallId) {
			return;
		}
		const toolName = typeof record['name'] === 'string' ? record['name'] : '(grok-tool)';
		this._fire(session.sessionUri, {
			type: ActionType.SessionToolCallStart,
			turnId,
			toolCallId,
			toolName,
			displayName: toolName,
		});

		// For non-shell tools auto-approve immediately so the tool transitions
		// directly to running state without a confirmation roundtrip.
		const isShell = /\b(shell|bash|exec|execute|command|terminal|run)\b/i.test(toolName);
		if (isShell) {
			// Emit pending_confirmation for shell tools so the host's permission
			// manager can apply the session's permission mode (DN-4).
			const state: ToolCallPendingConfirmationState = {
				status: ToolCallStatus.PendingConfirmation,
				toolCallId,
				toolName,
				displayName: toolName,
				invocationMessage: toolName,
			};
			this._onDidSessionProgress.fire({
				kind: 'pending_confirmation',
				session: session.sessionUri,
				state,
				permissionKind: 'shell',
			});
		} else {
			this._fire(session.sessionUri, {
				type: ActionType.SessionToolCallReady,
				turnId,
				toolCallId,
				invocationMessage: toolName,
				confirmed: ToolCallConfirmationReason.NotNeeded,
			});
		}
	}

	private _handleToolComplete(
		session: IGrokSession,
		turnId: string,
		record: Record<string, unknown>,
	): void {
		const toolCallId = _extractToolCallId(record);
		if (!toolCallId) {
			return;
		}
		const isError = record['is_error'] === true;
		const outputText = typeof record['output'] === 'string' ? record['output'] : '';
		const result: ToolCallResult = {
			success: !isError,
			pastTenseMessage: isError
				? localize('grok.toolFailed', "Tool failed")
				: localize('grok.toolCompleted', "Tool completed"),
			content: outputText
				? [{ type: ToolResultContentType.Text, text: outputText }]
				: undefined,
		};
		this._fire(session.sessionUri, {
			type: ActionType.SessionToolCallComplete,
			turnId,
			toolCallId,
			result,
		});
	}

	private _handlePermissionRequested(
		session: IGrokSession,
		turnId: string,
		record: Record<string, unknown>,
	): void {
		const toolCallId = _extractToolCallId(record) ?? generateUuid();
		const description = typeof record['description'] === 'string'
			? record['description']
			: localize('grok.shellPermission', "grok is requesting shell access");
		const toolName = typeof record['tool_name'] === 'string' ? record['tool_name'] : 'shell';

		const state: ToolCallPendingConfirmationState = {
			status: ToolCallStatus.PendingConfirmation,
			toolCallId,
			toolName,
			displayName: toolName,
			invocationMessage: description,
		};
		this._onDidSessionProgress.fire({
			kind: 'pending_confirmation',
			session: session.sessionUri,
			state,
			permissionKind: 'shell',
		});

		// Note: grok blocks on its own terminal UI waiting for the user to
		// approve. The agent host fires the approval decision via
		// `respondToPermissionRequest`, but currently there is no way to
		// inject that decision back into the running grok process. This is
		// noted as a future enhancement (see respondToPermissionRequest).
		void turnId; // referenced to satisfy the linter
	}

	// #endregion

	// #region Session listing helpers

	private async _listAllGrokSessions(): Promise<IAgentSessionMetadata[]> {
		const sessionsDir = join(os.homedir(), '.grok', 'sessions');
		const results: IAgentSessionMetadata[] = [];

		let cwdDirs: string[];
		try {
			cwdDirs = await fs.promises.readdir(sessionsDir);
		} catch {
			return [];
		}

		for (const cwdDir of cwdDirs) {
			// Skip non-directory bookkeeping files (e.g. `session_search.sqlite`).
			if (cwdDir.includes('.')) {
				continue;
			}
			const cwdPath = join(sessionsDir, cwdDir);
			let entries: fs.Dirent[];
			try {
				entries = await fs.promises.readdir(cwdPath, { withFileTypes: true });
			} catch {
				continue;
			}

			for (const entry of entries) {
				if (!entry.isDirectory()) {
					continue;
				}
				const summaryPath = join(cwdPath, entry.name, 'summary.json');
				try {
					const raw = await fs.promises.readFile(summaryPath, 'utf8');
					const json = JSON.parse(raw) as IGrokSummary;
					const id = json.info?.id;
					if (!id) {
						continue;
					}
					const startTime = json.created_at ? Date.parse(json.created_at) : 0;
					const modifiedTime = json.last_active_at
						? Date.parse(json.last_active_at)
						: json.updated_at
							? Date.parse(json.updated_at)
							: startTime;
					const summary = json.generated_title ?? json.session_summary;
					const cwd = json.info?.cwd;
					results.push({
						session: AgentSession.uri(this.id, id),
						startTime,
						modifiedTime,
						summary,
						workingDirectory: cwd ? URI.file(cwd) : undefined,
					});
				} catch {
					continue;
				}
			}
		}

		// Sort most-recent first (UUID v7 dir names are lexically chronological,
		// but we sort by modifiedTime for sessions across multiple cwds).
		results.sort((a, b) => b.modifiedTime - a.modifiedTime);
		return results;
	}

	/**
	 * After the first `sendMessage` completes, scan the on-disk grok session
	 * tree to discover the UUID of the session that was just created. The
	 * newest UUID v7 directory under the encoded cwd segment is the one grok
	 * just wrote.
	 */
	private async _discoverNewestGrokSessionId(workingDirectory: URI): Promise<string | undefined> {
		const sessionsDir = join(os.homedir(), '.grok', 'sessions');
		const cwdSegment = encodeURIComponent(workingDirectory.fsPath);
		const cwdPath = join(sessionsDir, cwdSegment);

		let dirs: string[];
		try {
			dirs = await fs.promises.readdir(cwdPath);
		} catch {
			return undefined;
		}

		// UUID v7 directories sort lexically ≈ chronologically — the newest is last.
		const sessionDirs = dirs.filter(d => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d)).sort();
		const newest = sessionDirs[sessionDirs.length - 1];
		if (!newest) {
			return undefined;
		}

		const summaryPath = join(cwdPath, newest, 'summary.json');
		try {
			const raw = await fs.promises.readFile(summaryPath, 'utf8');
			const json = JSON.parse(raw) as IGrokSummary;
			return json.info?.id;
		} catch {
			return undefined;
		}
	}

	// #endregion

	// #region Helpers

	private _fire(sessionUri: URI, action: SessionAction): void {
		this._onDidSessionProgress.fire({ kind: 'action', session: sessionUri, action });
	}

	private _getSession(sessionUri: URI): IGrokSession | undefined {
		return this._sessions.get(AgentSession.id(sessionUri));
	}

	private _killSession(session: IGrokSession, signal: NodeJS.Signals): void {
		if (session.currentProcess) {
			try {
				session.currentProcess.kill(signal);
			} catch {
				// Process may have already exited.
			}
		}
	}

	// #endregion
}

// ---- Private NDJSON helpers (module-scoped, not exported) -------------------

/**
 * Extract plain text from a grok stream record. Grok can represent text as:
 * - `record.text: string`
 * - `record.content: string`
 * - `record.content: Array<{ type: 'text'; text: string }>`
 */
function _extractText(record: Record<string, unknown>): string | undefined {
	if (typeof record['text'] === 'string' && record['text']) {
		return record['text'];
	}
	const content = record['content'];
	if (typeof content === 'string' && content) {
		return content;
	}
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const block of content) {
			if (block && typeof block === 'object') {
				const b = block as Record<string, unknown>;
				if (b['type'] === 'text' && typeof b['text'] === 'string' && b['text']) {
					parts.push(b['text'] as string);
				}
			}
		}
		return parts.length > 0 ? parts.join('') : undefined;
	}
	return undefined;
}

/**
 * Extract the tool call id from a grok stream record.
 * Grok uses `id` or `tool_call_id` depending on the record type.
 */
function _extractToolCallId(record: Record<string, unknown>): string | undefined {
	if (typeof record['id'] === 'string' && record['id']) {
		return record['id'];
	}
	if (typeof record['tool_call_id'] === 'string' && record['tool_call_id']) {
		return record['tool_call_id'];
	}
	return undefined;
}
