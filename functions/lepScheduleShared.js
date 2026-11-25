/* GENERATED from app-new utils/lepBatchSchedule.js + constants/lepSessionTemplate.js — do not edit here.
   Rebuild: npx esbuild utils/lepBatchSchedule.js --bundle --format=cjs --platform=node (in app-new). */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// utils/lepBatchSchedule.js
var lepBatchSchedule_exports = {};
__export(lepBatchSchedule_exports, {
  addCalendarDays: () => addCalendarDays,
  buildLepBatchSessions: () => buildLepBatchSessions,
  day1FromOrientationThursday: () => day1FromOrientationThursday,
  describeBatchAnchor: () => describeBatchAnchor,
  formatDateIST: () => formatDateIST,
  mergeCustomSessions: () => mergeCustomSessions,
  orientationFromDay1Saturday: () => orientationFromDay1Saturday,
  parseISODate: () => parseISODate,
  toISTIso: () => toISTIso
});
module.exports = __toCommonJS(lepBatchSchedule_exports);

// constants/lepSessionTemplate.js
var LEP_TIMEZONE = "Asia/Kolkata";
var LEP_SESSION_TEMPLATE = [
  {
    code: "S0",
    title: "Orientation (B/W)",
    kind: "core",
    dayOffset: -2,
    startTime: "19:00",
    endTime: "20:00",
    weekLabel: "Pre-program"
  },
  {
    code: "S1",
    title: "Full Day Session \u2014 Day 1",
    kind: "core",
    dayOffset: 0,
    startTime: "09:00",
    endTime: "19:00",
    weekLabel: "Week 0"
  },
  {
    code: "S2",
    title: "Full Day Session \u2014 Day 2",
    kind: "core",
    dayOffset: 1,
    startTime: "09:00",
    endTime: "19:00",
    weekLabel: "Week 0"
  },
  {
    code: "S3",
    title: "Closure Session (Completion & Review)",
    kind: "core",
    dayOffset: 3,
    startTime: "19:00",
    endTime: "20:30",
    weekLabel: "Week 1"
  },
  {
    code: "FT",
    title: "Fast Track Session",
    kind: "optional",
    dayOffset: 5,
    startTime: "19:00",
    endTime: "20:00",
    weekLabel: "Week 1"
  },
  {
    code: "PTW",
    title: "Prepare to Win \u2014 Week 1",
    kind: "optional",
    dayOffset: 6,
    startTime: "20:00",
    endTime: "21:00",
    weekLabel: "Week 1",
    ptwWeek: 1
  },
  {
    code: "S4",
    title: "Differentiated Brand",
    kind: "core",
    dayOffset: 7,
    startTime: "09:00",
    endTime: "11:00",
    weekLabel: "Week 1"
  },
  {
    code: "S6",
    title: "Progress Check",
    kind: "core",
    dayOffset: 11,
    startTime: "19:00",
    endTime: "20:30",
    weekLabel: "Week 2"
  },
  {
    code: "PTW2",
    title: "Prepare to Win \u2014 Week 2",
    kind: "optional",
    dayOffset: 13,
    startTime: "20:00",
    endTime: "21:00",
    weekLabel: "Week 2",
    ptwWeek: 2,
    notifyRef: "PTW"
  },
  {
    code: "S5",
    title: "Shameless Pitch",
    kind: "core",
    dayOffset: 14,
    startTime: "18:30",
    endTime: "20:30",
    weekLabel: "Week 2"
  },
  {
    code: "PTW3",
    title: "Prepare to Win \u2014 Week 3",
    kind: "optional",
    dayOffset: 20,
    startTime: "20:00",
    endTime: "21:00",
    weekLabel: "Week 3",
    ptwWeek: 3,
    notifyRef: "PTW"
  },
  {
    code: "S7",
    title: "Leadership Habits",
    kind: "core",
    dayOffset: 21,
    startTime: "09:00",
    endTime: "11:00",
    weekLabel: "Week 3"
  },
  {
    code: "PTW4",
    title: "Prepare to Win \u2014 Week 4",
    kind: "optional",
    dayOffset: 27,
    startTime: "20:00",
    endTime: "21:00",
    weekLabel: "Week 4",
    ptwWeek: 4,
    notifyRef: "PTW"
  },
  {
    code: "S8",
    title: "Graduation (Certification)",
    kind: "core",
    dayOffset: 28,
    startTime: "19:30",
    endTime: "20:30",
    weekLabel: "Week 4"
  }
];

// utils/lepBatchSchedule.js
function formatDateIST(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${day}`;
}
function parseISODate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}
function addCalendarDays(dateStr, days) {
  const d = parseISODate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateIST(d);
}
function day1FromOrientationThursday(orientationDate) {
  return addCalendarDays(orientationDate, 2);
}
function orientationFromDay1Saturday(day1Date) {
  return addCalendarDays(day1Date, -2);
}
function toISTIso(dateStr, timeStr) {
  const [hh, mm] = timeStr.split(":").map((x) => parseInt(x, 10));
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const utcMs = Date.UTC(y, m - 1, d, hh - 5, mm - 30, 0);
  return new Date(utcMs).toISOString();
}
function buildLepBatchSessions(opts) {
  const day1 = opts.anchor === "orientation" ? day1FromOrientationThursday(opts.date) : opts.date;
  const orientation = opts.anchor === "day1" ? orientationFromDay1Saturday(opts.date) : opts.date;
  return LEP_SESSION_TEMPLATE.map((t) => {
    const sessionDate = addCalendarDays(day1, t.dayOffset);
    const joinLink = opts.joinLinks?.[t.code] || opts.joinLinks?.[t.notifyRef || t.code] || "";
    return {
      code: t.code,
      title: t.title,
      kind: t.kind,
      weekLabel: t.weekLabel,
      dayOffset: t.dayOffset,
      date: sessionDate,
      startTime: t.startTime,
      endTime: t.endTime,
      startAt: toISTIso(sessionDate, t.startTime),
      endAt: toISTIso(sessionDate, t.endTime),
      joinLink,
      notifyRef: t.notifyRef || t.code
    };
  });
}
function describeBatchAnchor(batch) {
  if (!batch?.day1Date) return "";
  return `Day 1 (Sat): ${batch.day1Date} \xB7 Orientation (Thu): ${batch.orientationDate || orientationFromDay1Saturday(batch.day1Date)}`;
}
function mergeCustomSessions(built, previous = []) {
  const prevByCode = Object.fromEntries((previous || []).filter((s) => s?.code).map((s) => [s.code, s]));
  const builtCodes = new Set(built.map((s) => s.code));
  const merged = built.map((row) => {
    const prev = prevByCode[row.code];
    if (!prev) return row;
    const out = {
      ...row,
      title: prev.title || row.title,
      joinLink: prev.joinLink || row.joinLink || "",
      ...prev.cancelled ? { cancelled: true } : {}
    };
    if (prev.custom && prev.date) {
      const startTime = prev.startTime || row.startTime;
      const endTime = prev.endTime || row.endTime;
      Object.assign(out, {
        custom: true,
        date: prev.date,
        startTime,
        endTime,
        startAt: toISTIso(prev.date, startTime),
        endAt: toISTIso(prev.date, endTime)
      });
    }
    return out;
  });
  const extras = (previous || []).filter((s) => s?.code && s.extra && !builtCodes.has(s.code));
  return [...merged, ...extras].sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addCalendarDays,
  buildLepBatchSessions,
  day1FromOrientationThursday,
  describeBatchAnchor,
  formatDateIST,
  mergeCustomSessions,
  orientationFromDay1Saturday,
  parseISODate,
  toISTIso
});
