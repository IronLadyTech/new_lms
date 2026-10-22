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
  PROGRAM_LENGTH_MONTHS,
} = require('./accessTiers');
const { parseLeadEntitlements, inferFromLeadStatus } = require('./zohoFieldMap');
const { ilUserToCredentialFields } = require('./zohoIlUsers');
const { registrationToBatchRecord } = require('./zohoIlRegistration');

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

  /*
   * A caller that states the status explicitly is telling us something the
   * fetched lead may not carry — the Lead Status rule posts it, and if the lead
   * lookup returns nothing (deleted, renamed, a Zoho hiccup) this was the only
   * copy. It was dropped, so the sync silently applied an unpaid record instead
   * of the status it had been handed.
   */
  if (webhookBody?.Lead_Status) merged.Lead_Status = webhookBody.Lead_Status;

  const fromWebhookPayment = paymentStatusFromRegistrationPayload(webhookBody ?? {});
  if (fromWebhookPayment) {
    // The per-programme fields are more specific than a flat status, so they win.
    merged.LMS_Payment_Status = fromWebhookPayment;
  } else if (webhookBody?.LMS_Payment_Status) {
    merged.LMS_Payment_Status = webhookBody.LMS_Payment_Status;
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

/** Zoho date → YYYY-MM-DD (Leads return ISO or dd/mm/yyyy). */
function zohoDateToIso(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    if (dmy) {
      return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${m}-${d}`;
  }
  return '';
}

/**
 * Copy LEP / 100BM start·end + Month_B_HAG onto the LMS user doc so the app
 * can read them after refreshMyAccess (without a full Lead snapshot).
 *
 * LEP: LEP_Reg_Date (start), LEP_End_Date, LEP_Batch, Month_B_HAG
 * 100BM: BM_Reg_Date1, BM_End_Date, BM_Batch
 */
function applyZohoProgramDatesToUpdates(updates, record, profile = {}) {
  if (!record || typeof record !== 'object') return;

  const lepBatch = String(record.LEP_Batch || '').trim();
  const lepStart = zohoDateToIso(record.LEP_Reg_Date);
  const lepEnd = zohoDateToIso(record.LEP_End_Date);
  if (lepBatch || lepStart || lepEnd) {
    const prev = profile.programAccess?.lep || {};
    if (isValidBatchName(lepBatch)) {
      updates['programAccess.lep.zohoRawBatch'] = lepBatch;
      updates['programAccess.lep.zohoBatchKey'] = lepBatch;
      updates['programAccess.lep.batchName'] = lepBatch;
    }
    if (lepStart) updates['programAccess.lep.day1Date'] = lepStart;
    if (lepEnd) updates['programAccess.lep.endDate'] = lepEnd;
    // Keep a small Lead bag for app readLeadField (Month_B_HAG / LEP_Reg_Date).
    updates.zohoLead = {
      ...(profile.zohoLead || {}),
      ...(lepBatch ? { LEP_Batch: lepBatch } : {}),
      ...(lepStart ? { LEP_Reg_Date: lepStart } : {}),
      ...(lepEnd ? { LEP_End_Date: lepEnd } : {}),
      id: record.id || profile.zohoLeadId || prev.zohoLeadId || null,
    };
  }

  const bmBatch = String(record.BM_Batch || '').trim();
  const bmStart = zohoDateToIso(record.BM_Reg_Date1);
  const bmEnd = zohoDateToIso(record.BM_End_Date);
  if (bmBatch || bmStart || bmEnd) {
    if (isValidBatchName(bmBatch)) {
      updates['programAccess.100bm.zohoRawBatch'] = bmBatch;
      updates['programAccess.100bm.zohoBatchKey'] = bmBatch;
      updates['programAccess.100bm.batchName'] = bmBatch;
    }
    if (bmStart) updates['programAccess.100bm.startDate'] = bmStart;
    if (bmEnd) updates['programAccess.100bm.endDate'] = bmEnd;
    updates.zohoLead = {
      ...(updates.zohoLead || profile.zohoLead || {}),
      ...(bmBatch ? { BM_Batch: bmBatch } : {}),
      ...(bmStart ? { BM_Reg_Date1: bmStart } : {}),
      ...(bmEnd ? { BM_End_Date: bmEnd } : {}),
    };
  }

  const bhag = String(record.Month_B_HAG || record.LMS_BHAG || '').trim();
  if (bhag && !/^(yes|no|done|completed)$/i.test(bhag)) {
    updates.bhag = bhag;
    updates.zohoLead = {
      ...(updates.zohoLead || profile.zohoLead || {}),
      Month_B_HAG: bhag,
    };
  }

  const city = String(record.City || '').trim();
  if (city) updates.city = city;
  const domain = String(record.Industry || record.LMS_Domain || '').trim();
  if (domain) {
    updates.domain = domain;
    updates.leadershipRole = domain;
  }
}

function isValidBatchName(batch) {
  // Returns a boolean, not the trimmed string: a predicate whose false value is
  // '' reads as valid to anything comparing against false.
  const b = (batch || '').toString().trim();
  return Boolean(b) && b !== '#batch' && !b.includes('$');
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

/**
 * Programmes named on an IL_Users record.
 *
 * Program_Registration_Details is the list the old LMS maintained — it added a
 * name when someone registered and stripped one out on a completed refund.
 * Lead Status only ever names the programme the learner is currently moving
 * through, so reading that alone loses every earlier enrolment: somebody at
 * "100 BM Enrolled" who finished LEP last year looks like a 100BM learner and
 * nothing else.
 */
function programmesNamedOnRecord(record) {
  return [record?.Program_Registration_Details, record?.Program_Enrollment_Details]
    .flatMap((v) => String(v || '').split(','))
    .map((v) => normalizeProgram(v.trim()))
    .filter(Boolean);
}

function paymentFromRegistrationRow(statusRaw, programRaw) {
  const fromStatus = inferFromLeadStatus(statusRaw);
  if (fromStatus?.paymentStatus) return normalizePaymentStatus(fromStatus.paymentStatus);
  if (programRaw && String(programRaw).trim()) return PAYMENT_STATUS.REGISTER;
  return PAYMENT_STATUS.UNPAID;
}

function unionCommaPrograms(...lists) {
  const ids = new Set();
  for (const list of lists) {
    String(list || '')
      .split(',')
      .map((part) => normalizeProgram(part.trim()))
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  return [...ids].join(', ');
}

/** Merge every IL_Registration row for one email into programme lists. */
function aggregateProgramsFromIlRegistrations(registrations = []) {
  const registered = new Set();
  const enrolled = new Set();

  for (const reg of registrations) {
    const mapped = registrationToBatchRecord(reg);
    const prog = normalizeProgram(
      mapped.Program_Registration_Details || mapped.Program || reg.Program
    );
    if (!prog) continue;

    const tier = paymentFromRegistrationRow(
      mapped._status,
      mapped.Program_Registration_Details || reg.Program
    );
    registered.add(prog);
    if (tier === PAYMENT_STATUS.PAID) enrolled.add(prog);
  }

  return {
    Program_Registration_Details: [...registered].join(', '),
    Program_Enrollment_Details: [...enrolled].join(', '),
  };
}

function enrichRecordWithAllZohoEnrollments(
  record,
  { ilRegistrations = [], ilUsers = [] } = {}
) {
  const fromRegs = aggregateProgramsFromIlRegistrations(ilRegistrations);
  /*
   * Keep IL Users registration vs enrolment lists separate. Flattening every
   * named programme into registration only made fully-enrolled MBW rows look
   * registration-tier and blocked Q2+ even when Enrollment Details named MBW.
   */
  const fromUsersReg = ilUsers
    .map((user) => user?.Program_Registration_Details)
    .filter(Boolean)
    .join(', ');
  const fromUsersEnr = ilUsers
    .map((user) => user?.Program_Enrollment_Details)
    .filter(Boolean)
    .join(', ');

  const mergedReg = unionCommaPrograms(
    record?.Program_Registration_Details,
    fromRegs.Program_Registration_Details,
    fromUsersReg
  );
  const mergedEnr = unionCommaPrograms(
    record?.Program_Enrollment_Details,
    fromRegs.Program_Enrollment_Details,
    fromUsersEnr
  );

  if (!mergedReg && !mergedEnr) return record;

  return {
    ...record,
    ...(mergedReg ? { Program_Registration_Details: mergedReg } : {}),
    ...(mergedEnr ? { Program_Enrollment_Details: mergedEnr } : {}),
  };
}

/**
 * Per-programme tiers, read rather than inferred.
 *
 * Zoho states this outright on IL Users and always has: a programme named in
 * Program_Registration_Details has had its registration fee paid, and one named
 * in Program_Enrollment_Details has been paid in full. Two fields, per
 * programme, no ambiguity.
 *
 * The LMS was reconstructing the same answer by pattern-matching Lead Status
 * text — from Leads, the one module that auto-creates a duplicate record on
 * every conversion and is authoritative for nobody. That guessing is what let a
 * learner registered for two programmes and enrolled in one read as a single
 * flat tier applied to both.
 *
 * Enrolment wins where a programme appears in both lists: it is the later and
 * larger payment, and the registration entry is never removed when someone goes
 * on to pay in full.
 *
 * Returns null — not an empty object — when the record names neither list, so
 * the caller can tell "Zoho says nothing here" from "Zoho says no programmes"
 * and fall back to the Lead Status reading instead of revoking everything.
 */
function tiersFromProgrammeLists(record) {
  /*
   * Restricted to the programmes we actually run. normalizeProgram lowercases
   * whatever it is handed rather than refusing an unknown name, so without this
   * a stray "Executive Bootcamp" becomes a programme id that no access check
   * can ever satisfy and no entry can ever match.
   */
  const known = new Set(Object.keys(PROGRAM_LENGTH_MONTHS));
  const split = (v) =>
    String(v || '')
      .split(',')
      .map((x) => normalizeProgram(String(x).trim()))
      .filter((id) => known.has(id));

  const registered = split(record?.Program_Registration_Details);
  const enrolled = split(record?.Program_Enrollment_Details);
  if (!registered.length && !enrolled.length) return null;

  const tiers = {};
  for (const id of registered) tiers[id] = PAYMENT_STATUS.REGISTER;
  for (const id of enrolled) tiers[id] = PAYMENT_STATUS.PAID;
  return tiers;
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
  /*
   * A completed refund is the one thing that must lower a tier. Everything else
   * ratchets upward so a webhook replay cannot demote anybody, and that same
   * guard is why nothing could revoke access: maxPaymentStatus would keep the
   * old paid value forever.
   *
   * The programme is removed from the enrolment lists too, matching the old
   * LMS, which stripped the name from Program Registration Details. The account
   * itself stays — the old system deleted the user when it was their only
   * programme, and losing submissions and history to a refund is not worth it.
   */
  /*
   * Union rather than replace: the record names what Zoho knows about, and a
   * learner may hold a programme granted in the LMS that Zoho has not caught up
   * with. Nothing is dropped here — only a refund removes a programme, below.
   */
  const namedProgrammes = programmesNamedOnRecord(record);
  if (namedProgrammes.length) {
    const merged = Array.from(new Set([...(profile.programs || []), ...namedProgrammes]));
    const prev = new Set(profile.programs || []);
    const changed =
      merged.length !== prev.size || merged.some((id) => !prev.has(id));
    if (changed) updates.programs = merged;
  }

  const refundedProgram = ent.refund === 'completed' && ent.program ? ent.program : null;
  if (refundedProgram) {
    updates[`programAccess.${refundedProgram}.paymentStatus`] = PAYMENT_STATUS.UNPAID;
    updates[`programAccess.${refundedProgram}.refundedAt`] = new Date();
    updates[`programAccess.${refundedProgram}.fullPaidAt`] = null;

    const before = updates.programs || profile.programs || [];
    const keptPrograms = before.filter((p) => p !== refundedProgram);
    if (keptPrograms.length !== before.length) {
      updates.programs = keptPrograms;
    }
    if (profile.program === refundedProgram) {
      updates.program = keptPrograms[0] || null;
    }

    // enrolledCourses holds course document ids, not codes, so the id has to be
    // looked up before anything can be removed from the list.
    const code = PROGRAM_COURSE_CODE[refundedProgram];
    const courseId = code ? await getCourseIdByCode(db, code) : null;
    if (courseId) {
      const keptCourses = (profile.enrolledCourses || []).filter((id) => id !== courseId);
      if (keptCourses.length !== (profile.enrolledCourses || []).length) {
        updates.enrolledCourses = keptCourses;
      }
    }

    /*
     * The flat field is set above by the ratchet, which cannot fall. Left alone
     * it would still read "paid" after a refund and mislead every CX screen
     * that shows it. Recomputed from whatever programmes remain.
     */
    const remaining = { ...(profile.programAccess || {}) };
    delete remaining[refundedProgram];
    const highest = Object.values(remaining)
      .map((entry) => entry?.paymentStatus)
      .filter(Boolean)
      .reduce((best, next) => maxPaymentStatus(best, next), PAYMENT_STATUS.UNPAID);
    updates.paymentStatus = highest;
    updates.accessTier = accessTierFromPaymentStatus(highest);
  }

  /*
   * The authoritative reading, when Zoho gives us one. Every programme named on
   * the record is written at its own tier, so a learner registered for two and
   * enrolled in one ends up with exactly that — rather than one tier inferred
   * from a status string and applied to whichever programme it mentioned.
   *
   * Still ratchets within each programme, so a replay cannot demote anybody,
   * and a programme refunded in this same pass is left to the refund branch.
   */
  const listedTiers = tiersFromProgrammeLists(record);
  if (listedTiers) {
    const tierProgramIds = Object.keys(listedTiers).filter((id) => id !== refundedProgram);
    if (tierProgramIds.length) {
      const mergedPrograms = Array.from(
        new Set([...(updates.programs || profile.programs || []), ...tierProgramIds])
      );
      const prevPrograms = new Set(profile.programs || []);
      const programsChanged =
        mergedPrograms.length !== prevPrograms.size ||
        mergedPrograms.some((id) => !prevPrograms.has(id));
      if (programsChanged) updates.programs = mergedPrograms;
    }

    for (const [programId, tier] of Object.entries(listedTiers)) {
      if (programId === refundedProgram) continue;
      const previous = profile.programAccess?.[programId]?.paymentStatus;
      const resolved = maxPaymentStatus(previous, tier);
      updates[`programAccess.${programId}.paymentStatus`] = resolved;
      if (
        resolved === PAYMENT_STATUS.PAID &&
        !profile.programAccess?.[programId]?.fullPaidAt
      ) {
        updates[`programAccess.${programId}.fullPaidAt`] = new Date();
      }
    }
  }

  if (!refundedProgram && ent.paymentStatus && ent.program) {
    /*
     * Recorded against the programme it was paid for. Zoho already tracks these
     * separately — lepPaymentStatus, hundredBMPaymentStatus, MBWPaymentStatus —
     * and flattening them into one profile field meant the highest tier leaked
     * everywhere, so paying for LEP unlocked the whole of 100BM.
     *
     * Still ratchets upward, but only within this programme — and against any
     * tier already written from Programme lists in this same pass, so a
     * registration-only Payment_Status field cannot overwrite an enrolment
     * list that already said paid.
     */
    const previous = maxPaymentStatus(
      profile.programAccess?.[ent.program]?.paymentStatus,
      updates[`programAccess.${ent.program}.paymentStatus`]
    );
    updates[`programAccess.${ent.program}.paymentStatus`] = maxPaymentStatus(
      previous,
      ent.paymentStatus
    );
  }

  // Not for a programme just refunded: the flat status may still be paid
  // because another programme survives, which would re-stamp the refunded one.
  if (!refundedProgram && updates.paymentStatus === PAYMENT_STATUS.PAID && ent.program) {
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

  const batch = record?.batch || record?.Batch || record?.LEP_Batch || record?.BM_Batch;
  if (isValidBatchName(batch)) updates.batchName = batch.toString().trim();

  // Program dates + B-HAG from Zoho Leads (app reads these on refreshMyAccess).
  applyZohoProgramDatesToUpdates(updates, record, profile);

  /*
   * Stamp where this write came from.
   *
   * Entitlements land on program / paymentStatus / accessTier, which are the
   * very fields onUserProfileZohoSync watches. Without this marker an inbound
   * change from Zoho triggers an outbound upsert straight back to Zoho, which
   * makes Zoho fire the webhook again — each round costing several API calls
   * for information Zoho already had.
   */
  updates.zohoWriteOrigin = 'zoho';
  updates.zohoWriteOriginAt = Date.now();

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
  webhookBody = null,
  deps = {}
) {
  const trimmed = email?.trim();
  if (!trimmed) return { ok: false, reason: 'Email is required' };

  const searchAllRegs = deps.searchAllIlRegistrationsByEmail;
  const searchAllUsers = deps.searchAllIlUsersByEmail;

  const [lead, ilUser, allRegs, allIlUsers] = await Promise.all([
    getLeadByEmail(trimmed).catch(() => null),
    searchIlUserByEmail(trimmed).catch(() => null),
    searchAllRegs ? searchAllRegs(trimmed).catch(() => []) : Promise.resolve([]),
    searchAllUsers ? searchAllUsers(trimmed).catch(() => []) : Promise.resolve([]),
  ]);

  if (!lead && !ilUser && !allRegs.length && !webhookBody?.password) {
    return { ok: false, reason: 'No Zoho Lead or IL_Users record found for this email' };
  }

  let record = mergeProvisioningRecord(lead, ilUser, webhookBody);
  record = enrichRecordWithAllZohoEnrollments(record, {
    ilRegistrations: allRegs,
    ilUsers: allIlUsers.length ? allIlUsers : ilUser ? [ilUser] : [],
  });
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
    /*
     * Not every Lead Status change is about a learner. The MC stages are the
     * masterclass funnel: they name no programme and grant no access, so there
     * is nothing to apply and no LMS account is expected. Reporting that as a
     * failure sent CX an alert mail for every masterclass lead whose status
     * moved, which buries the failures that matter.
     *
     * A status that does name a programme is the opposite case — somebody
     * enrolled with no LMS account is a real gap — so that still reports.
     * An absent status reports too: unknown is not the same as harmless.
     */
    const status = body?.Lead_Status || body?.leadStatus || null;
    if (status && !inferFromLeadStatus(status)?.program) {
      return {
        ok: true,
        skipped: 'no-account-and-none-expected',
        leadStatus: status,
        reason: `${status} grants no programme access — nothing to apply`,
      };
    }

    /*
     * A status naming a programme says this person registered, so an account
     * should exist. Refusing here made that permanent: the registration webhook
     * is the only thing that ever creates one, and if it missed — a deploy, a
     * timeout, a workflow that did not fire — nothing tried again. Learners sat
     * unable to log in while CX received the same alert on every status edit.
     *
     * Provisioning reads IL_Registration, which is where the credentials
     * actually live, so a status change can now heal the gap instead of only
     * reporting it. Guarded so this runs once: if provisioning succeeds the
     * account exists and the ordinary path below applies the entitlements.
     */
    if (deps?.provisionMissing && !deps.__healed) {
      const created = await deps.provisionMissing(trimmed).catch((err) => ({
        ok: false,
        reason: err?.message || 'provisioning failed',
      }));
      if (created?.ok) {
        return syncEntitlementsFromZoho(db, getLeadByEmail, searchIlUserByEmail, email, body, {
          ...deps,
          __healed: true,
        });
      }
      return {
        ok: false,
        reason: `No LMS account for this email, and provisioning it failed: ${
          created?.reason || 'unknown reason'
        }`,
      };
    }

    return { ok: false, reason: 'No LMS account for this email — nothing to refresh' };
  }

  const searchAllRegs = deps?.searchAllIlRegistrationsByEmail;
  const searchAllUsers = deps?.searchAllIlUsersByEmail;

  const [lead, ilUser, allRegs, allIlUsers] = await Promise.all([
    getLeadByEmail(trimmed).catch(() => null),
    searchIlUserByEmail(trimmed).catch(() => null),
    searchAllRegs ? searchAllRegs(trimmed).catch(() => []) : Promise.resolve([]),
    searchAllUsers ? searchAllUsers(trimmed).catch(() => []) : Promise.resolve([]),
  ]);
  if (!lead && !ilUser && !allRegs.length && !body) {
    return { ok: false, reason: 'No Zoho Lead or IL_Users record found for this email' };
  }

  let record = mergeProvisioningRecord(lead, ilUser, body);
  record = enrichRecordWithAllZohoEnrollments(record, {
    ilRegistrations: allRegs,
    ilUsers: allIlUsers.length ? allIlUsers : ilUser ? [ilUser] : [],
  });
  const snap = await db.collection('users').doc(existing.uid).get();
  const applied = await applyEntitlements(db, existing.uid, record, snap.data() || {});
  return { ok: true, uid: existing.uid, mode: 'entitlements', ...applied };
}

async function provisionFromRegistrationWebhook(db, body, deps) {
  const email = (body?.email || body?.Email || '').trim();
  if (!email) return { ok: false, reason: 'email is required in webhook body' };

  return provisionUserFromEmail(
    db,
    deps.getLeadByEmail,
    deps.searchIlUserByEmail,
    email,
    body,
    deps
  );
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
  tiersFromProgrammeLists,
  enrichRecordWithAllZohoEnrollments,
  /** Used by the reconciler to tell a missing account from an existing one. */
  getAuthUserByEmail,
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
