import { describe, it, expect } from 'vitest';
import { chunkIds, mergeInQuery, FIRESTORE_IN_LIMIT } from './firestoreChunks';

/**
 * Firestore rejects `in` queries with more than 30 values. If chunking is wrong
 * the failure is silent — learners simply go missing from CX and admin lists —
 * so the boundary cases matter more than the happy path.
 */

const ids = (n, prefix = 'u') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('chunkIds', () => {
  it('keeps a list at the limit in one chunk', () => {
    const chunks = chunkIds(ids(FIRESTORE_IN_LIMIT));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(FIRESTORE_IN_LIMIT);
  });

  it('splits one past the limit into two chunks', () => {
    const chunks = chunkIds(ids(FIRESTORE_IN_LIMIT + 1));
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toHaveLength(1);
  });

  it('never emits a chunk over the Firestore limit', () => {
    const chunks = chunkIds(ids(250));
    expect(chunks.every((c) => c.length <= FIRESTORE_IN_LIMIT)).toBe(true);
  });

  it('preserves every id across chunks', () => {
    const input = ids(97);
    expect(chunkIds(input).flat().sort()).toEqual([...input].sort());
  });

  it('deduplicates — a repeated id would waste a slot in the 30 available', () => {
    expect(chunkIds(['a', 'b', 'a', 'b', 'c'])).toEqual([['a', 'b', 'c']]);
  });

  it('drops falsy ids rather than querying for them', () => {
    expect(chunkIds(['a', null, undefined, '', 'b'])).toEqual([['a', 'b']]);
  });

  it('returns no chunks for empty or missing input', () => {
    expect(chunkIds([])).toEqual([]);
    expect(chunkIds(undefined)).toEqual([]);
  });
});

describe('mergeInQuery', () => {
  it('merges rows from every chunk, keyed by id', async () => {
    const input = ids(FIRESTORE_IN_LIMIT + 5);
    const result = await mergeInQuery(input, async (chunk) => chunk.map((id) => ({ id })));
    expect(result.size).toBe(input.length);
    expect(result.get('u0')).toEqual({ id: 'u0' });
  });

  it('issues one query per chunk', async () => {
    const calls = [];
    await mergeInQuery(ids(FIRESTORE_IN_LIMIT * 2), async (chunk) => {
      calls.push(chunk.length);
      return [];
    });
    expect(calls).toHaveLength(2);
  });

  it('skips the query entirely when there are no ids', async () => {
    let called = false;
    const result = await mergeInQuery([], async () => {
      called = true;
      return [];
    });
    expect(called).toBe(false);
    expect(result.size).toBe(0);
  });

  it('ignores rows without an id instead of storing an undefined key', async () => {
    const result = await mergeInQuery(['a'], async () => [{ id: 'a' }, { name: 'no id' }]);
    expect(result.size).toBe(1);
  });

  it('lets a later chunk overwrite an earlier row with the same id', async () => {
    const result = await mergeInQuery(['a'], async () => [
      { id: 'a', v: 1 },
      { id: 'a', v: 2 },
    ]);
    expect(result.get('a')).toEqual({ id: 'a', v: 2 });
  });
});
