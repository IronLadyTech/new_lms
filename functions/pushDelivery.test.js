import { describe, it, expect, vi } from 'vitest';
import { sendPushToUser, pushTargets } from './pushDelivery.js';

/**
 * Multi-device push. What goes wrong for a learner: only her newest phone buzzes,
 * the same push arrives twice, iOS never buzzes, or a dead token keeps failing forever.
 */

function fakeDb({ fcmToken = null, devices = {} } = {}) {
  const state = { fcmToken, devices: { ...devices } };
  const userRef = {
    get: async () => ({ exists: true, data: () => ({ fcmToken: state.fcmToken }) }),
    update: async (patch) => Object.assign(state, patch),
    collection: () => ({
      get: async () => ({
        docs: Object.entries(state.devices).map(([id, data]) => ({
          id,
          data: () => data,
          ref: { delete: async () => delete state.devices[id] },
        })),
      }),
    }),
  };
  return { state, db: { collection: () => ({ doc: () => userRef }) } };
}

const MSG = { title: 'Due today', body: 'x', data: { go: '{"to":"home"}' } };
const okFetch = (tickets) =>
  vi.fn(async (_url, init) => ({
    ok: true,
    json: async () => ({ data: tickets ?? JSON.parse(init.body).map(() => ({ status: 'ok' })) }),
  }));

describe('who gets the push', () => {
  it('every device: Android via FCM, iPhone via Expo', async () => {
    const { db } = fakeDb({
      devices: {
        a: { platform: 'android', nativeToken: 'fcm-a', expoToken: 'ExponentPushToken[a]' },
        i: { platform: 'ios', nativeToken: 'apns-i', expoToken: 'ExponentPushToken[i]' },
      },
    });
    const messaging = { send: vi.fn(async () => 'id') };
    const fetch = okFetch();
    const r = await sendPushToUser('u', MSG, db, { messaging, fetch });
    expect(r).toMatchObject({ sent: true, devices: 2, delivered: 2, failed: 0 });
    expect(messaging.send).toHaveBeenCalledTimes(1);
    expect(messaging.send.mock.calls[0][0].token).toBe('fcm-a');
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent).toEqual([expect.objectContaining({ to: 'ExponentPushToken[i]', title: 'Due today' })]);
  });

  it('old app builds (users.fcmToken only) still get it', async () => {
    const { db } = fakeDb({ fcmToken: 'legacy' });
    expect(await pushTargets(db, 'u')).toEqual([expect.objectContaining({ via: 'fcm', token: 'legacy', legacy: true })]);
  });

  it('no double push when the legacy token is one of her devices', async () => {
    const { db } = fakeDb({ fcmToken: 'fcm-a', devices: { a: { platform: 'android', nativeToken: 'fcm-a' } } });
    const targets = await pushTargets(db, 'u');
    expect(targets).toHaveLength(1);
    expect(targets[0].legacy).toBeUndefined();
  });

  it('nothing to send to → says so, does not throw', async () => {
    const { db } = fakeDb();
    expect(await sendPushToUser('u', MSG, db, { messaging: { send: vi.fn() }, fetch: vi.fn() })).toMatchObject({
      sent: false,
      reason: 'no_device',
    });
  });
});

describe('dead tokens are cleaned up', () => {
  it('FCM "not registered" removes that device; other devices still delivered', async () => {
    const { db, state } = fakeDb({
      devices: { old: { platform: 'android', nativeToken: 'dead' }, cur: { platform: 'android', nativeToken: 'live' } },
    });
    const messaging = {
      send: vi.fn(async ({ token }) => {
        if (token === 'dead') throw Object.assign(new Error('gone'), { code: 'messaging/registration-token-not-registered' });
        return 'id';
      }),
    };
    const r = await sendPushToUser('u', MSG, db, { messaging, fetch: vi.fn() });
    expect(r).toMatchObject({ delivered: 1, failed: 1 });
    expect(Object.keys(state.devices)).toEqual(['cur']);
  });

  it('Expo DeviceNotRegistered removes the iPhone entry', async () => {
    const { db, state } = fakeDb({ devices: { i: { platform: 'ios', expoToken: 'ExponentPushToken[i]' } } });
    const fetch = okFetch([{ status: 'error', details: { error: 'DeviceNotRegistered' } }]);
    await sendPushToUser('u', MSG, db, { messaging: { send: vi.fn() }, fetch });
    expect(state.devices).toEqual({});
  });

  it('a dead legacy token is cleared from the user', async () => {
    const { db, state } = fakeDb({ fcmToken: 'dead' });
    const messaging = {
      send: vi.fn(async () => {
        throw Object.assign(new Error('gone'), { code: 'messaging/registration-token-not-registered' });
      }),
    };
    await sendPushToUser('u', MSG, db, { messaging, fetch: vi.fn() });
    expect(state.fcmToken).toBeNull();
  });
});
