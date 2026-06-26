/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import type { GrokSummaryJson } from '../grokStreamTypes';
import {
	buildGrokHeadlessArgs,
	buildGrokResumeArgs,
	grokSessionsDirSegmentForCwd,
	parseGrokSummaryRow,
	sortGrokRowsByRecency,
	type IGrokSessionListRow,
} from '../grokSessionListing';

const SUMMARY: GrokSummaryJson = {
	info: { id: '019e7fe3-ff18-7cc0-a3a7-8e0e4280fd9d', cwd: '/repo/app' },
	session_summary: 'Fallback title',
	generated_title: 'Fix the parser',
	created_at: '2026-05-31T21:15:09Z',
	updated_at: '2026-05-31T22:07:39Z',
	last_active_at: '2026-05-31T22:07:39Z',
	num_chat_messages: 313,
	current_model_id: 'grok-build',
	head_branch: 'main',
};

describe('grok adapter file-watch listing (summary.json -> row, AC-P3.1)', () => {
	it('encodes the workspace cwd to the on-disk sessions dir segment (percent-encoded)', () => {
		expect(grokSessionsDirSegmentForCwd('/opt/work/x')).toBe(encodeURIComponent('/opt/work/x'));
		expect(grokSessionsDirSegmentForCwd('/opt/work/x')).toBe('%2Fopt%2Fwork%2Fx');
	});

	it('parses a summary.json into a list row, preferring generated_title', () => {
		expect(parseGrokSummaryRow(SUMMARY)).toEqual<IGrokSessionListRow>({
			id: '019e7fe3-ff18-7cc0-a3a7-8e0e4280fd9d',
			title: 'Fix the parser',
			cwd: '/repo/app',
			createdAt: '2026-05-31T21:15:09Z',
			updatedAt: '2026-05-31T22:07:39Z',
			lastActiveAt: '2026-05-31T22:07:39Z',
			model: 'grok-build',
			branch: 'main',
			messageCount: 313,
		});
	});

	it('falls back to session_summary, then a placeholder, when no generated_title', () => {
		expect(parseGrokSummaryRow({ ...SUMMARY, generated_title: undefined }).title).toBe('Fallback title');
		expect(parseGrokSummaryRow({ info: { id: 'x' } }).title).toBe('(untitled grok session)');
	});

	it('sorts rows most-recent first (uuid v7 dir names sort chronologically)', () => {
		const rows = sortGrokRowsByRecency([
			{ id: 'a', title: 'a', lastActiveAt: '2026-01-01T00:00:00Z' },
			{ id: 'b', title: 'b', lastActiveAt: '2026-02-01T00:00:00Z' },
		]);
		expect(rows.map(r => r.id)).toEqual(['b', 'a']);
	});

	it('builds resume / headless spawn arg arrays (args arrays, never shell strings)', () => {
		expect(buildGrokResumeArgs('sid-1')).toEqual(['-r', 'sid-1', '--output-format', 'streaming-json']);
		const resumeWithPrompt = buildGrokResumeArgs('sid-1', 'continue');
		const ri = resumeWithPrompt.indexOf('-r');
		expect(resumeWithPrompt[ri + 1]).toBe('sid-1');
		expect(resumeWithPrompt).toContain('continue');
		expect(buildGrokHeadlessArgs('hello')).toEqual(['-p', 'hello', '--output-format', 'streaming-json']);
		// every token is a discrete argv string — never a packed shell line
		for (const args of [buildGrokResumeArgs('sid-1'), resumeWithPrompt, buildGrokHeadlessArgs('hello')]) {
			expect(args.every(a => typeof a === 'string' && !/&&|\|\||;/.test(a))).toBe(true);
		}
	});
});
