/**
 * Zoho → LMS provisioning (Leads + IL_Users + registration webhook payload).
 */

const admin = require('firebase-admin');
const {
  normalizeProgram,
  PROGRAM_COURSE_CODE,
  normalizePaymentStatus,
  PAYMENT_STATUS,
  accessTierFromPaymentStatus,
  maxPaymentStatus,
  paymentStatusFromRegistrationPayload,
} = require('./accessTiers');
const { parseLeadEntitlements } = require('./zohoFieldMap');
const { ilUserToCredentialFields } = require('./zohoIlUsers');

async function getAuthUserByEmail(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null;
    throw err;
  }
}

async function getCourseIdByCode(db, code) {
  if (!code) return null;
  const snap = await db.collection('courses').where('code', '==', code).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function ensureCourseEnrollment(db, uid, profile, program) {
  const code = PROGRAM_COURSE_CODE[program];
  if (!code) return profile;

  const courseId = await getCourseIdByCode(db, code);
  if (!courseId) return profile;

  const enrolled = Array.isArray(profile.enrolledCourses) ? profile.enrolledCourses : [];
  if (enrolled.includes(courseId)) return profile;

  await db.collection('users').doc(uid).update({
    enrolledCourses: admin.firestore.FieldValue.arrayUnion(courseId),
    updatedAt: new Date(),
  });

  return { ...profile, enrolledCourses: [...enrolled, courseId] };
}

function mergeProvisioningRecord(lead, ilUser, webhookBody) {
  const merged = { ...(lead || {}), ...ilUserToCredentialFields(ilUser) };

  const email = (webhookBody?.email || webhookBody?.Email || merged.Email || '').trim();
  if (email) merged.Email = email;

  if (webhookBody?.username) merged.Username = webhookBody.username;
  if (webhookBody?.password) merged.Password = webhookBody.password;
  if (webhookBody?.program || webhookBody?.Program) {
    merged.Program = webhookBody.program || webhookBody.Program;
  }
  if (webhookBody?.fullname) {
    merged.Last_Name = webhookBody.fullname;
  }
  if (webhookBody?.phone) merged.Phone = webhookBody.phone;
  if (webhookBody?.batch) merged.batch = webhookBody.batch;

  const fromWebhookPayment = paymentStatusFromRegistrationPayload(webhookBody);
  if (fromWebhookPayment) {
    merged.LMS_Payment_Status = fromWebhookPayment;
  }

  return merged;
}

function parseEntitlementsFromRecord(record) {
  const ent = parseLeadEntitlements(record);
  const programFromBody = normalizeProgram(record?.Program);
  if (programFromBody) ent.program = programFromBody;

  const paymentFromRecord = record?.LMS_Payment_Status
    ? normalizePaymentStatus(record.LMS_Payment_Status)
    : null;
  if (paymentFromRecord) {
    ent.paymentStatus = paymentFromRecord;
    ent.accessTier = accessTierFromPaymentStatus(paymentFromRecord);
  }

  if (ent.lmsUsername && !ent.email && ent.lmsUsername.includes('@')) {
    ent.email = ent.lmsUsername;
  }

  return ent;
}

function isValidBatchName(batch) {
  const b = (batch || '').toString().trim();
  return b && b !== '#batch' && !b.includes('$');
}

/** Don't overwrite LMS password when student already changed it (webhook re-run safe). */
function shouldApplyProvisioningPassword(profile, ent, existedBefore) {
  if (!ent.password || ent.password.length < 6) return false;
  if (!existedBefore) return true;
  const stored = profile.lmsCredentialPassword?.trim();
  if (!stored) return true;
  if (stored === ent.password) return true;
  return false;
}

async function applyEntitlements(db, uid, record, profile = {}) {
  const ent = parseEntitlementsFromRecord(record);
  if (!ent.email) return { applied: false, reason: 'No email on record' };

  const updates = { updatedAt: new Date(), zohoEntitlementsSyncedAt: new Date() };
  if (ent.program) updates.program = ent.program;

  if (ent.paymentStatus) {
    updates.paymentStatus = maxPaymentStatus(profile.paymentStatus, ent.paymentStatus);
    updates.accessTier = accessTierFromPaymentStatus(updates.paymentStatus);
  } else if (ent.accessTier) {
    updates.accessTier = ent.accessTier;
  }

  if (ent.leadStatus) updates.zohoLeadStatus = ent.leadStatus;
  if (ent.lmsUsername) updates.lmsUsername = ent.lmsUsername.toLowerCase();
  if (ent.zohoLeadId) updates.zohoLeadId = ent.zohoLeadId;
  if (record?.LMS_User_Id) updates.moodleUserId = String(record.LMS_User_Id);
  if (record?.id && record?.Username) updates.zohoIlUserId = String(record.id);
  if (ent.displayName && !profile.displayName) updates.displayName = ent.displayName;

  const batch = record?.batch || record?.Batch;
  if (isValidBatchName(batch)) updates.batchName = batch.toString().trim();

  await db.collection('users').doc(uid).update(updates);

  let merged = { ...profile, ...updates };
  if (ent.program || updates.program) {
    merged = await ensureCourseEnrollment(db, uid, merged, ent.program || updates.program);
  }

  const mergedEnt = {
    ...ent,
    program: updates.program || ent.program,
    paymentStatus: updates.paymentStatus || ent.paymentStatus,
    accessTier: updates.accessTier || ent.accessTier,
  };

  return { applied: true, entitlements: mergedEnt, profile: merged };
}

async function ensureFirestoreProfile(db, uid, ent) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();

  const profile = {
    email: ent.email,
    displayName: ent.displayName || ent.email.split('@')[0] || 'User',
    role: 'student',
    blocked: false,
    enrolledCourses: [],
    streak: 0,
    lastStreakDate: null,
    lastActivityAt: null,
    provisionedFromZoho: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await ref.set(profile);
  return profile;
}

async function ensureAuthUser(ent) {
  if (!ent.email) throw new Error('Email is required');

  let authUser = await getAuthUserByEmail(ent.email);
  if (authUser) return authUser;

  if (!ent.password || ent.password.length < 6) {
    throw new Error(
      'Password not found — check IL_Users module (Username/Password) or pass password in webhook'
    );
  }

  return admin.auth().createUser({
    email: ent.email,
    password: ent.password,
    displayName: ent.displayName || ent.email.split('@')[0] || 'User',
    emailVerified: false,
  });
}

async function provisionFromRecord(db, record, { applyPassword = true } = {}) {
  const ent = parseEntitlementsFromRecord(record);
  if (!ent.email) return { ok: false, reason: 'No email on record' };

  if (ent.paymentStatus === PAYMENT_STATUS.UNPAID) {
    return {
      ok: false,
      reason: 'Payment status unpaid — run after registration fee Completed',
      paymentStatus: ent.paymentStatus,
    };
  }

  const authUser = await ensureAuthUser(ent);
  const profileRef = db.collection('users').doc(authUser.uid);
  const existedBefore = (await profileRef.get()).exists;
  let profile = await ensureFirestoreProfile(db, authUser.uid, ent);

  if (applyPassword && shouldApplyProvisioningPassword(profile, ent, existedBefore)) {
    try {
      await admin.auth().updateUser(authUser.uid, { password: ent.password });
      await db.collection('users').doc(authUser.uid).update({
        lmsCredentialPassword: ent.password,
        passwordUpdatedAt: new Date(),
        updatedAt: new Date(),
      });
      profile = { ...profile, lmsCredentialPassword: ent.password };
    } catch (err) {
      console.warn(`Password apply failed for ${ent.email}:`, err.message);
    }
  } else if (existedBefore && ent.password && profile.lmsCredentialPassword !== ent.password) {
    console.info(
      `Skipped webhook password overwrite for ${ent.email} — LMS credential is newer/different`
    );
  }

  const entitlementResult = await applyEntitlements(db, authUser.uid, record, profile);

  return {
    ok: true,
    uid: authUser.uid,
    created: !existedBefore,
    email: ent.email,
    lmsUsername: ent.lmsUsername,
    program: entitlementResult.entitlements?.program || ent.program,
    accessTier: entitlementResult.entitlements?.accessTier || ent.accessTier,
    paymentStatus: entitlementResult.entitlements?.paymentStatus || ent.paymentStatus,
    passwordApplied: shouldApplyProvisioningPassword(profile, ent, existedBefore),
    ...entitlementResult,
  };
}

/** @deprecated use provisionFromRecord */
async function provisionUserFromLead(db, lead, options) {
  return provisionFromRecord(db, lead, options);
}

async function provisionUserFromEmail(db, getLeadByEmail, searchIlUserByEmail, email, webhookBody = null) {
  const trimmed = email?.trim();
  if (!trimmed) return { ok: false, reason: 'Email is required' };

  const [lead, ilUser] = await Promise.all([
    getLeadByEmail(trimmed).catch(() => null),
    searchIlUserByEmail(trimmed).catch(() => null),
  ]);

  if (!lead && !ilUser && !webhookBody?.password) {
    return { ok: false, reason: 'No Zoho Lead or IL_Users record found for this email' };
  }

  const record = mergeProvisioningRecord(lead, ilUser, webhookBody);
  return provisionFromRecord(db, record);
}

async function provisionFromRegistrationWebhook(db, body, deps) {
  const email = (body?.email || body?.Email || '').trim();
  if (!email) return { ok: false, reason: 'email is required in webhook body' };

  return provisionUserFromEmail(
    db,
    deps.getLeadByEmail,
    deps.searchIlUserByEmail,
    email,
    body
  );
}

module.exports = {
  mergeProvisioningRecord,
  parseEntitlementsFromRecord,
  applyEntitlements,
  provisionFromRecord,
  provisionUserFromLead,
  provisionUserFromEmail,
  provisionFromRegistrationWebhook,
  ensureCourseEnrollment,
  shouldApplyProvisioningPassword,
  isValidBatchName,
};
