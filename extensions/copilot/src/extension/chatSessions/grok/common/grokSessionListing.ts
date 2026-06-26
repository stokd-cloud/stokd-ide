/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Grok session listing — the pure half of the file-watch session list (DN-5 discovery gate).
 *
 * The authoritative session catalogue is the per-session directory tree
 * `~/.grok/sessions/<encodeURIComponent(cwd)>/<session-uuid-v7>/summary.json`. The node adapter
 * watches that tree; this module supplies the pure pieces that watcher needs and that are
 * unit-testable without a live `grok` or a real filesystem:
 *  - {@link grokSessionsDirSegmentForCwd} — the percent-encoded workspace dir segment (the gate
 *    verified `encodeURIComponent(cwd)` reproduces the on-disk name byte-for-byte).
 *  - {@link parseGrokSummaryRow} — one `summary.json` header → a list row.
 *  - {@link sortGrokRowsByRecency} — most-recent-first ordering for the list.
 *  - {@link buildGrokHeadlessArgs} / {@link buildGrokResumeArgs} — the spawn argv arrays (args
 *    arrays, never `shell: true` — §10.2) for a fresh headless turn and for click-to-resume.
 */

import { GROK_HEADLESS_SINGLE_FLAG, GROK_OUTPUT_FORMAT_FLAG, GROK_RESUME_FLAG } from './grokProviderDescriptor';
import type { GrokSummaryJson } from './grokStreamTypes';

/** The streaming headless output format the adapter parses (NDJSON event stream). */
export const GROK_STREAMING_OUTPUT_FORMAT = 'streaming-json';

/** A single Grok session as a chat-panel list row, parsed from its `summary.json` header. */
export interface IGrokSessionListRow {
	/** Session id — the UUID-v7 that names the on-disk session dir and the `-r` resume key. */
	readonly id: string;
	/** Display title — `generated_title`, else `session_summary`, else a placeholder. */
	readonly title: string;
	/** Working directory the session belongs to, if recorded. */
	readonly cwd?: string;
	readonly createdAt?: string;
	readonly updatedAt?: string;
	readonly lastActiveAt?: string;
	/** The model the session last used (`current_model_id`). */
	readonly model?: string;
	/** The git branch the session was on (`head_branch`). */
	readonly branch?: string;
	/** Chat message count (`num_chat_messages`). */
	readonly messageCount?: number;
}

/**
 * The on-disk sessions dir segment for a workspace `cwd`: its percent-encoded absolute path. The
 * discovery gate verified `encodeURIComponent(cwd)` reproduces the observed dir name byte-for-byte
 * (`/` → `%2F`), so a consumer must encode the cwd the same way to locate a workspace's sessions —
 * never assume a flat slug.
 */
export function grokSessionsDirSegmentForCwd(cwd: string): string {
	return encodeURIComponent(cwd);
}

/** Placeholder title for a session whose `summary.json` carries no title fields. */
const UNTITLED_GROK_SESSION = '(untitled grok session)';

/**
 * Parse one `summary.json` header into a list row, preferring `generated_title`, then
 * `session_summary`, then a stable placeholder. Everything a list row needs lives in this one small
 * file (gate Q1), so listing never reads the (large) transcript.
 */
export function parseGrokSummaryRow(summary: GrokSummaryJson): IGrokSessionListRow {
	const title = summary.generated_title || summary.session_summary || UNTITLED_GROK_SESSION;
	return {
		id: summary.info.id,
		title,
		cwd: summary.info.cwd,
		createdAt: summary.created_at,
		updatedAt: summary.updated_at,
		lastActiveAt: summary.last_active_at,
		model: summary.current_model_id,
		branch: summary.head_branch,
		messageCount: summary.num_chat_messages,
	};
}

/**
 * Order rows most-recent first. Sorts by `lastActiveAt` (falling back to `updatedAt`, then the
 * UUID-v7 `id`, which is itself time-ordered) descending, so the freshest session is first.
 */
export function sortGrokRowsByRecency(rows: readonly IGrokSessionListRow[]): IGrokSessionListRow[] {
	const recencyKey = (row: IGrokSessionListRow): string => row.lastActiveAt ?? row.updatedAt ?? row.id;
	return [...rows].sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)));
}

/**
 * Build the argv to start a fresh headless Grok turn:
 * `grok -p <prompt> --output-format streaming-json`. Args array, never a shell string (§10.2).
 */
export function buildGrokHeadlessArgs(prompt: string): string[] {
	return [GROK_HEADLESS_SINGLE_FLAG, prompt, GROK_OUTPUT_FORMAT_FLAG, GROK_STREAMING_OUTPUT_FORMAT];
}

/**
 * Build the argv to resume a Grok session by id, optionally carrying a new prompt:
 * `grok -r <sessionId> [-p <prompt>] --output-format streaming-json`. The session id and prompt are
 * discrete argv tokens — args array, never a shell string (§10.2), so there is no injection surface.
 */
export function buildGrokResumeArgs(sessionId: string, prompt?: string): string[] {
	const args = [GROK_RESUME_FLAG, sessionId];
	if (prompt !== undefined) {
		args.push(GROK_HEADLESS_SINGLE_FLAG, prompt);
	}
	args.push(GROK_OUTPUT_FORMAT_FLAG, GROK_STREAMING_OUTPUT_FORMAT);
	return args;
}
