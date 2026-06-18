/* Timezone math using the browser's built-in IANA database (Intl). No external data. */

const partsCache = new Map();
function dtf(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(tz, new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }));
  }
  return partsCache.get(tz);
}

// Wall-clock parts of `date` (a Date / epoch ms) in time zone `tz`.
export function zonedParts(tz, date) {
  const p = dtf(tz).formatToParts(date);
  const g = (t) => +p.find((x) => x.type === t).value;
  return { year: g("year"), month: g("month"), day: g("day"), hour: g("hour"), minute: g("minute"), second: g("second") };
}

// UTC offset (minutes) of `tz` at instant `date`.
export function offsetMinutes(tz, date = new Date()) {
  const p = zonedParts(tz, date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - (date instanceof Date ? date.getTime() : date)) / 60000);
}

export function offsetLabel(tz, date = new Date()) {
  const m = offsetMinutes(tz, date);
  const sign = m >= 0 ? "+" : "-";
  const a = Math.abs(m);
  const hh = String(Math.floor(a / 60)).padStart(2, "0");
  const mm = String(a % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

// Format a time string for `tz`.
export function formatTime(tz, date, h12) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: h12 ? "h12" : "h23" }).format(date);
}
export function formatDate(tz, date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(date);
}

// The UTC instant of "today's midnight" in `tz`, relative to `now`.
export function midnightInstant(tz, now = new Date()) {
  const p = zonedParts(tz, now);
  const msSinceMidnight = ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + now.getMilliseconds();
  return now.getTime() - msSinceMidnight;
}

export function localZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
}
