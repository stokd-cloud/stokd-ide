/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { dirname, join } from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { replayThreadToTurns } from '../../../node/codex/codexReplayMapper.js';
import { ResponsePartKind, ToolCallStatus, ToolResultContentType, TurnState, type ToolCallCompletedState, type ToolCallResponsePart } from '../../../common/state/sessionState.js';
import type { ServerNotificationMethod } from '../../../node/codex/codexAppServerClient.js';
import type { Thread } from '../../../node/codex/protocol/generated/v2/Thread.js';
import type { ThreadItem } from '../../../node/codex/protocol/generated/v2/ThreadItem.js';

/**
 * Codex pinned-version contract test (AC-P2.4).
 *
 * Codex is integrated as a *pinned-version* external CLI: we vendor the
 * `codex app-server` JSON-RPC protocol types — regenerated from one pinned
 * codex binary (`npm run codex:gen-protocol`) — and we parse codex's on-disk
 * session rollouts (`~/.codex/sessions/*.jsonl`, surfaced to us through the
 * `thread/read` response). The streamed app-server `ServerNotification`s are
 * the same event vocabulary `codex exec --json` emits.
 *
 * Nothing here spawns the codex binary — that is the (env-gated) job of
 * `protocol/codexRealSdk.integrationTest.ts`. This is a fast, hermetic smoke
 * test that *freezes* the two external contracts our integration depends on,
 * so a silent codex upgrade fails CI instead of silently breaking live
 * streaming / session replay:
 *
 *   1. **`exec --json` / app-server EVENT SCHEMA** — the `ServerNotification`
 *      method vocabulary (the streamed events) plus the `ThreadItem` type
 *      vocabulary (the items those events carry and that `thread/read`
 *      returns).
 *   2. **`~/.codex/sessions` ROLLOUT FORMAT** — the `Thread` / `Turn` /
 *      `ThreadItem` shape consumed by {@link replayThreadToTurns} when a
 *      persisted session is restored.
 *
 * It also asserts the vendored protocol types are coherent with the single
 * pinned codex version recorded in `build/codex/codex-version.txt`.
 *
 * ── On failure ──────────────────────────────────────────────────────────
 * A codex upgrade (or an out-of-band edit) changed a pinned contract. The
 * intended remediation, in one change:
 *   1. `npm run codex:gen-protocol` to regenerate the vendored types,
 *   2. reconcile the live mapper / replay code in `node/codex/`,
 *   3. update `build/codex/codex-version.txt` and the frozen expectations
 *      below to match.
 * Do **not** weaken these assertions to make CI pass — that defeats the
 * drift gate.
 */

// Repo-relative locations of the pinned-contract source-of-truth files.
const CODEX_VERSION_FILE = join('build', 'codex', 'codex-version.txt');
const GENERATED_DIR = join('src', 'vs', 'platform', 'agentHost', 'node', 'codex', 'protocol', 'generated');
const SERVER_NOTIFICATION_FILE = join(GENERATED_DIR, 'ServerNotification.ts');
const THREAD_ITEM_FILE = join(GENERATED_DIR, 'v2', 'ThreadItem.ts');

/**
 * The complete `codex exec --json` / app-server `ServerNotification` method
 * vocabulary, frozen at the pinned codex version. Mirrors the `"method": …`
 * discriminants of `ServerNotification` in the vendored protocol. Any
 * addition/removal/rename on a codex upgrade trips
 * `event schema: ServerNotification method vocabulary is frozen`.
 */
const EXPECTED_SERVER_NOTIFICATION_METHODS: readonly string[] = [
	'account/login/completed',
	'account/rateLimits/updated',
	'account/updated',
	'app/list/updated',
	'command/exec/outputDelta',
	'configWarning',
	'deprecationNotice',
	'error',
	'externalAgentConfig/import/completed',
	'fs/changed',
	'fuzzyFileSearch/sessionCompleted',
	'fuzzyFileSearch/sessionUpdated',
	'guardianWarning',
	'hook/completed',
	'hook/started',
	'item/agentMessage/delta',
	'item/autoApprovalReview/completed',
	'item/autoApprovalReview/started',
	'item/commandExecution/outputDelta',
	'item/commandExecution/terminalInteraction',
	'item/completed',
	'item/fileChange/outputDelta',
	'item/fileChange/patchUpdated',
	'item/mcpToolCall/progress',
	'item/plan/delta',
	'item/reasoning/summaryPartAdded',
	'item/reasoning/summaryTextDelta',
	'item/reasoning/textDelta',
	'item/started',
	'mcpServer/oauthLogin/completed',
	'mcpServer/startupStatus/updated',
	'model/rerouted',
	'model/verification',
	'process/exited',
	'process/outputDelta',
	'rawResponseItem/completed',
	'remoteControl/status/changed',
	'serverRequest/resolved',
	'skills/changed',
	'thread/archived',
	'thread/closed',
	'thread/compacted',
	'thread/goal/cleared',
	'thread/goal/updated',
	'thread/name/updated',
	'thread/realtime/closed',
	'thread/realtime/error',
	'thread/realtime/itemAdded',
	'thread/realtime/outputAudio/delta',
	'thread/realtime/sdp',
	'thread/realtime/started',
	'thread/realtime/transcript/delta',
	'thread/realtime/transcript/done',
	'thread/settings/updated',
	'thread/started',
	'thread/status/changed',
	'thread/tokenUsage/updated',
	'thread/unarchived',
	'turn/completed',
	'turn/diff/updated',
	'turn/plan/updated',
	'turn/started',
	'warning',
	'windows/worldWritableWarning',
	'windowsSandbox/setupCompleted',
];

/**
 * The subset of streamed events our live mapper / agent actually consume
 * (`codexMapAppServerEvents.ts`, `codexAgent.ts`). `satisfies readonly
 * ServerNotificationMethod[]` pins this at the *type* level — if codex renames
 * one of these methods the vendored `ServerNotification` union changes and this
 * file stops compiling, independent of the runtime assertion below.
 */
const SUBSCRIBED_NOTIFICATION_METHODS = [
	'thread/started',
	'thread/status/changed',
	'thread/settings/updated',
	'thread/goal/updated',
	'thread/goal/cleared',
	'thread/tokenUsage/updated',
	'turn/started',
	'turn/completed',
	'item/started',
	'item/completed',
	'item/agentMessage/delta',
	'item/reasoning/summaryPartAdded',
	'item/reasoning/summaryTextDelta',
	'item/reasoning/textDelta',
	'item/commandExecution/outputDelta',
	'item/fileChange/outputDelta',
	'item/fileChange/patchUpdated',
	'item/mcpToolCall/progress',
	'account/updated',
	'account/rateLimits/updated',
] as const satisfies readonly ServerNotificationMethod[];

/**
 * The complete `ThreadItem` type vocabulary, frozen at the pinned codex
 * version. Mirrors the `"type": …` discriminants of `ThreadItem`.
 */
const EXPECTED_THREAD_ITEM_TYPES: readonly string[] = [
	'agentMessage',
	'collabAgentToolCall',
	'commandExecution',
	'contextCompaction',
	'dynamicToolCall',
	'enteredReviewMode',
	'exitedReviewMode',
	'fileChange',
	'hookPrompt',
	'imageGeneration',
	'imageView',
	'mcpToolCall',
	'plan',
	'reasoning',
	'userMessage',
	'webSearch',
];

/**
 * The `ThreadItem` kinds our replay/format code recognizes
 * (`codexThreadItemFormatter.ts` + the `userMessage` opener in
 * `codexReplayMapper.ts`). `satisfies readonly ThreadItem['type'][]` pins them
 * at the type level — a codex rename breaks compilation here.
 */
const HANDLED_THREAD_ITEM_TYPES = [
	'userMessage',
	'agentMessage',
	'reasoning',
	'commandExecution',
	'fileChange',
	'mcpToolCall',
	'dynamicToolCall',
	'webSearch',
] as const satisfies readonly ThreadItem['type'][];

function repoRoot(): string {
	// `test-node` runs mocha from the repo root, so cwd is the canonical
	// anchor; walk up as a safety net for other launch dirs.
	let dir = process.cwd();
	for (let i = 0; i < 16; i++) {
		if (fs.existsSync(join(dir, CODEX_VERSION_FILE))) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}
	throw new Error(`codex contract test: cannot locate repo root; '${CODEX_VERSION_FILE}' not found at or above cwd '${process.cwd()}'`);
}

function readRepoFile(root: string, rel: string): string {
	const abs = join(root, rel);
	assert.ok(fs.existsSync(abs), `expected pinned-contract file to exist: ${rel}`);
	return fs.readFileSync(abs, 'utf8');
}

function listGeneratedTsFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...listGeneratedTsFiles(full));
		} else if (entry.isFile() && entry.name.endsWith('.ts')) {
			out.push(full);
		}
	}
	return out;
}

/** Unique discriminant values for `"<field>": "<value>"` occurrences in TS source. */
function discriminants(source: string, field: 'method' | 'type'): string[] {
	const re = new RegExp(`"${field}":\\s*"([^"]+)"`, 'g');
	const found = new Set<string>();
	for (const m of source.matchAll(re)) {
		found.add(m[1]);
	}
	return [...found].sort();
}

suite('codex pinned-version contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const root = repoRoot();
	const pinnedVersion = readRepoFile(root, CODEX_VERSION_FILE).trim();

	suite('pinned version', () => {

		test('build/codex/codex-version.txt is a concrete semver pin', () => {
			assert.match(pinnedVersion, /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?$/, `expected a pinned semver, got '${pinnedVersion}'`);
		});

		test('every vendored protocol type is generated from exactly the pinned version', () => {
			// `generate-protocol.mjs` stamps each file with the binary version it
			// was generated from; the pin must equal that stamp across the whole
			// vendored set. A mismatch means the types were (re)generated against a
			// different codex than the pin records — i.e. drift.
			const files = listGeneratedTsFiles(join(root, GENERATED_DIR));
			assert.ok(files.length > 100, `expected the vendored protocol tree to be populated, found ${files.length} files`);
			const headerRe = /Generated from @openai\/codex (\S+?),/;
			const mismatches: string[] = [];
			for (const file of files) {
				const header = fs.readFileSync(file, 'utf8').slice(0, 512);
				const m = header.match(headerRe);
				if (!m) {
					mismatches.push(`${file.slice(root.length + 1)}: missing version stamp`);
				} else if (m[1] !== pinnedVersion) {
					mismatches.push(`${file.slice(root.length + 1)}: stamped ${m[1]}, pin is ${pinnedVersion}`);
				}
			}
			assert.deepStrictEqual(mismatches, [], `vendored protocol drifted from the pin (${pinnedVersion}):\n${mismatches.join('\n')}`);
		});
	});

	suite('exec --json event schema', () => {

		test('ServerNotification method vocabulary is frozen', () => {
			// Pins the full set of streamed `exec --json` / app-server events. If a
			// codex upgrade adds/removes/renames a notification, regenerate the
			// protocol and update EXPECTED_SERVER_NOTIFICATION_METHODS in lockstep.
			const source = readRepoFile(root, SERVER_NOTIFICATION_FILE);
			const actual = discriminants(source, 'method');
			assert.deepStrictEqual(actual, [...EXPECTED_SERVER_NOTIFICATION_METHODS].sort());
		});

		test('every event our mapper subscribes to still exists in the schema', () => {
			const source = readRepoFile(root, SERVER_NOTIFICATION_FILE);
			const available = new Set(discriminants(source, 'method'));
			const missing = SUBSCRIBED_NOTIFICATION_METHODS.filter(m => !available.has(m));
			assert.deepStrictEqual(missing, [], `events consumed by node/codex are gone from ServerNotification: ${missing.join(', ')}`);
		});

		test('ThreadItem type vocabulary is frozen', () => {
			const source = readRepoFile(root, THREAD_ITEM_FILE);
			const actual = discriminants(source, 'type');
			assert.deepStrictEqual(actual, [...EXPECTED_THREAD_ITEM_TYPES].sort());
		});

		test('every ThreadItem kind our formatter handles still exists in the schema', () => {
			const source = readRepoFile(root, THREAD_ITEM_FILE);
			const available = new Set(discriminants(source, 'type'));
			const missing = HANDLED_THREAD_ITEM_TYPES.filter(t => !available.has(t));
			assert.deepStrictEqual(missing, [], `ThreadItem kinds handled by node/codex are gone from ThreadItem: ${missing.join(', ')}`);
		});
	});

	suite('~/.codex/sessions rollout format', () => {

		// A pinned rollout fixture in the exact shape codex persists under
		// `~/.codex/sessions` and returns from `thread/read`. Typed as `Thread`
		// (no `as never`) so the field shape is pinned at compile time: if codex
		// drifts the Thread/Turn/ThreadItem schema, the regenerated types stop
		// matching this literal and this file fails to compile.
		function pinnedRollout(): Thread {
			const userMessage: ThreadItem = {
				type: 'userMessage',
				id: 'item_user_0',
				content: [{ type: 'text', text: 'refactor the parser', text_elements: [] }],
			};
			const reasoning: ThreadItem = {
				type: 'reasoning',
				id: 'item_reasoning_0',
				summary: ['inspecting the parser'],
				content: [],
			};
			const commandExecution: ThreadItem = {
				type: 'commandExecution',
				id: 'item_cmd_0',
				command: 'rg parse',
				cwd: '/work/repo',
				processId: null,
				source: 'agent',
				status: 'completed',
				commandActions: [],
				aggregatedOutput: 'parser.ts\n',
				exitCode: 0,
				durationMs: 7,
			};
			const agentMessage: ThreadItem = {
				type: 'agentMessage',
				id: 'item_agent_0',
				text: 'Done — the parser is split into a tokenizer and a builder.',
				phase: null,
				memoryCitation: null,
			};
			return {
				id: 'thread_pinned',
				sessionId: 'session_pinned',
				forkedFromId: null,
				preview: 'refactor the parser',
				ephemeral: false,
				modelProvider: 'openai',
				createdAt: 1_700_000_000,
				updatedAt: 1_700_000_100,
				status: { type: 'idle' },
				path: '/home/dev/.codex/sessions/2026/06/thread_pinned.jsonl',
				cwd: '/work/repo',
				cliVersion: pinnedVersion,
				source: 'vscode',
				threadSource: null,
				agentNickname: null,
				agentRole: null,
				gitInfo: null,
				name: null,
				turns: [{
					id: 'turn_0',
					items: [userMessage, reasoning, commandExecution, agentMessage],
					itemsView: 'full',
					status: 'completed',
					error: null,
					startedAt: 1_700_000_000,
					completedAt: 1_700_000_100,
					durationMs: 100,
				}],
			};
		}

		test('a pinned rollout replays to the expected turn shape', () => {
			const turns = replayThreadToTurns(pinnedRollout());

			assert.strictEqual(turns.length, 1, 'one user/assistant exchange → one turn');
			const turn = turns[0];
			assert.strictEqual(turn.id, 'turn_0');
			assert.strictEqual(turn.message.text, 'refactor the parser');
			assert.strictEqual(turn.state, TurnState.Complete);

			// userMessage opens the turn; reasoning → thinking, commandExecution →
			// tool, agentMessage → text, in order.
			assert.deepStrictEqual(
				turn.responseParts.map(p => p.kind),
				[ResponsePartKind.Reasoning, ResponsePartKind.ToolCall, ResponsePartKind.Markdown],
			);
			assert.strictEqual((turn.responseParts[0] as { content: string }).content, 'inspecting the parser');

			const toolCall = (turn.responseParts[1] as ToolCallResponsePart).toolCall as ToolCallCompletedState;
			assert.strictEqual(toolCall.status, ToolCallStatus.Completed);
			assert.strictEqual(toolCall.toolName, 'shell');
			assert.strictEqual(toolCall.success, true);
			assert.strictEqual(toolCall.pastTenseMessage, 'Ran `rg parse`');
			assert.deepStrictEqual(toolCall.content, [{ type: ToolResultContentType.Text, text: 'parser.ts\n' }]);

			assert.strictEqual(
				(turn.responseParts[2] as { content: string }).content,
				'Done — the parser is split into a tokenizer and a builder.',
			);
		});

		test('a failed turn rolls up to TurnState.Error', () => {
			const rollout = pinnedRollout();
			const turns = replayThreadToTurns({
				...rollout,
				turns: [{ ...rollout.turns[0], status: 'failed', error: { message: 'sandbox denied', codexErrorInfo: null, additionalDetails: null } }],
			});
			assert.strictEqual(turns.length, 1);
			assert.strictEqual(turns[0].state, TurnState.Error);
		});
	});
});
