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

async function defaultUpdateAuthPassword(uid, password) {
  await admin.auth().updateUser(uid, { password });
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

  await db
    .collection('users')
    .doc(uid)
    .update({
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

  const fromWebhookPayment = paymentStatusFromRegistrationPayload(webhookBody ?? {});
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

const STAFF_ROLES = new Set(['moderator', 'admin', 'superadmin']);

function isStaffProfile(profile) {
  return STAFF_ROLES.has((profile?.role || 'student').toLowerCase());
}

async function applyEntitlements(db, uid, record, profile = {}) {
  const ent = parseEntitlementsFromRecord(record);
  if (!ent.email) return { applied: false, reason: 'No email on record' };

  const staffProgramLocked = isStaffProfile(profile);

  const updates = { updatedAt: new Date(), zohoEntitlementsSyncedAt: new Date() };
  // CX moderators/admins: program scope is set in LMS Admin — never overwrite from Zoho Lead.
  if (ent.program && !staffProgramLocked) {
    updates.program = ent.program;
  }

  if (ent.paymentStatus) {
    updates.paymentStatus = maxPaymentStatus(profile.paymentStatus, ent.paymentStatus);
    updates.accessTier = accessTierFromPaymentStatus(updates.paymentStatus);
  } else if (ent.accessTier) {
    updates.accessTier = ent.accessTier;
  }

  /*
   * The day the full course amount cleared for this programme. Access runs from
   * here — the programme's own length plus a year — so it is written once and
   * never moved: a re-sync, a webhook replay or a later batch apply must not
   * restart somebody's clock. Stored per programme because a learner can be
   * fully paid for LEP while only registered for 100BM.
   */
  if (ent.paymentStatus && ent.program) {
    /*
     * Recorded against the programme it was paid for. Zoho already tracks these
     * separately — lepPaymentStatus, hundredBMPaymentStatus, MBWPaymentStatus —
     * and flattening them into one profile field meant the highest tier leaked
     * everywhere, so paying for LEP unlocked the whole of 100BM.
     *
     * Still ratchets upward, but only within this programme.
     */
    const previous = profile.programAccess?.[ent.program]?.paymentStatus;
    updates[`programAccess.${ent.program}.paymentStatus`] = maxPaymentStatus(
      previous,
      ent.paymentStatus
    );
  }

  if (updates.paymentStatus === PAYMENT_STATUS.PAID && ent.program) {
    const alreadyStamped = profile.programAccess?.[ent.program]?.fullPaidAt;
    if (!alreadyStamped) {
      updates[`programAccess.${ent.program}.fullPaidAt`] = new Date();
    }
  }

  if (ent.leadStatus) updates.zohoLeadStatus = ent.leadStatus;
  if (ent.lmsUsername) updates.lmsUsername = ent.lmsUsername.toLowerCase();
  if (ent.zohoLeadId) updates.zohoLeadId = ent.zohoLeadId;
  if (record?.LMS_User_Id) updates.moodleUserId = String(record.LMS_User_Id);
  if (record?.id) updates.zohoIlUserId = String(record.id);
  if (ent.displayName && !profile.displayName) updates.displayName = ent.displayName;

  const batch = record?.batch || record?.Batch;
  if (isValidBatchName(batch)) updates.batchName = batch.toString().trim();

  await db.collection('users').doc(uid).update(updates);

  let merged = { ...profile, ...updates };
  const programForEnrollment = staffProgramLocked
    ? profile.program
    : ent.program || updates.program;
  if (programForEnrollment && !staffProgramLocked) {
    merged = await ensureCourseEnrollment(db, uid, merged, programForEnrollment);
  }

  const resolvedProgram = staffProgramLocked
    ? profile.program || ent.program
    : updates.program || ent.program;

  const mergedEnt = {
    ...ent,
    program: resolvedProgram,
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

async function provisionFromRecord(
  db,
  record,
  { applyPassword = true, skipUnpaidCheck = false } = {}
) {
  const ent = parseEntitlementsFromRecord(record);
  if (!ent.email) return { ok: false, reason: 'No email on record' };

  if (!skipUnpaidCheck && ent.paymentStatus === PAYMENT_STATUS.UNPAID) {
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

async function provisionUserFromEmail(
  db,
  getLeadByEmail,
  searchIlUserByEmail,
  email,
  webhookBody = null
) {
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

/**
 * Refresh an existing learner's entitlements from Zoho — nothing else.
 *
 * For a CX edit to Lead Status, full provisioning is the wrong tool: it
 * refuses anything that resolves to unpaid, so a correction or a move back to
 * Follow up would apply nothing at all; it creates an account for a lead who
 * is not a learner yet; and it runs the password logic on what is only a
 * status change.
 *
 * This applies the entitlements and stops. No account creation, no password,
 * no unpaid gate — that gate exists to stop unpaid leads becoming accounts,
 * and someone who already has one should follow their status wherever it goes,
 * downgrades included.
 */
async function syncEntitlementsFromZoho(db, getLeadByEmail, searchIlUserByEmail, email, body, deps) {
  const trimmed = email?.trim();
  if (!trimmed) return { ok: false, reason: 'Email is required' };

  const lookupAuthUser = deps?.getAuthUserByEmail || getAuthUserByEmail;
  const existing = await lookupAuthUser(trimmed);
  if (!existing) {
    return { ok: false, reason: 'No LMS account for this email — nothing to refresh' };
  }

  const [lead, ilUser] = await Promise.all([
    getLeadByEmail(trimmed).catch(() => null),
    searchIlUserByEmail(trimmed).catch(() => null),
  ]);
  if (!lead && !ilUser && !body) {
    return { ok: false, reason: 'No Zoho Lead or IL_Users record found for this email' };
  }

  const record = mergeProvisioningRecord(lead, ilUser, body);
  const snap = await db.collection('users').doc(existing.uid).get();
  const applied = await applyEntitlements(db, existing.uid, record, snap.data() || {});
  return { ok: true, uid: existing.uid, mode: 'entitlements', ...applied };
}

async function provisionFromRegistrationWebhook(db, body, deps) {
  const email = (body?.email || body?.Email || '').trim();
  if (!email) return { ok: false, reason: 'email is required in webhook body' };

  return provisionUserFromEmail(db, deps.getLeadByEmail, deps.searchIlUserByEmail, email, body);
}

/**
 * Does this password match what Zoho holds for the learner?
 *
 * Both fields are checked rather than preferring one. IL_Users carries the
 * credential twice while old Moodle is live: this LMS writes LMS_Password (and
 * Password alongside it), and a change made in Moodle comes back into Password
 * alone. Reading `LMS_Password || Password` meant a stale LMS_Password won on
 * truthiness, so anyone who had changed their password in Moodle was told it
 * did not match and could not sign in here at all.
 *
 * The cost is that a superseded value keeps working until both fields agree.
 * That is the right trade while two systems share one credential — a learner
 * locked out of the new LMS has no way forward, and the fields converge on the
 * next sync either way.
 */
function matchesStoredCredential(ilUser, password) {
  const candidate = String(password || '').trim();
  if (!candidate) return false;
  return [ilUser?.LMS_Password, ilUser?.Password]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .includes(candidate);
}

/** First login — create Firebase user when Zoho IL_Users credentials match. */
async function provisionFromLoginCredentials(db, email, password, deps) {
  const trimmedEmail = email?.trim();
  const trimmedPassword = password?.trim();
  if (!trimmedEmail || !trimmedPassword || trimmedPassword.length < 6) {
    return { ok: false, reason: 'Email and password are required' };
  }

  const ilUser = await deps.findIlUserRecord(trimmedEmail, trimmedEmail, deps, {});
  if (!ilUser) return { ok: false, reason: 'No IL_Users record for this email' };

  if (!matchesStoredCredential(ilUser, trimmedPassword)) {
    return { ok: false, reason: 'Password does not match Zoho IL_Users record' };
  }

  const lookupAuthUser = deps?.getAuthUserByEmail || getAuthUserByEmail;
  const existing = await lookupAuthUser(trimmedEmail);
  if (existing) {
    /*
     * The learner has proved they know the credential Zoho holds, but Firebase
     * is still on an older one. That is what a password change in Moodle looks
     * like from here: Moodle writes it back to IL_Users and never touches
     * Firebase, so the two drift apart and sign-in keeps failing.
     *
     * Returning success without reconciling them left the learner with no way
     * in at all — the caller retries the sign-in, Firebase rejects the same
     * password again, and nothing else in the system ever closes the gap.
     *
     * Safe because the password was matched against Zoho a few lines above, so
     * whoever is asking already knows it. While Moodle is live and the two
     * systems share one credential, Zoho is the record of truth.
     */
    const setPassword = deps?.updateAuthPassword || defaultUpdateAuthPassword;
    await setPassword(existing.uid, trimmedPassword);
    return { ok: true, alreadyExists: true, uid: existing.uid, passwordSynced: true };
  }

  const record = mergeProvisioningRecord(null, ilUser, {
    email: trimmedEmail,
    password: trimmedPassword,
    username: ilUser.Username || trimmedEmail,
  });
  if (!record.LMS_Payment_Status) {
    record.LMS_Payment_Status = 'register';
  }

  return provisionFromRecord(db, record, { applyPassword: true, skipUnpaidCheck: true });
}

module.exports = {
  mergeProvisioningRecord,
  parseEntitlementsFromRecord,
  applyEntitlements,
  /** @deprecated alias — use applyEntitlements */
  applyEntitlementsFromLead: applyEntitlements,
  provisionFromRecord,
  provisionUserFromLead,
  provisionUserFromEmail,
  syncEntitlementsFromZoho,
  provisionFromRegistrationWebhook,
  provisionFromLoginCredentials,
  matchesStoredCredential,
  ensureCourseEnrollment,
  shouldApplyProvisioningPassword,
  isValidBatchName,
};
