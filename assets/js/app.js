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
      <div class="clock-meta">${formatDate(c.tz, now)} · ${offsetLabel(c.tz, now)}${i === 0 ? " · reference" : ""}</div>
    </article>`;
  }).join("");
}

// ---------- planner ----------
function hourLabel(hr) {
  if (!state.fmt12) return String(hr).padStart(2, "0");
  const ap = hr < 12 ? "a" : "p"; const h = hr % 12 || 12; return h + ap;
}
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
    LinkedIn: "https://in.linkedin.com/in/aashana1012", GitHub: "https://github.com/aashishbharti04",
    YouTube: "https://www.youtube.com/@CodeWithAsur", Instagram: "https://www.instagram.com/asurwave1012",
  };
  const links = Object.entries(socials).map(([k, u]) => `<a href="${u}" target="_blank" rel="noopener">${k}</a>`).join("");
  $("#footer").innerHTML = `
    <div class="footer-inner">
      <span>🌍 <b>WorldClock</b> · time zones &amp; meeting planner · 100% offline — nothing leaves your browser</span>
      <span class="footer-links">${links} · <a href="mailto:aashish@marketdoctorsonline.com">Contact</a></span>
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
