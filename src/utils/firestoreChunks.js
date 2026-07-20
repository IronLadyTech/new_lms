/** Firestore `in` queries allow at most 30 values. */
export const FIRESTORE_IN_LIMIT = 30;

export function chunkIds(ids = [], size = FIRESTORE_IN_LIMIT) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}

/** Run the same query shape across id chunks and merge by doc id. */
export async function mergeInQuery(ids, runChunk) {
  const byId = new Map();
  const chunks = chunkIds(ids);
  if (!chunks.length) return byId;

  await Promise.all(
    chunks.map(async (chunk) => {
      const rows = await runChunk(chunk);
      (rows || []).forEach((row) => {
        if (row?.id) byId.set(row.id, row);
      });
    })
  );
  return byId;
}
