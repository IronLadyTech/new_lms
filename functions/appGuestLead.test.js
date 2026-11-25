import { describe, it, expect } from 'vitest';
import { runRegisterAppGuest, runTrackAppGuest, needsLead } from './appGuests.js';

/** A number not in Zoho opens the app: Zoho gets a Lead with Lead Source "App". */
function fakeDb(guest) {
  const store = { guest: guest ? { ...guest } : null };
  const ref = {
    get: async () => ({ exists: !!store.guest, data: () => store.guest }),
    set: async (p) => {
      const next = { ...(store.guest || {}) };
      for (const [k, v] of Object.entries(p)) if (!(v && typeof v === 'object' && v.constructor?.name?.includes('Transform'))) next[k] = v;
      store.guest = next;
    },
  };
  return {
    store,
    collection: () => ({ doc: () => ref }),
    runTransaction: async (fn) => fn({ get: async () => ({ exists: false, data: () => ({}) }), set: () => {} }),
  };
}
const leads = () => {
  const made = [];
  return { made, createLead: async (f) => (made.push(f), 'L9') };
};
const recent = { lastSeenAt: { toMillis: () => Date.now() }, inZoho: false };

describe('guest not in Zoho', () => {
  it('Continue as guest creates the Lead: source App, status New, her mobile and name', async () => {
    const db = fakeDb(recent);
    const z = leads();
    await runRegisterAppGuest(db, z, { phone: '+91 98765 43210', name: 'Priya Sharma' });
    expect(z.made[0]).toMatchObject({ Lead_Source: 'App', Lead_Status: 'New', Mobile: '+919876543210', First_Name: 'Priya', Last_Name: 'Sharma' });
    expect(db.store.guest).toMatchObject({ zohoLeadId: 'L9', inZoho: true, leadCreatedByApp: true });
  });
  it('no name typed: still a Lead ("App guest")', async () => {
    const db = fakeDb(recent);
    const z = leads();
    await runRegisterAppGuest(db, z, { phone: '9876543210', name: '' });
    expect(z.made[0].Last_Name).toBe('App guest');
  });
  it('the name step never reached the server: her next app open creates it', async () => {
    const db = fakeDb(recent);
    const z = leads();
    await runTrackAppGuest(db, { phone: '9876543210', event: 'open' }, z);
    expect(z.made).toHaveLength(1);
    await runTrackAppGuest(db, { phone: '9876543210', event: 'open' }, z);
    expect(z.made).toHaveLength(1); // once
  });
  it('already in Zoho: no new Lead', async () => {
    const db = fakeDb({ ...recent, inZoho: true });
    const z = leads();
    await runTrackAppGuest(db, { phone: '9876543210', event: 'open' }, z);
    await runRegisterAppGuest(db, z, { phone: '9876543210', name: 'Priya' });
    expect(z.made).toHaveLength(0);
  });
  it('Zoho failed: tried again after a day, not on every open', () => {
    const z = leads();
    const now = Date.now();
    expect(needsLead({ leadTriedAt: new Date(now - 3600e3) }, z, now)).toBe(false);
    expect(needsLead({ leadTriedAt: new Date(now - 25 * 3600e3) }, z, now)).toBe(true);
  });
});
