/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import {
	GROK_CHAT_FORMAT_VERSION,
	GROK_CHAT_RECORD_TYPES,
	GROK_EVENT_TYPES,
	grokTextOf,
	grokToolCallId,
	grokToolKind,
} from '../grokStreamTypes';

describe('grok stream types — pinned vocabularies (DN-5 discovery gate)', () => {
	it('pins the chat_history.jsonl record-type vocabulary', () => {
		// From GROK-DISCOVERY-GATE.md Q1 — chat_history.jsonl record type/role vocabulary.
		expect([...GROK_CHAT_RECORD_TYPES]).toEqual([
			'system',
			'user',
			'assistant',
			'reasoning',
			'tool_result',
			'backend_tool_call',
		]);
		expect(GROK_CHAT_FORMAT_VERSION).toBe(1);
	});

	it('pins the events.jsonl event-type vocabulary', () => {
		// From GROK-DISCOVERY-GATE.md Q1 — events.jsonl `type` vocabulary.
		for (const t of [
			'turn_started', 'turn_ended', 'loop_started', 'first_token', 'phase_changed',
			'tool_started', 'tool_completed', 'permission_requested', 'permission_resolved',
		]) {
			expect(GROK_EVENT_TYPES).toContain(t);
		}
	});
});

describe('grokTextOf', () => {
	it('reads a plain string content', () => {
		expect(grokTextOf('hello')).toBe('hello');
	});

	it('reads a single text content block', () => {
		expect(grokTextOf({ type: 'text', text: 'hi' })).toBe('hi');
	});

	it('concatenates an array of text content blocks', () => {
		expect(grokTextOf([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])).toBe('ab');
	});

	it('returns undefined for empty / missing / non-text content', () => {
		expect(grokTextOf(undefined)).toBeUndefined();
		expect(grokTextOf('')).toBeUndefined();
		expect(grokTextOf({ type: 'image', data: 'AAAA' })).toBeUndefined();
		expect(grokTextOf([])).toBeUndefined();
	});
});

describe('grokToolKind — heuristic classification (refined on pin bump)', () => {
	it('classifies shell/exec tools as execute', () => {
		expect(grokToolKind('shell')).toBe('execute');
		expect(grokToolKind('bash')).toBe('execute');
		expect(grokToolKind('run_command')).toBe('execute');
		expect(grokToolKind('terminal')).toBe('execute');
	});

	it('classifies edit/write tools as edit', () => {
		expect(grokToolKind('str_replace')).toBe('edit');
		expect(grokToolKind('write_file')).toBe('edit');
		expect(grokToolKind('apply_patch')).toBe('edit');
		expect(grokToolKind('edit')).toBe('edit');
	});

	it('classifies everything else as simple', () => {
		expect(grokToolKind('read_file')).toBe('simple');
		expect(grokToolKind('grep')).toBe('simple');
		expect(grokToolKind('web_search')).toBe('simple');
	});
});

describe('grokToolCallId — accepts id / tool_call_id aliases', () => {
	it('prefers id, falls back to tool_call_id', () => {
		expect(grokToolCallId({ type: 'tool_started', id: 'a', name: 'shell' })).toBe('a');
		expect(grokToolCallId({ type: 'tool_completed', tool_call_id: 'b' })).toBe('b');
		expect(grokToolCallId({ type: 'turn_started' })).toBeUndefined();
	});
});
