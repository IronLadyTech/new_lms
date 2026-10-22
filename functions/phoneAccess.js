/**
 * Phone login → Zoho IL_Users lookup → Firebase custom token (or guest).
 * Used by the mobile app before WhatsApp / demo OTP.
 */
const admin = require('firebase-admin');
const ilUsers = require('./zohoIlUsers');
const provisioning = require('./zohoProvisioning');
const { classifyGuest, recordGuestVisit } = require('./appGuests');

function normalizePhoneE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (
    String(raw || '')
      .trim()
      .startsWith('+') &&
    digits.length >= 11
  )
    return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

function emailFromIlUser(ilUser) {
  if (!ilUser) return '';
  const fields = ilUsers.ilUserToCredentialFields(ilUser);
  const direct = String(fields.Email || ilUser.Email || '').trim();
  if (direct) return direct;
  // Same IL_Users record: some rows keep the email in Username.
  const username = String(fields.Username || ilUser.Username || '').trim();
  return /\S+@\S+\.\S+/.test(username) ? username : '';
}

/**
 * Guest sign-in: the number has no program seat. Look at every Lead on it to decide
 * Masterclass (recordings) or explore, remember the guest for the CMS, never create
 * an account. `needsCx` adds a reason CX should check this number.
 */
async function guestAccess(db, phone, deps, needsCx = null) {
  let leads = [];
  if (deps.searchLeadsByPhone) {
    try {
      leads = await deps.searchLeadsByPhone(phone);
    } catch (err) {
      console.warn('guestAccess lead lookup:', err.message);
    }
  }
  const info = classifyGuest(leads);
  if (needsCx) info.needsCx = needsCx;
  try {
    await recordGuestVisit(db, phone, info);
  } catch (err) {
    console.warn('guestAccess record:', err.message);
  }
  return { ok: true, guest: true, tier: info.tier, phone };
}

function displayNameFromIlUser(ilUser, email) {
  return (
    String(ilUser?.Name || ilUser?.Full_Name || ilUser?.Last_Name || '').trim() ||
    (email ? email.split('@')[0] : 'Learner')
  );
}

function phoneDocId(phoneE164) {
  const digits = String(phoneE164 || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** CMS-only test seat (no Zoho IL_Users) — doc id = last 10 digits of mobile. */
async function loadCmsPhoneEnrollment(db, phoneE164) {
  const id = phoneDocId(phoneE164);
  if (id.length !== 10) return null;
  const snap = await db.collection('cms_phone_enrollments').doc(id).get();
  if (!snap.exists || snap.data()?.active === false) return null;
  const data = snap.data();
  if (!data.cmsBatchId) return null;
  const batchSnap = await db.collection('cms_batches').doc(data.cmsBatchId).get();
  if (!batchSnap.exists) return null;
  return { ...data, batch: batchSnap.data() };
}

async function provisionFromCmsEnrollment(db, phone, enroll) {
  const digits = phoneDocId(phone);
  const email = String(enroll.email || `cmsqa+${digits}@ironlady.test`).trim();
  const displayName = String(enroll.displayName || 'LEP QA').trim();
  const cmsBatchId = enroll.cmsBatchId;
  const batchName = enroll.batch?.name || enroll.batchName || 'CMS QA batch';
  const paymentStatus = enroll.paymentStatus || 'register';

  let authUser = await provisioning.getAuthUserByEmail(email);
  if (!authUser) {
    try {
      authUser = await admin.auth().createUser({
        email,
        displayName,
        phoneNumber: phone,
        emailVerified: false,
      });
    } catch (err) {
      if (err?.code === 'auth/phone-number-already-exists') {
        authUser = await admin.auth().createUser({ email, displayName, emailVerified: false });
      } else if (err?.code === 'auth/email-already-exists') {
        authUser = await provisioning.getAuthUserByEmail(email);
      } else {
        console.warn('provisionFromCmsEnrollment createUser:', err.message);
        return { ok: false, reason: 'Could not open your account. Try again.' };
      }
    }
  } else if (!authUser.phoneNumber) {
    try {
      await admin.auth().updateUser(authUser.uid, { phoneNumber: phone });
    } catch (err) {
      console.warn('provisionFromCmsEnrollment phone link skipped:', err.message);
    }
  }

  const record = provisioning.mergeProvisioningRecord(null, null, {
    email,
    username: email,
    phone,
    program: 'LEP',
    LMS_Payment_Status: paymentStatus,
    batch: batchName,
  });

  try {
    await provisioning.applyEntitlements(db, authUser.uid, record, {});
  } catch (err) {
    console.warn('provisionFromCmsEnrollment entitlements:', err.message);
  }

  await db
    .collection('users')
    .doc(authUser.uid)
    .set(
      {
        email,
        phoneNumber: phone,
        displayName,
        program: 'lep',
        programs: ['lep'],
        cmsBatchId,
        programAccess: {
          lep: {
            cmsBatchId,
            batchName,
            paymentStatus,
            batchId: cmsBatchId,
          },
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );

  const token = await admin.auth().createCustomToken(authUser.uid);
  return {
    ok: true,
    guest: false,
    phone,
    email,
    uid: authUser.uid,
    token,
    cmsOnly: true,
    cmsBatchId,
  };
}

/** Staff QA list: pin app to `cms_batches` even when the number exists in Zoho. */
async function applyCmsEnrollmentOverlay(db, uid, enroll) {
  if (!uid || !enroll?.cmsBatchId) return null;
  const batchName = enroll.batch?.name || enroll.batchName || 'CMS QA batch';
  const paymentStatus = enroll.paymentStatus || 'register';
  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        cmsBatchId: enroll.cmsBatchId,
        program: 'lep',
        programs: admin.firestore.FieldValue.arrayUnion('lep'),
        programAccess: {
          lep: {
            cmsBatchId: enroll.cmsBatchId,
            batchId: enroll.cmsBatchId,
            batchName,
            paymentStatus,
          },
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );
  return enroll.cmsBatchId;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} phoneRaw
 * @param {{ getAccessToken: Function, getApiDomain: Function, isConfigured: Function, syncEntitlementsFromZoho?: Function }} deps
 */
async function resolvePhoneAccess(db, phoneRaw, deps) {
  const phone = normalizePhoneE164(phoneRaw);
  if (!phone) {
    return { ok: false, reason: 'Enter a valid mobile number.' };
  }

  const cmsEnroll = await loadCmsPhoneEnrollment(db, phone);

  if (!deps.isConfigured()) {
    if (cmsEnroll) return provisionFromCmsEnrollment(db, phone, cmsEnroll);
    return { ok: false, reason: 'Zoho is not configured on the server.' };
  }

  const api = { getAccessToken: deps.getAccessToken, getApiDomain: deps.getApiDomain };
  let ilUser = null;
  try {
    ilUser = await ilUsers.findIlUserRecord(null, null, api, { phone });
  } catch (err) {
    console.warn('resolvePhoneAccess Zoho lookup failed:', err.message);
    if (cmsEnroll) return provisionFromCmsEnrollment(db, phone, cmsEnroll);
    return { ok: false, reason: 'Could not reach Zoho. Try again in a moment.' };
  }

  if (!ilUser) {
    if (cmsEnroll) return provisionFromCmsEnrollment(db, phone, cmsEnroll);
    return guestAccess(db, phone, deps);
  }

  const email = emailFromIlUser(ilUser);
  if (!email) {
    // Do not stop her: guest flow now, and CX sees the number to fix in Zoho.
    return guestAccess(
      db,
      phone,
      deps,
      'In IL_Users but with no email — add it so she gets her program.'
    );
  }

  const displayName = displayNameFromIlUser(ilUser, email);
  let authUser = await provisioning.getAuthUserByEmail(email);
  if (!authUser) {
    try {
      authUser = await admin.auth().createUser({
        email,
        displayName,
        phoneNumber: phone,
        emailVerified: false,
      });
    } catch (err) {
      if (err?.code === 'auth/phone-number-already-exists') {
        // Phone already on another Firebase user — keep email account, skip phone link.
        authUser = await admin.auth().createUser({
          email,
          displayName,
          emailVerified: false,
        });
      } else if (err?.code === 'auth/email-already-exists') {
        authUser = await provisioning.getAuthUserByEmail(email);
      } else {
        console.warn('resolvePhoneAccess createUser failed:', err.message);
        return { ok: false, reason: 'Could not open your account. Try again.' };
      }
    }
  } else if (!authUser.phoneNumber) {
    try {
      await admin.auth().updateUser(authUser.uid, { phoneNumber: phone });
    } catch (err) {
      // Non-fatal — custom token still works.
      console.warn('resolvePhoneAccess phone link skipped:', err.message);
    }
  }

  const record = provisioning.mergeProvisioningRecord(null, ilUser, {
    email,
    username: ilUser.Username || email,
    Phone: phone,
  });
  if (!record.LMS_Payment_Status) {
    record.LMS_Payment_Status = 'register';
  }

  try {
    await provisioning.applyEntitlements(db, authUser.uid, record, {});
  } catch (err) {
    console.warn('resolvePhoneAccess entitlements:', err.message);
  }

  if (typeof deps.syncEntitlementsFromZoho === 'function') {
    try {
      await deps.syncEntitlementsFromZoho(db, email, null);
    } catch (err) {
      console.warn('resolvePhoneAccess entitlement sync:', err.message);
    }
  }

  await db.collection('users').doc(authUser.uid).set(
    {
      email,
      phoneNumber: phone,
      displayName,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  let cmsBatchId = null;
  if (cmsEnroll) {
    cmsBatchId = await applyCmsEnrollmentOverlay(db, authUser.uid, cmsEnroll);
  }

  const token = await admin.auth().createCustomToken(authUser.uid);
  return {
    ok: true,
    guest: false,
    phone,
    email,
    uid: authUser.uid,
    token,
    cmsBatchId,
  };
}

/**
 * Save city / domain / B-HAG onto the learner profile (and Lead when possible).
 */
async function updateMyWelcomeProfile(db, uid, fields, deps) {
  if (!uid) return { ok: false, reason: 'Sign in required' };

  const allowed = {};
  if (typeof fields?.city === 'string' && fields.city.trim()) allowed.city = fields.city.trim();
  if (typeof fields?.domain === 'string' && fields.domain.trim())
    allowed.domain = fields.domain.trim();
  if (typeof fields?.bhag === 'string' && fields.bhag.trim()) allowed.bhag = fields.bhag.trim();
  if (typeof fields?.salaryRange === 'string' && fields.salaryRange.trim()) {
    allowed.salaryRange = fields.salaryRange.trim().slice(0, 40);
  }
  if (typeof fields?.lepBatch === 'string' && fields.lepBatch.trim()) {
    allowed.lepBatch = fields.lepBatch.trim();
  }
  if (typeof fields?.cmsBatchId === 'string' && fields.cmsBatchId.trim()) {
    allowed.cmsBatchId = fields.cmsBatchId.trim();
  }
  if (typeof fields?.day1Date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fields.day1Date.trim())) {
    allowed.day1Date = fields.day1Date.trim().slice(0, 10);
  }
  if (!Object.keys(allowed).length) {
    return { ok: false, reason: 'Nothing to update' };
  }

  const ref = db.collection('users').doc(uid);
  const snap0 = await ref.get();
  const prev = snap0.data() || {};
  const firestorePatch = { updatedAt: new Date() };
  if (allowed.city) firestorePatch.city = allowed.city;
  if (allowed.domain) {
    firestorePatch.domain = allowed.domain;
    firestorePatch.leadershipRole = allowed.domain;
  }
  if (allowed.bhag) firestorePatch.bhag = allowed.bhag;
  if (allowed.salaryRange) firestorePatch.salaryRange = allowed.salaryRange;
  if (allowed.city || allowed.domain || allowed.bhag || allowed.salaryRange) {
    firestorePatch.zohoLead = {
      ...(prev.zohoLead || {}),
      ...(allowed.city ? { City: allowed.city } : {}),
      ...(allowed.domain ? { Industry: allowed.domain, LMS_Domain: allowed.domain } : {}),
      ...(allowed.bhag ? { Month_B_HAG: allowed.bhag, LMS_BHAG: allowed.bhag } : {}),
      ...(allowed.salaryRange ? { Annual_Income: allowed.salaryRange } : {}),
      id: prev.zohoLeadId || prev.leadId || prev.zohoLead?.id || null,
    };
  }
  if (allowed.lepBatch || allowed.cmsBatchId) {
    const lep = { ...(prev.programAccess?.lep || {}) };
    if (allowed.lepBatch) {
      lep.zohoBatchKey = allowed.lepBatch;
      lep.zohoRawBatch = allowed.lepBatch;
      lep.batchName = allowed.lepBatch;
    }
    if (allowed.cmsBatchId) {
      lep.cmsBatchId = allowed.cmsBatchId;
      lep.batchId = allowed.cmsBatchId;
      firestorePatch.cmsBatchId = allowed.cmsBatchId;
    }
    if (allowed.day1Date) {
      lep.day1Date = allowed.day1Date;
    }
    firestorePatch.programAccess = { ...(prev.programAccess || {}), lep };
  }
  await ref.set(firestorePatch, { merge: true });

  const userDoc = { ...prev, ...firestorePatch };
  const email = String(userDoc.email || '').trim();
  const phone = String(userDoc.phoneNumber || userDoc.phone || '').trim();
  const leadId = userDoc.zohoLeadId || userDoc.leadId || null;

  if ((email || phone || leadId || uid) && deps?.updateLeadWelcomeFields) {
    try {
      const zohoId = await deps.updateLeadWelcomeFields(
        { email, phone, leadId, uid, zohoLeadId: leadId },
        allowed
      );
      const resolvedLead = zohoId || leadId || null;
      if (!resolvedLead) {
        return { ok: true, zoho: false, reasonCode: 'lead_not_found', ...allowed };
      }
      if (zohoId) {
        await ref.set(
          {
            zohoLeadId: zohoId,
            zohoLead: { ...(firestorePatch.zohoLead || prev.zohoLead || {}), id: zohoId },
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }
      return { ok: true, zoho: true, zohoLeadId: resolvedLead, ...allowed };
    } catch (err) {
      console.warn('updateMyWelcomeProfile Zoho:', err.message);
      return {
        ok: true,
        zoho: false,
        reasonCode: 'zoho_write_failed',
        ...allowed,
      };
    }
  }

  return {
    ok: true,
    zoho: false,
    reasonCode: email || phone ? 'zoho_unavailable' : 'lead_not_found',
    ...allowed,
  };
}

module.exports = {
  normalizePhoneE164,
  resolvePhoneAccess,
  updateMyWelcomeProfile,
};
