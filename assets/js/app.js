import { CITIES, flagEmoji } from "./cities.js";
import { zonedParts, offsetLabel, formatTime, formatDate, midnightInstant, localZone } from "./tz.js";

const $ = (s) => document.querySelector(s);

// ---------- state ----------
const KEY = "worldclock:v1";
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.cities) && s.cities.length) return { fmt12: false, workStart: 9, workEnd: 18, ...s };
  } catch { /* ignore */ }
  // seed: local zone + a few hubs
  const tz = localZone();
  const here = CITIES.find((c) => c.tz === tz) || { city: "Local", country: "Your location", cc: "", tz };
  const seed = [here, ...["America/New_York", "Europe/London", "Asia/Tokyo"].map((t) => CITIES.find((c) => c.tz === t)).filter(Boolean)];
  const seen = new Set(); const cities = seed.filter((c) => !seen.has(c.city) && seen.add(c.city));
  return { cities, fmt12: false, workStart: 9, workEnd: 18 };
}
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

let pinned = null; // pinned column index in the planner

// ---------- clocks ----------
function dayNight(hr) { return hr >= 6 && hr < 18 ? "☀️" : "🌙"; }
function renderClocks(now = new Date()) {
  const el = $("#clocks");
  if (!state.cities.length) { el.innerHTML = `<div class="empty">Search above to add your first city 🌐</div>`; return; }
  el.innerHTML = state.cities.map((c, i) => {
    const hr = zonedParts(c.tz, now).hour;
    // Always surface AM/PM so 24-hour times stay unambiguous.
    const ampm = state.fmt12 ? "" : ` · ${formatTime(c.tz, now, true)}`;
    return `<article class="clock ${i === 0 ? "ref" : ""}" data-i="${i}">
      <div class="clock-top">
        <span class="flag">${flagEmoji(c.cc)}</span>
        <div class="clock-place"><b>${c.city}</b><small>${c.country}</small></div>
        <div class="clock-acts">
          <button class="mini-btn ${i === 0 ? "on" : ""}" data-act="ref" title="Set as reference">★</button>
          <button class="mini-btn" data-act="remove" title="Remove">✕</button>
        </div>
      </div>
      <div class="clock-time">${formatTime(c.tz, now, state.fmt12)} <span class="dn">${dayNight(hr)}</span></div>
      <div class="clock-meta">${formatDate(c.tz, now)}${ampm} · ${offsetLabel(c.tz, now)}${i === 0 ? " · reference" : ""}</div>
    </article>`;
  }).join("");
}

// ---------- planner ----------
// The planner grid always uses 24-hour numbers (00–23) — unambiguous by design.
// AM/PM-formatted times are shown on the clock cards and the pinned-time detail.
function hourLabel(hr) { return String(hr).padStart(2, "0"); }
function dateNum(p) { return p.year * 10000 + p.month * 100 + p.day; }

function renderPlanner(now = new Date()) {
  const grid = $("#planner");
  const ref = state.cities[0];
  if (!ref) { grid.innerHTML = ""; $("#best").innerHTML = ""; $("#ref-note").textContent = ""; return; }
  $("#ref-note").textContent = `Reference: ${ref.city}`;
  const homeMid = midnightInstant(ref.tz, now);
  const cols = Array.from({ length: 24 }, (_, h) => homeMid + h * 3600000);
  const inRange = (hr) => hr >= state.workStart && hr < state.workEnd;
  const overlap = cols.map((inst) => state.cities.every((c) => inRange(zonedParts(c.tz, inst).hour)));
  const curCol = Math.min(23, Math.max(0, Math.floor((now.getTime() - homeMid) / 3600000)));
  const refDate = dateNum(zonedParts(ref.tz, now));

  let html = `<div class="pg" style="grid-template-columns:170px repeat(24,minmax(34px,1fr))">`;
  // header
  html += `<div class="pg-cell pg-corner">City ↓ / Hour →</div>`;
  for (let h = 0; h < 24; h++) {
    const cls = `${overlap[h] ? "ov" : ""} ${h === curCol ? "cur" : ""} ${h === pinned ? "pin" : ""}`;
    html += `<div class="pg-cell pg-head ${cls}" data-col="${h}">${hourLabel(h)}</div>`;
  }
  // rows
  for (const c of state.cities) {
    html += `<div class="pg-cell pg-label"><span>${flagEmoji(c.cc)} ${c.city}</span><small>${offsetLabel(c.tz, now)}</small></div>`;
    for (let h = 0; h < 24; h++) {
      const p = zonedParts(c.tz, cols[h]);
      const work = inRange(p.hour);
      const dd = dateNum(p) - refDate;
      const tag = dd > 0 ? "<sup>+1</sup>" : dd < 0 ? "<sup>−1</sup>" : "";
      const cls = `${work ? "work" : "off"} ${overlap[h] ? "ov" : ""} ${h === curCol ? "cur" : ""} ${h === pinned ? "pin" : ""}`;
      html += `<div class="pg-cell ${cls}" data-col="${h}">${hourLabel(p.hour)}${tag}</div>`;
    }
  }
  html += `</div>`;
  grid.innerHTML = html;

  renderBest(cols, overlap, homeMid, now);
}

function renderBest(cols, overlap, homeMid, now) {
  const best = $("#best");
  const ref = state.cities[0];
  if (pinned != null) {
    const inst = cols[pinned];
    const rows = state.cities.map((c) =>
      `<li>${flagEmoji(c.cc)} <b>${c.city}</b>: ${formatTime(c.tz, inst, state.fmt12)} · ${formatDate(c.tz, inst)}</li>`).join("");
    best.innerHTML = `<div class="best-card"><h3>📌 Pinned time</h3><ul class="best-list">${rows}</ul>
      <button class="btn ghost sm" id="unpin">Clear pin</button></div>`;
    $("#unpin").addEventListener("click", () => { pinned = null; renderPlanner(); });
    return;
  }
  // overlap ranges in reference time
  const ranges = [];
  let start = null;
  for (let h = 0; h <= 24; h++) {
    if (h < 24 && overlap[h]) { if (start == null) start = h; }
    else if (start != null) { ranges.push([start, h]); start = null; }
  }
  if (!ranges.length) {
    best.innerHTML = `<div class="best-card warn"><h3>😬 No overlap</h3><p>No hour works for everyone within ${state.workStart}:00–${state.workEnd}:00. Try widening working hours or removing a far-off city.</p></div>`;
    return;
  }
  const items = ranges.map(([a, b]) =>
    `<li>✅ <b>${hourLabel(a)}:00 – ${hourLabel(b)}:00</b> in ${ref.city} — works for all ${state.cities.length} cities</li>`).join("");
  best.innerHTML = `<div class="best-card ok"><h3>🟢 Best meeting windows</h3><ul class="best-list">${items}</ul></div>`;
}

// ---------- search ----------
function renderSuggest(q) {
  const box = $("#suggest");
  q = q.trim().toLowerCase();
  if (!q) { box.hidden = true; return; }
  const have = new Set(state.cities.map((c) => c.city));
  const hits = CITIES.filter((c) => !have.has(c.city) && (c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))).slice(0, 8);
  if (!hits.length) { box.innerHTML = `<div class="sg-empty">No match</div>`; box.hidden = false; return; }
  box.innerHTML = hits.map((c) => `<button class="sg" data-city="${c.city}">${flagEmoji(c.cc)} <b>${c.city}</b> <small>${c.country} · ${offsetLabel(c.tz)}</small></button>`).join("");
  box.hidden = false;
}
function addCity(name) {
  const c = CITIES.find((x) => x.city === name);
  if (c && !state.cities.some((x) => x.city === c.city)) { state.cities.push(c); save(); renderAll(); }
  $("#search").value = ""; $("#suggest").hidden = true;
}

// ---------- render ----------
function renderAll() { const now = new Date(); renderClocks(now); renderPlanner(now); }

// ---------- events ----------
$("#search").addEventListener("input", (e) => renderSuggest(e.target.value));
$("#search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { const first = $("#suggest .sg"); if (first) addCity(first.dataset.city); }
  if (e.key === "Escape") $("#suggest").hidden = true;
});
$("#suggest").addEventListener("click", (e) => { const b = e.target.closest("[data-city]"); if (b) addCity(b.dataset.city); });
document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) $("#suggest").hidden = true; });

$("#clocks").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const i = +b.closest("[data-i]").dataset.i;
  if (b.dataset.act === "remove") { state.cities.splice(i, 1); if (pinned != null) pinned = null; }
  else if (b.dataset.act === "ref") { const [c] = state.cities.splice(i, 1); state.cities.unshift(c); }
  save(); renderAll();
});

$("#planner").addEventListener("click", (e) => {
  const c = e.target.closest("[data-col]"); if (!c) return;
  const col = +c.dataset.col; pinned = pinned === col ? null : col; renderPlanner();
});

$("#fmt12").addEventListener("change", (e) => { state.fmt12 = e.target.checked; save(); renderAll(); });
$("#btn-now").addEventListener("click", () => { pinned = null; renderAll(); });
const clampWork = () => {
  state.workStart = Math.min(23, Math.max(0, +$("#work-start").value || 0));
  state.workEnd = Math.min(24, Math.max(state.workStart + 1, +$("#work-end").value || 24));
  $("#work-end").value = state.workEnd; save(); renderPlanner();
};
$("#work-start").addEventListener("change", clampWork);
$("#work-end").addEventListener("change", clampWork);

// ---------- theme ----------
function initTheme() {
  const saved = localStorage.getItem("worldclock-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  setTheme(saved);
  $("#btn-theme").addEventListener("click", () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
}
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  $("#btn-theme").textContent = t === "dark" ? "🌙" : "☀️";
  localStorage.setItem("worldclock-theme", t);
}

// ---------- footer ----------
function renderFooter() {
  const socials = {
    LinkedIn: "https://in.linkedin.com/in/aashana1012",
    GitHub: "https://github.com/aashishbharti04",
    YouTube: "https://www.youtube.com/@CodeWithAsur",
    Instagram: "https://www.instagram.com/asurwave1012",
    Email: "mailto:aashish@marketdoctorsonline.com",
  };
  const ICON = {
    LinkedIn: '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .77 0 1.73v20.54C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>',
    GitHub: '<path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.83 0c2.22-1.5 3.2-1.18 3.2-1.18.63 1.59.23 2.75.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/>',
    YouTube: '<path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"/>',
    Instagram: '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.35 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.12A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z"/>',
    Email: '<path d="M22 4H2C.9 4 0 4.9 0 6v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 4-10 6.25L2 8V6l10 6.25L22 6v2Z"/>',
  };
  const icons = Object.entries(socials).map(([k, u]) =>
    `<a href="${u}" target="_blank" rel="noopener" aria-label="${k}" title="${k}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${ICON[k]}</svg></a>`).join("");
  $("#footer").innerHTML = `
    <div class="footer-inner">
      <span>🌍 <b>WorldClock</b> · time zones &amp; meeting planner · 100% offline — nothing leaves your browser</span>
      <span class="foot-socials">${icons}</span>
    </div>
    <div class="footer-bottom">© ${new Date().getFullYear()} WorldClock. All rights reserved. · Open source — free for educational, learning &amp; community contributions.</div>`;
}

// ---------- boot ----------
$("#fmt12").checked = state.fmt12;
$("#work-start").value = state.workStart;
$("#work-end").value = state.workEnd;
initTheme(); renderFooter(); renderAll();
// live tick
let lastMin = -1;
setInterval(() => {
  const now = new Date();
  renderClocks(now);
  const min = now.getMinutes();
  if (min !== lastMin) { lastMin = min; renderPlanner(now); }
}, 1000);
