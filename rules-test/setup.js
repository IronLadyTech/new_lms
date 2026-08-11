/**
 * The service layer falls back to localStorage when a Firestore write is
 * rejected, so a learner never silently loses work. Node has no localStorage,
 * so exercising that fallback needs a minimal in-memory stand-in.
 */
const store = new Map();

globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
