import { store } from './store.js';
import { makeCommand } from './commands.js';
import { loadQuotes, saveQuotes } from './db.js';

const root = document.getElementById('view');

// ---------- transient UI state ----------
// Ephemeral view state — open sheets, filters, the kebab menu — neither
// persisted nor in the URL. resetTransient() drops everything a navigation
// should clear; expandedMedia and the render bookkeeping deliberately survive.
const UI_DEFAULTS = {
  menuOpen: false, newRoutineOpen: false, catalogFormOpen: false, catalogPickRoutineId: null,
  catalogFilter: '', catalogEditName: null, detailRange: '30d', buildPickOpen: false, buildPickFilter: '',
  catalogFormPrefill: '', // seeds the create-form name (from an empty-search "Crear …" tap)
};
const ui = {
  ...UI_DEFAULTS,
  buildPickSelected: new Set(), // catalogIds ticked in the build picker
  expandedMedia: new Set(),     // exercises with media expanded (survives nav)
  lastDrawerOpen: false,        // suppress the drawer slide-anim on same-state re-render
  lastRouteKey: null,           // detect same-route re-render for scroll preservation
  cacheVersion: '',             // service-worker cache tag, shown in the kebab menu
};
const resetTransient = () => {
  Object.assign(ui, UI_DEFAULTS);
  ui.buildPickSelected.clear();
  if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; }
  releaseWakeLock();
  stopwatchOpen = false;
};

// ---------- safe rendering ----------
//
// Views are written with the `html` tagged template. Every interpolated value
// is escaped by default, so dynamic text can never inject markup; a value
// wrapped in `raw()` — or itself produced by `html` — is trusted and passed
// through, and arrays are flattened. The result is a `Safe` string that
// `mount()` parses into a Fragment (no script execution, no inline handlers).

class Safe {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
const raw = (s) => new Safe(String(s ?? ''));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Render one interpolated value: trusted markup passes through, arrays flatten,
// null/undefined vanish, everything else (incl. numbers/booleans) is escaped.
const part = (v) =>
  v == null ? '' :
  v instanceof Safe ? v.value :
  Array.isArray(v) ? v.map(part).join('') :
  esc(v);

const html = (strings, ...values) =>
  new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ''), ''));

// Stable test hook, raw so the quotes survive: html`<li ${dataTest('catalog-item')}>`.
const dataTest = (id) => raw(`data-test-id="${id}"`);

// Only allow http/https/youtube links. Block javascript:/data: in hrefs.
const safeUrl = (url) => {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return '';
};

const YT_ID = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i;
const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif)(?:\?|#|$)/i;

const parseMedia = (url) => {
  if (!url) return null;
  const m = url.match(YT_ID);
  if (m) return { kind: 'youtube', id: m[1], short: /youtube\.com\/shorts\//i.test(url), url };
  if (IMG_EXT.test(url)) return { kind: 'image', url };
  return { kind: 'link', url };
};

const mount = (markup) => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.deleteContents();
  range.setStart(root, 0);
  const frag = range.createContextualFragment(String(markup));
  root.appendChild(frag);
};

// Pointer-based drag-and-drop sort for [data-reorder-list]. Each row is
// [data-reorder-index="N"] with a [data-drag-handle] child. While dragging
// the picked-up row floats with the pointer; the other rows shift via
// CSS transitions to make room. Calls onReorder(from, to) at drop time.
const attachReorder = (container, onReorder) => {
  let dragging = null;
  let rows = [];
  let dragFromIndex = -1;
  let dragToIndex = -1;
  let rowOriginTops = [];
  let pointerStartY = 0;

  const onPointerDown = (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const row = handle.closest('[data-reorder-index]');
    if (!row) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    rows = [...container.querySelectorAll('[data-reorder-index]')];
    rowOriginTops = rows.map((r) => r.getBoundingClientRect().top);
    dragFromIndex = rows.indexOf(row);
    dragToIndex = dragFromIndex;
    pointerStartY = e.clientY;
    dragging = row;

    row.setPointerCapture?.(e.pointerId);
    row.classList.add('dragging');
    container.classList.add('reordering');

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const delta = e.clientY - pointerStartY;
    dragging.style.transform = `translateY(${delta}px)`;

    // Find which slot the pointer is currently over.
    const draggingHeight = dragging.offsetHeight;
    const pointerCenter = e.clientY;
    let newIndex = dragFromIndex;
    for (let i = 0; i < rows.length; i++) {
      if (i === dragFromIndex) continue;
      const top = rowOriginTops[i];
      const midpoint = top + draggingHeight / 2;
      if (i < dragFromIndex && pointerCenter < midpoint) { newIndex = i; break; }
      if (i > dragFromIndex && pointerCenter > midpoint) { newIndex = i; }
    }

    if (newIndex !== dragToIndex) {
      dragToIndex = newIndex;
      rows.forEach((r, i) => {
        if (i === dragFromIndex) return;
        let shift = 0;
        if (dragFromIndex < dragToIndex && i > dragFromIndex && i <= dragToIndex) shift = -draggingHeight - 8; // includes row gap
        if (dragFromIndex > dragToIndex && i < dragFromIndex && i >= dragToIndex) shift = draggingHeight + 8;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    }
  };

  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove);
    if (!dragging) return;
    rows.forEach((r) => { r.style.transform = ''; });
    dragging.classList.remove('dragging');
    container.classList.remove('reordering');
    const from = dragFromIndex;
    const to = dragToIndex;
    dragging = null;
    rows = [];
    if (from !== to && from >= 0 && to >= 0) onReorder(from, to);
  };

  container.addEventListener('pointerdown', onPointerDown);
};

// Tap the title to open the daily motivation screen.
const onTitleTap = () => go('#/motivation');

// In-app confirmation modal. Replaces window.confirm() with a styled
// dialog. Returns a Promise<boolean> — true on confirm, false on cancel.
const confirmModal = ({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive = false }) => {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    const markup = html`
      <div class="modal-backdrop" data-modal-action="cancel"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true">
        ${title ? html`<h3>${title}</h3>` : ''}
        ${message ? html`<p>${message}</p>` : ''}
        <div class="modal-actions">
          ${cancelLabel ? html`<button class="ghost" data-modal-action="cancel">${cancelLabel}</button>` : ''}
          <button class="${destructive ? 'danger-primary' : 'primary'}" data-modal-action="confirm">${confirmLabel}</button>
        </div>
      </div>`;
    const range = document.createRange();
    range.selectNodeContents(wrap);
    const frag = range.createContextualFragment(String(markup));
    wrap.appendChild(frag);
    document.body.appendChild(wrap);
    // Move focus into the dialog (and back afterwards) so keyboard users
    // aren't left interacting with the obscured page behind the backdrop.
    const opener = document.activeElement;
    wrap.querySelector('[data-modal-action="confirm"]')?.focus();
    let resolved = false;
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const close = (result) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      resolve(result);
    };
    wrap.addEventListener('click', (e) => {
      const t = e.target.closest('[data-modal-action]');
      if (!t) return;
      close(t.dataset.modalAction === 'confirm');
    });
    document.addEventListener('keydown', onKey);
  });
};

// Transient toast — lives outside `view` so re-renders don't kill it.
let toastTimer = null;
const showToast = (msg) => {
  document.querySelectorAll('.toast').forEach((n) => n.remove());
  if (toastTimer) clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(() => { t.remove(); toastTimer = null; }, 2700);
};

const requestCacheVersion = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active;
    if (!sw) return;
    const channel = new MessageChannel();
    const v = await new Promise((resolve) => {
      channel.port1.onmessage = (e) => resolve(e.data?.version || '');
      sw.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
    // The SW posts the bare VERSION tag ('v21'); tolerate a full cache name too.
    const tag = v.match(/v\d+$/)?.[0] ?? v;
    if (tag && tag !== ui.cacheVersion) {
      ui.cacheVersion = tag;
      if (ui.menuOpen) render(store.state);
    }
  } catch {}
};
requestCacheVersion();

// Auto-reload once when the SW activates a new shell (single-reload updates).
// Committed data is safe in IndexedDB, but a reload mid-edit would eat text
// that hasn't fired `change` yet or an open drawer/modal — so defer until
// it's safe, retrying when the user navigates or leaves the page.
let reloadingForUpdate = false;
let pendingUpdateReload = false;
const reloadIsSafe = () =>
  !document.body.hasAttribute('data-drawer-open') &&
  !document.querySelector('.modal-wrap') &&
  !(document.activeElement && (
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA' ||
    document.activeElement.isContentEditable
  ));
const tryUpdateReload = (force = false) => {
  if (reloadingForUpdate) return;
  if (force || reloadIsSafe()) {
    reloadingForUpdate = true;
    location.reload();
  } else {
    pendingUpdateReload = true;
  }
};
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'RELOAD') tryUpdateReload();
  });
}
// Once hidden, the reload is invisible (and un-blurred input is lost either
// way) — force it. On in-app navigation, retry only if now safe.
document.addEventListener('visibilitychange', () => {
  if (pendingUpdateReload && document.visibilityState === 'hidden') tryUpdateReload(true);
});
window.addEventListener('hashchange', () => {
  if (pendingUpdateReload) tryUpdateReload();
});
// Transient: in-workout stopwatch overlay. Each open starts from zero;
// tick interval drives a single DOM text node (no store dispatches).
let stopwatchOpen = false;
let stopwatchStart = 0;
let stopwatchTimer = null;
// Screen Wake Lock: the OS auto-releases when the document hides, so we
// must re-acquire on visibilitychange while the stopwatch is still open.
let wakeLock = null;

const fmtStopwatch = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const tickStopwatch = () => {
  const el = document.getElementById('stopwatch-display');
  if (!el) return;
  el.textContent = fmtStopwatch(performance.now() - stopwatchStart);
};

const acquireWakeLock = async () => {
  if (!('wakeLock' in navigator)) return;
  if (document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;
  }
};

const releaseWakeLock = () => {
  if (!wakeLock) return;
  wakeLock.release().catch(() => {});
  wakeLock = null;
};

document.addEventListener('visibilitychange', () => {
  if (stopwatchOpen && document.visibilityState === 'visible') acquireWakeLock();
});

const openStopwatch = () => {
  if (stopwatchOpen) return;
  stopwatchOpen = true;
  stopwatchStart = performance.now();
  render(store.state);
  stopwatchTimer = setInterval(tickStopwatch, 250);
  acquireWakeLock();
};

const closeStopwatch = () => {
  if (stopwatchTimer) { clearInterval(stopwatchTimer); stopwatchTimer = null; }
  releaseWakeLock();
  if (!stopwatchOpen) return;
  stopwatchOpen = false;
  render(store.state);
};

// Focus + drawer-scroll preservation across full re-renders. Without this,
// every per-field change in the drawer would blow away focus + the soft
// keyboard. We re-target the same element by its semantic data attributes.
const captureUIState = () => {
  const a = document.activeElement;
  const drawer = root.querySelector('.drawer');
  const scroll = drawer ? drawer.scrollTop : 0;
  const pageScroll = window.scrollY;
  if (!a || a === document.body || a === document.documentElement) {
    return { selector: null, scroll, pageScroll };
  }
  const tag = a.tagName.toLowerCase();
  const parts = [tag];
  const ds = a.dataset || {};
  if (a.name) parts.push(`[name="${CSS.escape(a.name)}"]`);
  if (ds.routine) parts.push(`[data-routine="${CSS.escape(ds.routine)}"]`);
  if (ds.exercise) parts.push(`[data-exercise="${CSS.escape(ds.exercise)}"]`);
  if (ds.setIndex !== undefined) parts.push(`[data-set-index="${CSS.escape(ds.setIndex)}"]`);
  if (a.hasAttribute('data-rename-routine')) parts.push('[data-rename-routine]');
  const selector = parts.length > 1 ? parts.join('') : null;
  const selectionStart = typeof a.selectionStart === 'number' ? a.selectionStart : null;
  const selectionEnd = typeof a.selectionEnd === 'number' ? a.selectionEnd : null;
  return { selector, selectionStart, selectionEnd, scroll, pageScroll };
};

const restoreUIState = (info) => {
  const drawer = root.querySelector('.drawer');
  if (drawer && info.scroll) drawer.scrollTop = info.scroll;
  if (!info.selector) return;
  const el = root.querySelector(info.selector);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (info.selectionStart != null && el.setSelectionRange) {
    try { el.setSelectionRange(info.selectionStart, info.selectionEnd); } catch {}
  }
};

// ---------- helpers ----------

const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const uid = () => 'x' + Math.random().toString(36).slice(2, 10);

// Session entries: { sets: boolean[], snapshot }. Returns the per-set
// completion array.
const sessionFor = (state, date, exerciseId) => {
  const raw = state.doc.sessions[date]?.[exerciseId];
  return raw?.sets ?? [];
};

const sessionSnapshot = (state, date, exerciseId) => {
  const raw = state.doc.sessions[date]?.[exerciseId];
  return raw?.snapshot ?? null;
};

const countDoneFor = (state, date, routine) => {
  let total = 0, done = 0;
  for (const ex of routine.exercises) {
    const n = exSetCount(ex);
    total += n;
    const arr = sessionFor(state, date, ex.id);
    for (let i = 0; i < n; i++) if (arr[i]) done++;
  }
  return { total, done };
};

// ---------- Dashboard / catalog aggregation ----------

// Exercises are grouped across routines by their normalized name. Two
// routines can hold the same lift at different weights; we treat them as one
// identity for history / catalog purposes.
const normalizeName = (s) => String(s ?? '').trim().toLowerCase();
const slugify = (name) => encodeURIComponent(normalizeName(name));
const unslug = (slug) => { try { return decodeURIComponent(slug); } catch { return slug; } };

// ---------- normalized exercise model ----------
// The catalog is the source of truth. A routine exercise is a reference
// `{ id, catalogId, series }`; `hydrateExercise` merges it with its catalog
// entry into the self-contained `{ id, name, kind, unit, video, notes, series }`
// shape the rest of the UI reads, so render code stays oblivious to the split.
const findCatalogById = (state, id) => (state.doc.catalog || []).find((c) => c.id === id);

const hydrateExercise = (state, inst) => {
  if (!inst) return null;
  const def = findCatalogById(state, inst.catalogId) || {};
  return {
    id: inst.id,
    catalogId: inst.catalogId,
    name: def.name ?? '',
    category: def.category ?? null,
    kind: def.kind === 'time' ? 'time' : 'reps',
    unit: def.unit === 'lb' ? 'lb' : 'kg',
    video: def.video ?? null,
    notes: def.notes ?? '',
    series: Array.isArray(inst.series) ? inst.series : [],
  };
};

// Display name of a routine reference (or any { catalogId } object), resolved
// through the catalog; falls back to a legacy inline `name` for old log rows.
const refName = (state, ref) => {
  if (!ref) return 'un ejercicio';
  return findCatalogById(state, ref.catalogId)?.name ?? ref.name ?? 'un ejercicio';
};

const sumDone = (arr) => arr.reduce((n, v) => n + (v ? 1 : 0), 0);

// Map of dateKey → number of sets completed that day. Skips zero-effort days
// so the heatmap doesn't show ghost cells.
const dayActivityMap = (state) => {
  const map = new Map();
  for (const [date, sess] of Object.entries(state.doc.sessions || {})) {
    let n = 0;
    for (const exId of Object.keys(sess)) {
      n += sumDone(sessionFor(state, date, exId));
    }
    if (n > 0) map.set(date, n);
  }
  return map;
};

// Build the unified exercise list from the canonical `catalog` (source of
// truth), enriched with usage (which routines reference each entry) and history
// (sessions). Catalog entries are unique by normalized name. Sessions can also
// surface a history-only row for an exercise since deleted from the catalog
// (catalogId === null) — useful on the dashboard, filtered out of the catalog
// screen. Returns rows:
//   { name, displayName, catalogId, catalogIndex, template, kind, unit,
//     lastWeight, lastDate, sessionCount,
//     usedIn: [{ routineId, routineIndex, exerciseId, index }] }
const buildCatalog = (state) => {
  const cat = state.doc.catalog || [];
  const rows = new Map(); // normName -> row

  cat.forEach((def, ci) => {
    const key = normalizeName(def.name);
    if (!key || rows.has(key)) return;
    rows.set(key, {
      name: key,
      displayName: def.name,
      catalogId: def.id,
      catalogIndex: ci,
      template: def,
      kind: def.kind === 'time' ? 'time' : 'reps',
      unit: def.unit === 'lb' ? 'lb' : 'kg',
      lastWeight: null,
      lastDate: null,
      sessionCount: 0,
      usedIn: [],
    });
  });

  // Usage: which routines reference each entry, plus a planned-weight fallback.
  state.doc.routines.forEach((r, idx) => {
    r.exercises.forEach((inst, i) => {
      const def = findCatalogById(state, inst.catalogId);
      const key = def ? normalizeName(def.name) : null;
      const row = key ? rows.get(key) : null;
      if (!row) return;
      row.usedIn.push({ routineId: r.id, routineIndex: idx, exerciseId: inst.id, index: i });
      if (row.lastWeight == null) row.lastWeight = repWeight(hydrateExercise(state, inst));
    });
  });

  // History: most-recent session wins for lastDate/lastWeight; count sessions.
  for (const [date, sess] of Object.entries(state.doc.sessions || {})) {
    for (const exId of Object.keys(sess)) {
      const arr = sessionFor(state, date, exId);
      if (sumDone(arr) === 0) continue;
      const snap = sessionSnapshot(state, date, exId);
      let dn = snap?.name;
      if (!dn) {
        const found = findExerciseInState(state, exId);
        dn = found ? hydrateExercise(state, found.exercise).name : null;
      }
      if (!dn) continue;
      const key = normalizeName(dn);
      let row = rows.get(key);
      if (!row) {
        // History-only: exercise no longer in the catalog.
        row = {
          name: key, displayName: dn, catalogId: null, catalogIndex: -1,
          template: null, kind: snap?.kind ?? 'reps', unit: snap?.unit === 'lb' ? 'lb' : 'kg',
          lastWeight: null, lastDate: null, sessionCount: 0, usedIn: [],
        };
        rows.set(key, row);
      }
      if (!row.lastDate || date > row.lastDate) {
        row.lastDate = date;
        row.lastWeight = snapTopWeight(snap) ?? row.lastWeight;
      }
      row.sessionCount += 1;
    }
  }

  return [...rows.values()].sort((a, b) => {
    if (a.lastDate && b.lastDate) return a.lastDate < b.lastDate ? 1 : -1;
    if (a.lastDate) return -1;
    if (b.lastDate) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
};

// Per-exercise sessions: chronological list (oldest first) for one
// normalized name. Each row has the data the detail view needs.
const buildExerciseHistory = (state, normName) => {
  const rows = [];
  for (const [date, sess] of Object.entries(state.doc.sessions || {})) {
    for (const exId of Object.keys(sess)) {
      const arr = sessionFor(state, date, exId);
      const done = sumDone(arr);
      if (done === 0) continue;
      const snap = sessionSnapshot(state, date, exId);
      let displayName = snap?.name;
      let routineId = snap?.routineId;
      let routineIndex = -1;
      if (!displayName) {
        const found = findExerciseInState(state, exId);
        if (found) {
          displayName = hydrateExercise(state, found.exercise).name;
          routineId = found.routine.id;
          routineIndex = state.doc.routines.findIndex((r) => r.id === found.routine.id);
        }
      } else if (routineId) {
        routineIndex = state.doc.routines.findIndex((r) => r.id === routineId);
      }
      if (!displayName) continue;
      if (normalizeName(displayName) !== normName) continue;
      rows.push({
        date,
        exerciseId: exId,
        routineId,
        routineIndex,
        displayName,
        kind: snap?.kind ?? 'reps',
        unit: snap?.unit === 'lb' ? 'lb' : 'kg',
        series: Array.isArray(snap?.series) ? snap.series : [],
        setsDone: done,
        setsTotal: arr.length,
      });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
};

// Spanish short date label used across dashboard surfaces.
const MONTHS_ES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtShortDate = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS_ES_SHORT[m - 1]}`;
};
const fmtRelDay = (dateKey) => {
  const today = todayKey();
  if (dateKey === today) return 'hoy';
  // Compute calendar-day delta independent of timezone math: parse both as
  // UTC midnight and subtract days.
  const a = Date.UTC(...dateKey.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  const b = Date.UTC(...today.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  const days = Math.round((b - a) / 86400000);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} d`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  return fmtShortDate(dateKey);
};

const fmtWeight = (w) => {
  if (!w || w.value === '' || w.value == null) return null;
  return `${w.value} ${w.unit}`;
};

// ---------- exercise series model ----------
// Every exercise stores `series` (one entry per set). `reps` exercises:
// { weight: number|null, reps: number|null }; `time` exercises: { duration }.
// A shared `unit` applies to all weights. Set count = series.length.

const exSeries = (ex) => (Array.isArray(ex?.series) ? ex.series : []);
const exSetCount = (ex) => exSeries(ex).length;
const exUnit = (ex) => (ex?.unit === 'lb' ? 'lb' : 'kg');

const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Total volume Σ(weight × reps). Sets missing a weight or reps contribute 0.
const seriesVolume = (series) => (series || []).reduce((sum, s) => {
  const w = numOrNull(s?.weight), r = numOrNull(s?.reps);
  return (w != null && r != null) ? sum + w * r : sum;
}, 0);

// Heaviest set's weight value, or null when none is set.
const topWeightValue = (series) => {
  const vals = (series || []).map((s) => numOrNull(s?.weight)).filter((v) => v != null);
  return vals.length ? Math.max(...vals) : null;
};

// Representative weight {value, unit} for badges/cards.
const repWeight = (ex) => {
  const v = topWeightValue(exSeries(ex));
  return v == null ? null : { value: v, unit: exUnit(ex) };
};
const snapTopWeight = (snap) => {
  const v = topWeightValue(snap?.series);
  return v == null ? null : { value: v, unit: snap?.unit === 'lb' ? 'lb' : 'kg' };
};

// Compact weight list: "60 kg" when equal, else "60·70·80 kg". null if none.
const fmtSeriesWeights = (series, unit) => {
  const vals = (series || []).map((s) => numOrNull(s?.weight)).filter((v) => v != null);
  if (!vals.length) return null;
  if (vals.every((v) => v === vals[0])) return `${vals[0]} ${unit}`;
  return `${vals.join('·')} ${unit}`;
};

// Duration string of a `time` exercise's series (uniform across sets).
const seriesDuration = (series) => (series || []).find((s) => s?.duration)?.duration ?? '';
// Leading number of a duration string ("30-60 seg" → 30, "45 min" → 45).
const durationLead = (str) => {
  const m = String(str ?? '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Chart/sparkline y-value for a history row: volume for reps, duration for time.
const rowChartValue = (row) => row.kind === 'time'
  ? durationLead(seriesDuration(row.series))
  : (seriesVolume(row.series) || null);

// Build / resize / reshape `series` for a kind.
const blankEntry = (kind) => (kind === 'time' ? { duration: '' } : { weight: null, reps: null });
const makeSeries = (n, kind) => Array.from({ length: Math.max(1, n) }, () => blankEntry(kind));
const resizeSeries = (series, n, kind) => Array.from({ length: Math.max(1, n) }, (_, i) => {
  const prev = series[i] ?? series[series.length - 1];
  return prev ? { ...prev } : blankEntry(kind);
});
// Convert every entry to the shape `kind` requires, preserving length.
const reshapeSeries = (series, kind) => (series.length ? series : [blankEntry(kind)]).map((s) =>
  kind === 'time'
    ? { duration: typeof s.duration === 'string' ? s.duration : '' }
    : { weight: numOrNull(s.weight), reps: numOrNull(s.reps) });

// ---------- routing ----------

// A route is `#/<segment>/…`. Each parser turns the path segments into a route
// object; the leading segment selects the parser. An `ex/:slug[/edit]` tail is
// shared by catalog and dashboard, hence `exerciseRoute(origin)`.
const exerciseRoute = (origin) => (p) => {
  const r = { name: 'exercise', slug: p[2], origin };
  if (p[3] === 'edit') r.editMode = true;
  return r;
};
const routeParsers = {
  workout: (p) => {
    if (!p[1]) return { name: 'home' };
    const r = { name: 'workout', routineId: p[1] };
    if (p[2] === 'edit') { r.editMode = true; if (p[3]) r.editExerciseId = p[3]; }
    return r;
  },
  build: (p) => {
    const r = { name: 'build', step: Math.max(0, Math.min(11, Number(p[1]) || 0)) };
    if (p[2] === 'ex' && p[3]) r.editExerciseId = p[3];
    return r;
  },
  catalog: (p) => {
    if (p[1] === 'edit') return { name: 'catalog', mode: 'edit' };
    if (p[1] === 'pick' && p[2]) return { name: 'catalog', mode: 'pick', routineId: p[2] };
    if (p[1] === 'ex' && p[2]) return exerciseRoute('catalog')(p);
    return { name: 'catalog', mode: 'view' };
  },
  dashboard: (p) => (p[1] === 'ex' && p[2]) ? exerciseRoute('dashboard')(p) : { name: 'dashboard' },
  edit: () => ({ name: 'edit' }),
  log: () => ({ name: 'log' }),
  motivation: () => ({ name: 'motivation' }),
};

const parseRoute = () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (!h) return { name: 'home' };
  const parts = h.split('/');
  return (routeParsers[parts[0]] ?? (() => ({ name: 'home' })))(parts);
};

const go = (path) => { location.hash = path; };

// ---------- views ----------

// SVG icon set (each is trusted markup → raw). `dumbbell`/`clock` tag exercise
// kind in the catalog; the rest are chrome.
const icons = {
  undo: raw(`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`),
  redo: raw(`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>`),
  kebab: raw(`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>`),
  back: raw(`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`),
  stopwatch: raw(`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="7"/><polyline points="12 11 12 14 14.5 14"/><line x1="10" y1="3" x2="14" y2="3"/><line x1="12" y1="3" x2="12" y2="5"/></svg>`),
  // Compact bar-chart glyph — ascending columns, used to enter the dashboard.
  chart: raw(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="20" x2="21" y2="20"/><rect x="5" y="13" width="3" height="6" rx="0.5"/><rect x="10.5" y="9" width="3" height="10" rx="0.5"/><rect x="16" y="5" width="3" height="14" rx="0.5"/></svg>`),
  edit: raw(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6"/><path d="M3 21l4-1 11.5-11.5-3-3L4 17l-1 4z"/></svg>`),
  trash: raw(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`),
  dumbbell: raw(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8"/></svg>`),
  clock: raw(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 10.5V13l1.8 1.2"/><path d="M9.5 3.5h5"/></svg>`),
  search: raw(`<svg class="search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>`),
  clear: raw(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`),
};

// Shared search field: leading magnifier + input + a trailing clear button that
// only appears once there's a query. `id` doubles as the clear button's target.
const searchField = (id, value, { test = '' } = {}) => html`
  <div class="catalog-filter-wrap ${value ? 'has-text' : ''}">
    <input type="text" id="${id}" ${test} class="catalog-filter"
           placeholder="Buscar ejercicio…" autocomplete="off" value="${value}" />
    ${icons.search}
    ${value ? html`<button type="button" class="search-clear" data-action="clear-search" data-target="${id}" aria-label="Borrar búsqueda">${icons.clear}</button>` : ''}
  </div>`;

// Empty result for a search: a friendly dead-end that offers to create the
// thing the user was looking for, name pre-seeded from the query.
const emptySearch = (query, routineId = null) => html`
  <div class="search-empty">
    <span class="search-empty-ic" aria-hidden="true">${icons.search}</span>
    <p class="search-empty-msg">Nada coincide con <strong>“${query}”</strong></p>
    <button class="ghost search-empty-cta" data-action="add-catalog-exercise"
            ${routineId ? html`data-routine="${routineId}"` : ''} data-prefill="${query}">
      Crear “${query}”
    </button>
  </div>`;
const backBtn = (href, label = 'Volver al inicio') =>
  html`<button class="back-btn" data-go="${href}" aria-label="${label}">${icons.back}</button>`;

// Fixed bottom action bar rendered on every view. Left: undo/redo.
// Right: contextual primary action (Editar on home, Listo on edit) + kebab.
const bottomBar = (state, primary = '') => html`
  <nav class="bottom-bar">
    <div class="bottom-bar-inner">
      <div class="group">
        <button class="tool-btn" data-action="undo" aria-label="Deshacer" ${store.canUndo() ? '' : 'disabled'}>${icons.undo}</button>
        <button class="tool-btn" data-action="redo" aria-label="Rehacer" ${store.canRedo() ? '' : 'disabled'}>${icons.redo}</button>
      </div>
      <div class="group">
        ${primary}
        <button class="tool-btn" data-action="menu" aria-label="Más opciones">${icons.kebab}</button>
      </div>
    </div>
  </nav>
`;

const doneBtn = raw('<button class="icon-btn primary" data-action="done">Listo</button>');
const editBtn = raw('<button class="icon-btn primary" data-go="#/edit">Editar</button>');

// Square brand badge — amber barbell on charcoal
const logoSvg = raw(`
<svg class="app-logo" viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="6" fill="transparent"/>
  <g fill="#ffffff">
    <rect x="4" y="17" width="3" height="6" rx="0.5"/>
    <rect x="8" y="13" width="3" height="14" rx="0.5"/>
    <rect x="13" y="18" width="14" height="4"/>
    <rect x="29" y="13" width="3" height="14" rx="0.5"/>
    <rect x="33" y="17" width="3" height="6" rx="0.5"/>
  </g>
</svg>`);

const DAY_WORDS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce'];
const dayWord = (i) => DAY_WORDS[i] ?? String(i + 1);
const dayNum = (i) => String(i + 1).padStart(2, '0');

// Daily motivational quotes. Loaded from /quotes.json, cached in IndexedDB.
// Cache invalidates when the file's raw text differs from the cached copy.
// Note: the service worker answers ./quotes.json cache-first, so the
// "network" fetch below really reads the SW precache — quotes only change
// alongside a service-worker version bump, which re-precaches the file.
let quotesCache = [];

const refreshQuotesFromNetwork = async () => {
  try {
    const res = await fetch('./quotes.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const text = await res.text();
    const list = JSON.parse(text);
    if (!Array.isArray(list) || list.length === 0) return;
    const cached = await loadQuotes().catch(() => null);
    if (!cached || cached.raw !== text) {
      await saveQuotes({ raw: text, quotes: list });
    }
    quotesCache = list;
  } catch {}
};

const initQuotes = async () => {
  const cached = await loadQuotes().catch(() => null);
  if (cached?.quotes?.length) {
    quotesCache = cached.quotes;
    // Refresh in background — if the file changed, next pickQuote sees it.
    refreshQuotesFromNetwork();
  } else {
    // First launch / empty cache — wait so the motivation screen has data.
    await refreshQuotesFromNetwork();
  }
};

// Deterministic per calendar day, random-feeling across days. Same quote
// stays for all of today; tomorrow's pick is a scrambled index, not the
// next slot in order, so consecutive days don't feel sequential.
// Day boundary is the device's local timezone — getFullYear/getMonth/getDate
// all return local-time values, so the quote flips at the user's midnight.
const pickQuote = () => {
  if (!quotesCache.length) return '';
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  // xorshift-flavored scramble — cheap, deterministic, distributes well.
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return quotesCache[h % quotesCache.length];
};

// Exercise kind: 'reps' (default) or 'time' (cardio / planks).
const exKind = (ex) => (ex.kind === 'time' ? 'time' : 'reps');

const renderHome = (state) => {
  const date = todayKey();

  // The routine with the most progress today gets highlighted as "active".
  let activeId = null;
  let activeDone = 0;
  for (const r of state.doc.routines) {
    const { done } = countDoneFor(state, date, r);
    if (done > activeDone) { activeDone = done; activeId = r.id; }
  }

  const items = state.doc.routines.map((r, i) => {
    const { total, done } = countDoneFor(state, date, r);
    const isRest = r.exercises.length === 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const active = r.id === activeId && done > 0;
    const meta = isRest
      ? html`<span class="num small muted">Día de descanso</span>`
      : html`
        <div class="progress-bar" aria-hidden="true"><div style="width:${pct}%"></div></div>
        <span class="progress-num">${String(done).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
      `;
    return html`
      <button class="routine-card ${isRest ? 'rest' : ''} ${active ? 'active' : ''}" ${dataTest('routine-card')} data-go="#/workout/${r.id}">
        <div class="rc-row1">
          <span class="rc-badge">${dayNum(i)}</span>
          <div class="rc-title">
            <span class="rc-eyebrow">Día ${dayWord(i)}</span>
            ${r.name}
          </div>
          <span class="rc-chev" aria-hidden="true">›</span>
        </div>
        <div class="rc-row2">${meta}</div>
      </button>`;
  });

  return html`
    <header class="app-bar">
      <div class="app-bar-left">
        ${logoSvg}
        <h1 class="app-title" data-tap-title>Arnold</h1>
      </div>
      <div class="app-bar-actions">
        <button class="tool-btn" data-go="#/dashboard" aria-label="Progreso">${icons.chart}</button>
      </div>
    </header>
    <div class="section">
      <span class="label">Rutinas</span>
      <span class="count">${String(state.doc.routines.length).padStart(2, '0')}</span>
    </div>
    <div class="routine-list">${items}</div>
    ${bottomBar(state, editBtn)}
  `;
};

// ---------- Log view ----------

const findExerciseInState = (state, exerciseId) => {
  for (const r of state.doc.routines) {
    const ex = r.exercises.find((e) => e.id === exerciseId);
    if (ex) return { routine: r, exercise: ex };
  }
  return null;
};

const fmtRelTime = (t) => {
  const d = (Date.now() - t) / 1000;
  if (d < 45) return 'hace un momento';
  if (d < 3600) return `hace ${Math.max(1, Math.floor(d / 60))} min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
  const days = Math.floor(d / 86400);
  return days === 1 ? 'ayer' : `hace ${days} d`;
};

const describeCommand = (cmd, state) => {
  const p = cmd.payload;
  switch (cmd.type) {
    case 'TOGGLE_SET': {
      const found = findExerciseInState(state, p.exerciseId);
      const name = refName(state, found?.exercise);
      const verb = p.to ? 'Marcaste' : 'Desmarcaste';
      return `${verb} la serie ${p.setIndex + 1} de ${name}`;
    }
    case 'CLEAR_SETS':
      return `Reiniciaste el checklist del día`;
    case 'UPDATE_SERIES':
      return `Editaste las series de ${refName(state, findExerciseInState(state, p.exerciseId)?.exercise)}`;
    case 'UPDATE_CATALOG_ENTRY':
      return `Editaste ${p.to?.name ?? 'un ejercicio'}`;
    case 'ADD_EXERCISE':
      return `Agregaste ${refName(state, p.exercise)}`;
    case 'ADD_EXERCISES':
      return p.exercises.length === 1
        ? `Agregaste ${refName(state, p.exercises[0])}`
        : `Agregaste ${p.exercises.length} ejercicios`;
    case 'REMOVE_EXERCISE':
      return `Eliminaste ${refName(state, p.exercise)}`;
    case 'RENAME_ROUTINE':
      return `Renombraste la rutina a "${p.to}"`;
    case 'ADD_ROUTINE':
      return `Agregaste la rutina "${p.routine.name}"`;
    case 'ADD_CATALOG_EXERCISE':
      return `Creaste el ejercicio "${p.exercise.name}"`;
    case 'REMOVE_ROUTINE':
      return `Eliminaste la rutina "${p.routine.name}"`;
    case 'MOVE_ROUTINE':
      return `Reordenaste rutinas`;
    case 'MOVE_EXERCISE':
      return `Reordenaste ejercicios`;
    case 'CATALOG_DELETE':
      return `Eliminaste "${p.name}"${p.targets.length ? ` de ${p.targets.length} rutina${p.targets.length === 1 ? '' : 's'}` : ' del catálogo'}`;
    default:
      return cmd.type;
  }
};

const renderNewRoutineSheet = () => html`
  <div class="drawer-backdrop" data-action="cancel-new-routine"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Nueva rutina">
    <div class="drawer-head">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-header">
        <h3>Nueva rutina</h3>
        <button class="icon-btn" data-action="cancel-new-routine" aria-label="Cerrar">✕</button>
      </div>
    </div>
    <form class="drawer-body" id="new-routine-form" autocomplete="off">
      <div class="field">
        <label for="new-routine-name">Nombre</label>
        <input type="text" id="new-routine-name" name="name"
               placeholder="Cardio y core" maxlength="80"
               autocomplete="off" />
      </div>
      <div class="bottom-action">
        <button class="primary" type="submit">Crear rutina</button>
      </div>
    </form>
  </aside>
`;

// "New catalog exercise" form, opened from the catalog manager. Captures only
// the definition — name, type, image/video, notes. Sets/reps/duration/weight
// are configured on the routine instance. Two submit buttons: save & back to
// the manager, or save & keep adding.
const renderCatalogFormSheet = () => html`
  <div class="drawer-backdrop" data-action="cancel-catalog-form"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Crear ejercicio">
    <div class="drawer-head">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-header">
        <h3>Crear ejercicio</h3>
        <button class="icon-btn" data-action="cancel-catalog-form" aria-label="Cerrar">✕</button>
      </div>
    </div>
    <form class="drawer-body" id="catalog-form" ${dataTest('catalog-form')} autocomplete="off">
      <div class="field">
        <label for="cat-form-name">Nombre</label>
        <input type="text" id="cat-form-name" name="name" maxlength="80"
               placeholder="Press de banca con barra" autocomplete="off"
               value="${ui.catalogFormPrefill}" />
      </div>
      <div class="field">
        <label for="cat-form-category">Grupo muscular</label>
        <select id="cat-form-category" name="category">
          ${CATEGORY_ORDER.map((k) => html`<option value="${k}">${CATEGORIES[k].label}</option>`)}
        </select>
      </div>
      <div class="field">
        <label for="cat-form-kind">Tipo</label>
        <select id="cat-form-kind" name="kind">
          <option value="reps">Repeticiones</option>
          <option value="time">Tiempo (cardio)</option>
        </select>
      </div>
      <div class="field">
        <label for="cat-form-video">Imagen o video (URL)</label>
        <input type="text" id="cat-form-video" name="video"
               placeholder="https://youtu.be/... o https://.../foto.jpg" autocomplete="off" />
      </div>
      <div class="field">
        <label for="cat-form-notes">Notas</label>
        <input type="text" id="cat-form-notes" name="notes" autocomplete="off" />
      </div>
      <div class="bottom-action catalog-form-actions">
        <button class="ghost" type="submit" data-catalog-form-submit="another">Guardar y crear otro</button>
        <button class="primary" type="submit" data-catalog-form-submit="close">Guardar</button>
      </div>
    </form>
  </aside>
`;

const renderMenuSheet = () => html`
  <div class="drawer-backdrop" data-action="close-menu"></div>
  <aside class="drawer drawer-menu" role="dialog" aria-modal="true" aria-label="Más opciones">
    <div class="drawer-head">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-header">
        <h3>Más opciones${ui.cacheVersion ? html` <span class="menu-cache-version">${ui.cacheVersion}</span>` : ''}</h3>
        <button class="icon-btn" data-action="close-menu" aria-label="Cerrar">✕</button>
      </div>
    </div>
    <ul class="menu-list">
      <li>
        <button class="menu-item" data-go="#/catalog">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </span>
          <span class="menu-text">
            <span class="menu-title">Catálogo de ejercicios</span>
            <span class="menu-sub">Ver, crear y editar</span>
          </span>
        </button>
      </li>
      <li>
        <button class="menu-item" data-action="export">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </span>
          <span class="menu-text">
            <span class="menu-title">Exportar</span>
            <span class="menu-sub">Guardá tus rutinas</span>
          </span>
        </button>
      </li>
      <li>
        <button class="menu-item" data-action="import">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </span>
          <span class="menu-text">
            <span class="menu-title">Importar</span>
            <span class="menu-sub">Reemplazá todo desde un archivo</span>
          </span>
        </button>
      </li>
      <li>
        <button class="menu-item" data-go="#/dashboard">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="20" x2="21" y2="20"/><rect x="5" y="13" width="3" height="6" rx="0.5"/><rect x="10.5" y="9" width="3" height="10" rx="0.5"/><rect x="16" y="5" width="3" height="14" rx="0.5"/></svg>
          </span>
          <span class="menu-text">
            <span class="menu-title">Progreso</span>
            <span class="menu-sub">Calendario y ejercicios usados</span>
          </span>
        </button>
      </li>
      <li>
        <button class="menu-item" data-go="#/log">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="12 6 12 12 16 14"/><circle cx="12" cy="12" r="10"/></svg>
          </span>
          <span class="menu-text">
            <span class="menu-title">Ver registro</span>
            <span class="menu-sub">Historial de acciones</span>
          </span>
        </button>
      </li>
      <li>
        <button class="menu-item" data-action="reset">
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </span>
          <span class="menu-text">
            <span class="menu-title">Restaurar rutina inicial</span>
            <span class="menu-sub">Volvé al programa original</span>
          </span>
        </button>
      </li>
    </ul>
  </aside>
`;

const renderStopwatchSheet = () => {
  const display = stopwatchOpen
    ? fmtStopwatch(performance.now() - stopwatchStart)
    : '00:00';
  return html`
    <div class="drawer-backdrop stopwatch-overlay" data-action="close-stopwatch" role="dialog" aria-modal="true" aria-label="Cronómetro">
      <div class="stopwatch-display" id="stopwatch-display">${display}</div>
      <button class="stopwatch-close" data-action="close-stopwatch" aria-label="Cerrar">✕</button>
    </div>
  `;
};

const renderMotivation = () => {
  const quote = pickQuote();
  const words = quote.split(/(\s+)/).map((tok, i) =>
    /^\s+$/.test(tok) ? tok : html`<span class="word" style="animation-delay:${50 + i * 35}ms">${tok}</span>`);
  return html`
    <div class="motivation" data-go="#/" role="dialog" aria-label="Frase motivacional">
      <p class="quote">${words}</p>
      <span class="motivation-hint">tocá para volver</span>
    </div>
  `;
};

const renderLog = (state) => {
  const past = [...store.history.past].reverse();
  const items = past.map((cmd) => html`
    <li class="log-item">
      <span class="log-desc">${describeCommand(cmd, state)}</span>
      <span class="log-time">${fmtRelTime(cmd.t)}</span>
    </li>
  `);
  return html`
    <header class="workout-bar">
      ${backBtn('#/')}
      <div class="title-block">
        <div class="title">Registro</div>
        <div class="sub">${past.length} ${past.length === 1 ? 'acción' : 'acciones'}</div>
      </div>
      <span></span>
    </header>
    ${past.length === 0
      ? html`<p class="muted small" style="padding:1rem 0.25rem">Sin acciones todavía.</p>`
      : html`<ul class="log">${items}</ul>`}
    ${bottomBar(state)}
  `;
};

const renderWorkout = (state, routineId, editExerciseId, editMode = false) => {
  const routine = state.doc.routines.find((r) => r.id === routineId);
  if (!routine) return renderHome(state);
  const date = todayKey();

  const isRestDay = /(descanso|rest)/i.test(routine.name);
  const items = routine.exercises.length === 0
    ? (isRestDay
        ? html`<div class="rest-card">Día de descanso. Recupera, hidrata, volvé más fuerte.</div>`
        : html`<div class="empty-state">
             <div class="empty-icon" aria-hidden="true">＋</div>
             <p>Esta rutina está vacía.</p>
             <button class="primary" data-action="add-exercise" data-routine="${routine.id}" data-open-drawer="1">Agregar primer ejercicio</button>
           </div>`)
    : routine.exercises.map((inst, exIndex) => {
        const ex = hydrateExercise(state, inst);
        const arr = sessionFor(state, date, ex.id);
        const kind = exKind(ex);
        const series = exSeries(ex);
        const setCount = series.length;
        const unit = exUnit(ex);
        const doneCount = arr.slice(0, setCount).filter(Boolean).length;
        // Each set is one tap-to-complete row: a check, "Serie N", and the
        // target (weight × reps, or duration). The whole row is the toggle.
        const sets = series.map((s, i) => {
          const done = !!arr[i];
          let target;
          if (kind === 'time') {
            target = s.duration || '—';
          } else {
            const w = numOrNull(s.weight), r = numOrNull(s.reps);
            const wPart = w != null ? html`${w} <span class="u">${unit}</span>` : '—';
            const rPart = r != null ? r : '—';
            target = (w != null || r != null) ? html`${wPart} <span class="x">×</span> ${rPart}` : '—';
          }
          return html`<button class="set-line ${done ? 'done' : ''}"
                          ${dataTest('set-toggle')}
                          data-action="toggle-set"
                          data-exercise="${ex.id}"
                          data-index="${i}"
                          data-from="${done ? '1' : '0'}"
                          aria-pressed="${done}"
                          aria-label="Serie ${i + 1}">
                    <span class="set-check" aria-hidden="true"></span>
                    <span class="set-line-label">Serie ${i + 1}</span>
                    <span class="set-line-target">${target}</span>
                  </button>`;
        });

        // reps → weight list + total volume; time → duration.
        const wLabel = fmtSeriesWeights(series, unit);
        const vol = seriesVolume(series);
        const statChips = kind === 'time'
          ? html`<span class="stat-chip"><span class="k">Duración</span> ${seriesDuration(series) || '—'}</span>`
          : html`${wLabel ? html`<span class="stat-chip weight"><span class="k">Peso</span> ${wLabel}</span>` : ''}${vol ? html`<span class="stat-chip"><span class="k">Volumen</span> ${vol}</span>` : ''}`;

        const media = parseMedia(safeUrl(ex.video));
        let video = '';
        if (media) {
          if (media.kind === 'link') {
            video = html`<a class="video-link" href="${media.url}" target="_blank" rel="noopener noreferrer">Abrir enlace</a>`;
          } else {
            const open = ui.expandedMedia.has(ex.id);
            const title = media.kind === 'image'
              ? (open ? 'Imagen' : 'Ver imagen')
              : (open ? 'Video' : 'Ver video');
            // Embed only mounts when open — no iframe / <img> network hit
            // until the user opens the panel.
            const body = open ? html`<div class="media-content">${renderMedia(media)}</div>` : '';
            video = html`
              <div class="media-panel${open ? ' open' : ''}">
                <button class="media-toggle"
                        data-action="toggle-media" data-exercise="${ex.id}"
                        aria-expanded="${open}">
                  <span class="media-toggle-title">${title}</span>
                  <span class="media-toggle-chev">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>
                  </span>
                </button>
                ${body}
              </div>
            `;
          }
        }

        const notes = ex.notes ? html`<p class="ex-notes">${ex.notes}</p>` : '';
        const complete = doneCount === setCount && setCount > 0;

        const editActions = editMode ? html`
          <div class="ex-edit-actions">
            <button class="ex-edit"
                    data-action="edit-exercise"
                    data-routine="${routine.id}"
                    data-exercise="${ex.id}"
                    aria-label="Editar ejercicio">✎</button>
            <button class="ex-edit danger-edit"
                    data-action="remove-exercise"
                    data-routine="${routine.id}"
                    data-exercise="${ex.id}"
                    aria-label="Eliminar ejercicio">✕</button>
          </div>
        ` : '';
        const dragHandle = editMode ? html`
          <button class="ex-drag-handle" data-drag-handle aria-label="Arrastrar para reordenar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
              <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
              <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
            </svg>
          </button>
        ` : '';
        return html`
          <article class="exercise ${complete ? 'complete' : ''}" ${dataTest('exercise-card')}${editMode ? html` data-reorder-index="${exIndex}"` : ''}>
            <div class="ex-head">
              ${dragHandle}
              <h3>${ex.name}</h3>
              ${editActions}
            </div>
            ${notes}
            <div class="ex-stats">
              <span class="stat-chip"><span class="k">Series</span> ${setCount}</span>
              ${statChips}
            </div>
            <div class="sets">${sets}</div>
            ${video}
          </article>
        `;
      });

  const { total, done } = countDoneFor(state, date, routine);

  const drawer = editExerciseId
    ? renderDrawer(routine, hydrateExercise(state, routine.exercises.find((e) => e.id === editExerciseId)))
    : '';

  const idx = state.doc.routines.findIndex((x) => x.id === routine.id);
  const num = idx >= 0 ? idx : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return html`
    <header class="workout-bar">
      ${backBtn('#/')}
      <div class="title-block">
        <div class="title">${routine.name}</div>
        <div class="sub">Día ${dayNum(num)} · ${String(done).padStart(2, '0')} / ${String(total).padStart(2, '0')} series</div>
      </div>
      <span></span>
    </header>
    <div class="workout-progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
    ${editMode && routine.exercises.length > 0
      ? html`<div class="exercise-list" data-reorder-list data-reorder-kind="exercise" data-reorder-routine="${routine.id}">${items}</div>`
      : items}
    ${editMode && routine.exercises.length > 0 ? html`
      <div class="fab-row">
        <button class="fab" data-action="add-exercise" data-routine="${routine.id}" aria-label="Agregar ejercicio">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    ` : ''}
    ${!editMode && routine.exercises.length > 0 ? html`
      <div class="bottom-action">
        <button class="ghost" data-action="clear-sets" data-date="${date}">Volver a empezar</button>
      </div>
    ` : ''}
    ${drawer}
    ${bottomBar(state, routine.exercises.length > 0
      ? (editMode
          ? doneBtn
          : html`<button class="tool-btn" data-action="stopwatch" aria-label="Cronómetro">${icons.stopwatch}</button><button class="icon-btn primary" data-go="#/workout/${routine.id}/edit">Editar</button>`)
      : '')}
  `;
};

const renderMedia = (media) => {
  if (media.kind === 'youtube') {
    const cls = media.short ? 'media-wrap short' : 'media-wrap';
    return html`<div class="${cls}"><iframe src="https://www.youtube.com/embed/${media.id}" title="YouTube" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (media.kind === 'image') {
    return html`<div class="media-wrap"><img src="${media.url}" alt="" loading="lazy" /></div>`;
  }
  return '';
};

const renderDrawer = (routine, ex) => {
  if (!ex) return '';
  const kind = exKind(ex);
  const series = exSeries(ex);
  const unit = exUnit(ex);
  // Safe markup with the ids escaped — never raw string interpolation, since
  // imported docs historically controlled these ids.
  const re = html`data-routine="${routine.id}" data-exercise="${ex.id}"`;
  return html`
    <div class="drawer-backdrop" data-action="close-drawer"></div>
    <aside class="drawer" ${dataTest('editor-drawer')} role="dialog" aria-modal="true" aria-label="Editar ejercicio">
      <div class="drawer-head">
        <div class="drawer-handle" aria-hidden="true"></div>
        <div class="drawer-header">
          <h3>Editar ejercicio</h3>
          <button class="icon-btn" data-action="close-drawer" aria-label="Cerrar">✕</button>
        </div>
      </div>
      <div class="drawer-body">
        <div class="field">
          <label>Nombre</label>
          <input type="text" data-update name="name" value="${ex.name}" ${re} />
        </div>
        <div class="field-2col">
          <div class="field">
            <label>Tipo</label>
            <select data-update name="kind" ${re}>
              <option value="reps" ${exKind(ex) === 'reps' ? 'selected' : ''}>Repeticiones</option>
              <option value="time" ${exKind(ex) === 'time' ? 'selected' : ''}>Tiempo (cardio)</option>
            </select>
          </div>
          <div class="field">
            <label>Grupo muscular</label>
            ${categorySelect(ex.category, `data-update ${re}`)}
          </div>
        </div>
        <div class="field">
          <label>Series</label>
          <div class="series-stepper" role="group" aria-label="Cantidad de series">
            <button type="button" class="step-btn" data-action="series-step" data-series-step="-1"
                    ${re} aria-label="Quitar una serie" ${series.length <= 1 ? 'disabled' : ''}>−</button>
            <span class="step-count" aria-live="polite">${series.length}</span>
            <button type="button" class="step-btn" data-action="series-step" data-series-step="1"
                    ${re} aria-label="Agregar una serie" ${series.length >= 20 ? 'disabled' : ''}>+</button>
          </div>
        </div>
        ${kind === 'time' ? html`
        <div class="field">
          <label>Duración</label>
          <input type="text" data-update name="duration" value="${seriesDuration(series)}" ${re}
                 placeholder="30-60 seg" />
        </div>
        ` : html`
        <div class="field">
          <div class="series-weights-head">
            <label>Peso × reps por serie</label>
            <select class="unit-select" data-update name="unit" ${re}>
              <option value="kg" ${unit === 'kg' ? 'selected' : ''}>kg</option>
              <option value="lb" ${unit === 'lb' ? 'selected' : ''}>lb</option>
            </select>
          </div>
          <div class="series-grid">
            ${series.map((s, i) => html`
              <div class="series-row">
                <span class="series-row-num">${i + 1}</span>
                <div class="series-input-wrap">
                  <input type="number" inputmode="decimal" step="0.5" class="series-weight-input"
                         data-update name="series-weight" data-set-index="${i}" ${re}
                         value="${s.weight ?? ''}" placeholder="—" aria-label="Peso serie ${i + 1}" />
                  <span class="series-input-unit">${unit}</span>
                </div>
                <span class="series-row-x" aria-hidden="true">×</span>
                <div class="series-input-wrap">
                  <input type="number" inputmode="numeric" step="1" min="0" class="series-reps-input"
                         data-update name="series-reps" data-set-index="${i}" ${re}
                         value="${s.reps ?? ''}" placeholder="—" aria-label="Reps serie ${i + 1}" />
                  <span class="series-input-unit">reps</span>
                </div>
              </div>`)}
          </div>
        </div>
        `}
        <div class="field">
          <label>Imagen o video (URL)</label>
          <input type="text" data-update name="video" value="${ex.video ?? ''}" ${re}
                 placeholder="https://youtu.be/... o https://.../foto.jpg" />
        </div>
        <div class="field">
          <label>Notas</label>
          <input type="text" data-update name="notes" value="${ex.notes ?? ''}" ${re} />
        </div>
        <div class="bottom-action">
          <button class="primary" data-action="close-drawer">Listo</button>
        </div>
      </div>
    </aside>
  `;
};

// ---------- Dashboard ----------

const HEATMAP_WEEKS = 14;

// Build a 7×HEATMAP_WEEKS grid (rows = weekday, cols = week) of cells
// ending at the current week (Monday-start). Each cell has a date key and
// an intensity level 0..4 based on sets done that day.
const renderHeatmap = (state) => {
  const activity = dayActivityMap(state);
  const maxIntensity = Math.max(1, ...activity.values());
  const today = new Date();
  // Anchor to Monday of the current week (Lunes-start to feel European).
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);

  const cells = [];
  // Render row-major so reading order matches: row=weekday (Mon..Sun),
  // col=week (oldest..current). The grid uses CSS to flip to columns.
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < HEATMAP_WEEKS; col++) {
      const offsetDays = -((HEATMAP_WEEKS - 1 - col) * 7) + row;
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const n = activity.get(key) ?? 0;
      let lvl = 0;
      if (n > 0) {
        const ratio = n / maxIntensity;
        lvl = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      }
      const future = d > today;
      cells.push(html`<div class="heatmap-cell lvl-${lvl}${future ? ' future' : ''}"
        data-date="${key}" title="${key} · ${n} series"></div>`);
    }
  }

  return html`
    <div class="heatmap" style="grid-template-columns:repeat(${HEATMAP_WEEKS},1fr)">${cells}</div>
    <div class="heatmap-legend">
      <span>menos</span>
      <div class="heatmap-cell lvl-0"></div>
      <div class="heatmap-cell lvl-1"></div>
      <div class="heatmap-cell lvl-2"></div>
      <div class="heatmap-cell lvl-3"></div>
      <div class="heatmap-cell lvl-4"></div>
      <span>más</span>
    </div>`;
};

// Tiny SVG sparkline for the latest-exercises cards. Pads to a fixed range
// so flat histories don't collapse to a degenerate line.
const renderSparkline = (history) => {
  const points = history
    .map((row) => rowChartValue(row))
    .filter((n) => Number.isFinite(n));
  if (points.length === 0) {
    return html`<svg class="spark" viewBox="0 0 80 22" aria-hidden="true"><line x1="0" y1="11" x2="80" y2="11" stroke="currentColor" stroke-opacity="0.18" stroke-width="1.5" stroke-dasharray="3 3"/></svg>`;
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const last = points.slice(-12);
  const stepX = last.length > 1 ? 80 / (last.length - 1) : 0;
  const coords = last.map((v, i) => {
    const x = (i * stepX).toFixed(1);
    const y = (20 - ((v - min) / range) * 18).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  const lastX = last.length > 1 ? (80).toFixed(1) : '40';
  const lastY = (20 - ((last[last.length - 1] - min) / range) * 18).toFixed(1);
  return html`
    <svg class="spark" viewBox="0 0 80 22" aria-hidden="true">
      <polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastX}" cy="${lastY}" r="2" fill="currentColor"/>
    </svg>`;
};

const renderDashboard = (state) => {
  const activity = dayActivityMap(state);
  const trainedDays = activity.size;

  const catalog = buildCatalog(state).filter((c) => c.lastDate);
  const cards = catalog.slice(0, 24).map((c) => {
    const history = buildExerciseHistory(state, c.name);
    return html`
      <button class="latest-card" data-go="#/dashboard/ex/${slugify(c.displayName)}">
        <div class="latest-badge">
          <span class="latest-badge-value">${c.lastWeight?.value ?? '—'}</span>
          <span class="latest-badge-unit">${c.lastWeight?.unit ?? ''}</span>
        </div>
        <div class="latest-body">
          <div class="latest-name">${c.displayName}</div>
          <div class="latest-meta">
            <span>${fmtRelDay(c.lastDate)}</span>
            <span class="dot" aria-hidden="true">·</span>
            <span>${c.sessionCount} ${c.sessionCount === 1 ? 'sesión' : 'sesiones'}</span>
          </div>
        </div>
        <div class="latest-spark">${renderSparkline(history)}</div>
      </button>`;
  });

  const empty = catalog.length === 0
    ? html`<div class="empty-state">
         <div class="empty-icon" aria-hidden="true">▦</div>
         <p>Todavía no marcaste ninguna serie. Cuando registres tu primer entrenamiento vas a ver tu progreso acá.</p>
       </div>`
    : '';

  return html`
    <header class="workout-bar">
      ${backBtn('#/')}
      <div class="title-block">
        <div class="title">Progreso</div>
        <div class="sub">${trainedDays} ${trainedDays === 1 ? 'día entrenado' : 'días entrenados'}</div>
      </div>
      <span></span>
    </header>
    <div class="section">
      <span class="label">Actividad</span>
      <span class="count">${String(trainedDays).padStart(2, '0')}</span>
    </div>
    ${renderHeatmap(state)}
    <div class="section">
      <span class="label">Últimos ejercicios</span>
      <span class="count">${String(catalog.length).padStart(2, '0')}</span>
    </div>
    ${empty}
    <div class="latest-list">${cards}</div>
    ${bottomBar(state)}
  `;
};

// ---------- Exercise detail ----------

// Bar chart of total volume (reps) or duration (time) per day over the last 30
// days. One bar per session, so the same exercise done in two routines on the
// same day shows two adjacent bars. y-axis = volume/time, x-axis = the last 30
// calendar days, making progression over time easy to read.
const renderBarChart = (rows, kind) => {
  const WINDOW = 30;
  // Build the day keys for the last WINDOW days, oldest first.
  const dayKeys = [];
  const base = new Date();
  for (let i = WINDOW - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dayKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const firstKey = dayKeys[0];
  const lastKey = dayKeys[dayKeys.length - 1];

  // Group the in-window rows (with a numeric value) by day key.
  const byDay = new Map();
  for (const r of rows) {
    if (r.date < firstKey || r.date > lastKey) continue;
    const v = rowChartValue(r);
    if (v == null) continue;
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date).push(v);
  }

  const allValues = [...byDay.values()].flat();
  if (allValues.length === 0) {
    return html`<div class="detail-chart-empty">Todavía no hay ${kind === 'time' ? 'tiempos' : 'registros'} en los últimos 30 días.</div>`;
  }
  const max = Math.max(...allValues, 1);
  // reps → volume (kg·reps, shown unitless); time → no unit either.
  const unit = '';

  const padTop = 14;
  const padBottom = 28;
  const padLeft = 38;
  const padRight = 12;
  const w = 360;
  const h = 180;
  const innerW = w - padLeft - padRight;
  const innerH = h - padTop - padBottom;
  const baseY = padTop + innerH;
  const slotW = innerW / WINDOW;

  const bars = [];
  dayKeys.forEach((key, di) => {
    const vals = byDay.get(key);
    if (!vals || vals.length === 0) return;
    const slotX = padLeft + di * slotW;
    const groupW = slotW * 0.82;
    const groupX = slotX + (slotW - groupW) / 2;
    const barW = groupW / vals.length;
    vals.forEach((v, j) => {
      const barH = (v / max) * innerH;
      const x = groupX + j * barW;
      const rectW = Math.max(1, barW - (vals.length > 1 ? 1 : 0));
      bars.push(html`<rect class="detail-bar" x="${x.toFixed(1)}" y="${(baseY - barH).toFixed(1)}" width="${rectW.toFixed(1)}" height="${Math.max(0, barH).toFixed(1)}" rx="1"><title>${fmtShortDate(key)}: ${v}${unit ? ` ${unit}` : ''}</title></rect>`);
    });
  });

  const fmtMax = Number.isInteger(max) ? max : Number(max.toFixed(1));

  return html`
    <svg class="detail-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${padLeft}" y1="${baseY.toFixed(1)}" x2="${(padLeft + innerW).toFixed(1)}" y2="${baseY.toFixed(1)}" class="axis"/>
      <text x="${padLeft - 6}" y="${padTop + 4}" class="axis-label" text-anchor="end">${fmtMax}</text>
      <text x="${padLeft - 6}" y="${baseY.toFixed(1)}" class="axis-label" text-anchor="end">0</text>
      <text x="${padLeft}" y="${h - 8}" class="axis-label" text-anchor="start">${fmtShortDate(firstKey)}</text>
      <text x="${(padLeft + innerW).toFixed(1)}" y="${h - 8}" class="axis-label" text-anchor="end">${fmtShortDate(lastKey)}</text>
      ${bars}
      ${unit ? html`<text x="${(w - padRight).toFixed(1)}" y="${padTop + 4}" class="axis-unit" text-anchor="end">${unit}</text>` : ''}
    </svg>`;
};

const renderExerciseDetail = (state, slug, editMode, origin = 'dashboard') => {
  const home = origin === 'catalog' ? '#/catalog' : '#/dashboard';
  const homeLabel = origin === 'catalog' ? 'Volver al catálogo' : 'Volver al progreso';
  const normName = normalizeName(unslug(slug));
  const all = buildExerciseHistory(state, normName);
  if (all.length === 0 && !buildCatalog(state).some((c) => c.name === normName)) {
    // Unknown slug — bounce to the origin list rather than render an empty
    // page, and fix the URL so a refresh doesn't re-bounce.
    history.replaceState(null, '', home);
    return origin === 'catalog' ? renderCatalog(state, 'view') : renderDashboard(state);
  }
  const catalogEntry = buildCatalog(state).find((c) => c.name === normName);
  const displayName = catalogEntry?.displayName ?? unslug(slug);
  const detailKind = exKind(catalogEntry?.template ?? all[all.length - 1] ?? {});

  let filtered = all;
  if (ui.detailRange === '30d') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    filtered = all.filter((r) => r.date >= cutoffKey);
  }

  const sessions = [...filtered].reverse();
  const sessionItems = sessions.map((r) => {
    const routine = r.routineId ? state.doc.routines.find((x) => x.id === r.routineId) : null;
    const routineIdx = routine ? state.doc.routines.findIndex((x) => x.id === routine.id) : -1;
    const routineLabel = routine ? `Día ${dayNum(routineIdx)}` : '—';
    const weightLabel = r.kind === 'time'
      ? (seriesDuration(r.series) || '—')
      : (fmtSeriesWeights(r.series, r.unit) ?? '—');
    return html`
      <li class="session-row">
        <span class="session-date">${fmtShortDate(r.date)}</span>
        <span class="session-routine">${routineLabel}</span>
        <span class="session-weight">${weightLabel}</span>
        <span class="session-sets mono">${r.setsDone}/${r.setsTotal}</span>
      </li>`;
  });

  const drawer = editMode && catalogEntry
    ? renderCatalogEditDrawer(state, catalogEntry)
    : '';

  return html`
    <header class="workout-bar">
      ${backBtn(home, homeLabel)}
      <div class="title-block">
        <div class="title">${displayName}</div>
        <div class="sub">${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}${catalogEntry?.usedIn?.length ? ` · ${catalogEntry.usedIn.length} ${catalogEntry.usedIn.length === 1 ? 'rutina' : 'rutinas'}` : ''}</div>
      </div>
      ${catalogEntry ? html`<button class="tool-btn" data-go="#/${origin}/ex/${slug}/edit" aria-label="Editar ejercicio">${icons.edit}</button>` : html`<span></span>`}
    </header>

    <div class="section">
      <span class="label">Progreso</span>
      <div class="range-toggle" role="tablist">
        <button class="range-opt ${ui.detailRange === '30d' ? 'on' : ''}" data-action="detail-range" data-detail-range="30d" role="tab" aria-selected="${ui.detailRange === '30d'}">30 días</button>
        <button class="range-opt ${ui.detailRange === 'all' ? 'on' : ''}" data-action="detail-range" data-detail-range="all" role="tab" aria-selected="${ui.detailRange === 'all'}">Todo</button>
      </div>
    </div>
    <div class="detail-chart-wrap" ${dataTest('exercise-detail')}>${renderBarChart(all, detailKind)}</div>

    <div class="section">
      <span class="label">Sesiones</span>
      <span class="count">${String(sessions.length).padStart(2, '0')}</span>
    </div>
    ${sessions.length === 0
      ? html`<p class="muted small" style="padding:1rem 0.25rem">Sin sesiones en este rango.</p>`
      : html`<ul class="session-list">${sessionItems}</ul>`}

    ${drawer}
    ${bottomBar(state)}
  `;
};

// ---------- Catalog screen ----------
// The exercise catalog, on its own screen. `mode`:
//   'view' — navigate the list (a row opens the exercise detail)
//   'edit' — add / edit / delete exercises (entered via the "Editar" button)
//   'pick' — choose an exercise to insert into `routineId`, then return to the
//            workout editor (reached from the workout-edit FAB)
// ---------- Exercise categories ----------
// The muscle group is an explicit field the user picks when creating/editing an
// exercise (CATEGORIES below). It groups and color-codes the catalog so a long
// flat list reads as a real library. For entries that predate the field (old
// imports), `categoryOf` falls back to a keyword guess so they still land
// somewhere sensible; the rule order resolves overlaps — "remo al mentón" is a
// shoulder move even though it says "remo"; "curl femoral" is legs not arms.

const CATEGORIES = {
  pecho:   { label: 'Pecho',   color: '#f0683c' },
  espalda: { label: 'Espalda', color: '#37b6a6' },
  hombros: { label: 'Hombros', color: '#e8a13a' },
  piernas: { label: 'Piernas', color: '#9b86f3' },
  brazos:  { label: 'Brazos',  color: '#4d9bf0' },
  core:    { label: 'Core',    color: '#5bbf6a' },
  otros:   { label: 'Otros',   color: '#8d96a4' },
};
const CATEGORY_ORDER = ['pecho', 'espalda', 'hombros', 'piernas', 'brazos', 'core', 'otros'];
const CATEGORY_RULES = [
  ['hombros', /militar|hombro|lateral|ment[oó]n|upright|deltoid|shoulder|overhead/],
  ['espalda', /peso muerto|remo|jal[oó]n|dominad|espalda|dorsal|pulldown|deadlift|\brow\b|\blat\b/],
  ['piernas', /sentadilla|pierna|prensa|cu[aá]driceps|tal[oó]n|calf|gl[uú]teo|femoral|hamstring|b[uú]lgar|\bleg\b|squat|quad/],
  ['brazos',  /curl|b[ií]ceps|tr[ií]ceps|franc[eé]s|bicep|tricep/],
  ['pecho',   /banca|pecho|inclinad|apertura|bench|chest|\bfly\b/],
  ['core',    /plancha|abdominal|plank|core|crunch|cardio|oblicuo/],
];
const VALID_CATEGORY = new Set(CATEGORY_ORDER);
// Resolve a catalog row's group: the stored field wins; legacy entries without
// one fall back to a keyword guess.
const categoryOf = (c) => {
  const explicit = c.template?.category ?? c.category;
  if (explicit && VALID_CATEGORY.has(explicit)) return explicit;
  const hay = `${c.displayName} ${c.template?.notes ?? ''}`.toLowerCase();
  for (const [key, re] of CATEGORY_RULES) if (re.test(hay)) return key;
  return c.kind === 'time' ? 'core' : 'otros';
};
// Normalize any raw category string to a valid key (used when storing).
const normCategory = (v) => (VALID_CATEGORY.has(v) ? v : 'otros');
const categoryTile = (catKey, kind) => {
  const cat = CATEGORIES[catKey] || CATEGORIES.otros;
  return html`<span class="cat-tile" style="--cat:${cat.color}">${kind === 'time' ? icons.clock : icons.dumbbell}</span>`;
};
// A <select> of muscle groups, pre-selected to `selected`. Extra attrs (e.g.
// data-cat-update / data-update + ids) are trusted markup, passed through.
const categorySelect = (selected, attrs = '') => html`
  <select name="category" ${raw(attrs)}>
    ${CATEGORY_ORDER.map((k) => html`<option value="${k}" ${normCategory(selected) === k ? 'selected' : ''}>${CATEGORIES[k].label}</option>`)}
  </select>`;

// Secondary line of small chips: routine usage (kept in the "Día 02 + Día 05"
// format), last lifted weight (only when one exists), session count, and an
// in-routine marker for pick mode.
const catalogChips = (c, { inRoutine = false } = {}) => {
  const chips = [];
  if (inRoutine) chips.push(html`<span class="cat-chip in">✓ En la rutina</span>`);
  const used = c.usedIn.map((u) => `Día ${dayNum(u.routineIndex)}`).join(' + ');
  if (used) chips.push(html`<span class="cat-chip">${used}</span>`);
  const w = fmtWeight(c.lastWeight);
  if (w) chips.push(html`<span class="cat-chip weight">${w}</span>`);
  if (c.sessionCount) chips.push(html`<span class="cat-chip">${c.sessionCount} ${c.sessionCount === 1 ? 'sesión' : 'sesiones'}</span>`);
  if (!chips.length) chips.push(html`<span class="cat-chip ghost">Sin uso aún</span>`);
  return html`<span class="cat-chips">${chips}</span>`;
};

const catalogRowInner = (c, catKey, opts) => html`
  ${categoryTile(catKey, c.kind)}
  <span class="catalog-text">
    <span class="catalog-name">${c.displayName}</span>
    ${catalogChips(c, opts)}
  </span>`;

const renderCatalog = (state, mode = 'view', routineId = null) => {
  const isPick = mode === 'pick';
  const isEdit = mode === 'edit';
  const routine = isPick ? state.doc.routines.find((r) => r.id === routineId) : null;
  if (isPick && !routine) return renderHome(state);

  const filter = normalizeName(ui.catalogFilter);
  // Only real catalog entries are listed; history-only rows (deleted exercises)
  // have no catalogId and aren't referenceable.
  const all = buildCatalog(state).filter((c) => c.catalogId);
  const list = all.filter((c) => !filter || c.name.includes(filter));

  const renderRow = (c) => {
    const catKey = categoryOf(c);
    const slug = slugify(c.displayName);
    if (isPick) {
      const inRoutine = routine.exercises.some((inst) => inst.catalogId === c.catalogId);
      return html`<li ${dataTest('catalog-item')}><button class="catalog-row" data-action="pick-catalog" data-name="${c.displayName}">${catalogRowInner(c, catKey, { inRoutine })}<span class="catalog-chev plus" aria-hidden="true">＋</span></button></li>`;
    }
    if (isEdit) {
      return html`
        <li class="catalog-manage-row" ${dataTest('catalog-item')}>
          <button class="catalog-row" data-go="#/catalog/ex/${slug}/edit">${catalogRowInner(c, catKey)}<span class="catalog-chev" aria-hidden="true">✎</span></button>
          <button class="catalog-del-btn" ${dataTest('catalog-delete')} data-action="delete-catalog" data-name="${c.displayName}" aria-label="Eliminar ${c.displayName}">${icons.trash}</button>
        </li>`;
    }
    return html`<li ${dataTest('catalog-item')}><button class="catalog-row" data-go="#/catalog/ex/${slug}">${catalogRowInner(c, catKey)}<span class="catalog-chev" aria-hidden="true">›</span></button></li>`;
  };

  // Group rows into muscle-group sections, ordered by CATEGORY_ORDER, alpha
  // within each. Empty groups (e.g. while filtering) are skipped.
  const groups = new Map();
  for (const c of list) {
    const key = categoryOf(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const items = CATEGORY_ORDER.filter((k) => groups.has(k)).map((k) => {
    const rows = groups.get(k).sort((a, b) => a.displayName.localeCompare(b.displayName));
    const cat = CATEGORIES[k];
    return html`
      <div class="catalog-group">
        <div class="catalog-group-head" style="--cat:${cat.color}">
          <span class="catalog-group-dot" aria-hidden="true"></span>
          <span class="catalog-group-label">${cat.label}</span>
          <span class="catalog-group-count">${String(rows.length).padStart(2, '0')}</span>
        </div>
        <ul class="catalog-list">${rows.map(renderRow)}</ul>
      </div>`;
  });

  const title = isPick ? 'Agregar ejercicio' : 'Catálogo';
  const backHref = isPick ? `#/workout/${routine.id}/edit` : '#/';
  // Create-new affordance: in pick mode a labelled button that also adds the
  // new exercise to the routine; in edit mode a FAB at the bottom.
  const newBtn = isPick
    ? html`<button class="catalog-new" data-action="add-catalog-exercise" data-routine="${routine.id}">
         <span class="catalog-new-icon" aria-hidden="true">＋</span>
         <span class="catalog-new-text">
           <span class="catalog-new-title">Crear ejercicio nuevo</span>
           <span class="catalog-new-sub">Agregar al catálogo y a la rutina</span>
         </span>
       </button>`
    : '';
  const fab = isEdit ? html`
    <div class="fab-row">
      <button class="fab" ${dataTest('catalog-create')} data-action="add-catalog-exercise" aria-label="Crear ejercicio">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>` : '';
  const primary = isPick ? ''
    : (isEdit
        ? html`<button class="icon-btn primary" data-go="#/catalog">Listo</button>`
        : html`<button class="icon-btn primary" data-go="#/catalog/edit">Editar</button>`);

  return html`
    <div class="screen-head">
      <header class="workout-bar">
        ${backBtn(backHref, isPick ? 'Volver a la rutina' : 'Volver al inicio')}
        <div class="title-block">
          <div class="title">${title}</div>
          <div class="sub">${list.length} ${list.length === 1 ? 'ejercicio' : 'ejercicios'}</div>
        </div>
        <span></span>
      </header>
      ${searchField('catalog-filter', ui.catalogFilter, { test: dataTest('catalog-search') })}
    </div>
    ${newBtn}
    ${items.length ? items
        : (filter ? emptySearch(ui.catalogFilter, isPick ? routineId : null)
                  : html`<p class="muted small" style="padding:0.5rem 0.25rem">No hay ejercicios todavía.</p>`)}
    ${fab}
    ${bottomBar(state, primary)}
  `;
};

// ---------- Catalog edit drawer ----------

const renderCatalogEditDrawer = (state, catalogEntry) => {
  const template = catalogEntry.template ?? { video: '', notes: '' };
  const usedCount = catalogEntry.usedIn.length;
  return html`
    <div class="drawer-backdrop" data-action="close-catalog-edit"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Editar ejercicio del catálogo">
      <div class="drawer-head">
        <div class="drawer-handle" aria-hidden="true"></div>
        <div class="drawer-header">
          <h3>Editar ejercicio</h3>
          <button class="icon-btn" data-action="close-catalog-edit" aria-label="Cerrar">✕</button>
        </div>
      </div>
      <div class="drawer-body">
        <p class="edit-hint">El nombre, la imagen y las notas se aplican a las <em>${usedCount}</em> rutina${usedCount === 1 ? '' : 's'} que usan este ejercicio. El peso y las reps se ajustan en cada rutina.</p>
        <div class="field">
          <label>Nombre</label>
          <input type="text" data-cat-update name="name" value="${catalogEntry.displayName}" />
        </div>
        <div class="field">
          <label>Grupo muscular</label>
          ${categorySelect(template.category, 'data-cat-update')}
        </div>
        <div class="field">
          <label>Imagen o video (URL)</label>
          <input type="text" data-cat-update name="video" value="${template.video ?? ''}"
                 placeholder="https://youtu.be/..." />
        </div>
        <div class="field">
          <label>Notas</label>
          <input type="text" data-cat-update name="notes" value="${template.notes ?? ''}" />
        </div>
        <div class="bottom-action">
          <button class="primary" data-action="close-catalog-edit">Listo</button>
        </div>
        <div class="bottom-action">
          <button class="danger" data-action="delete-catalog" data-name="${catalogEntry.displayName}">
            Eliminar ejercicio
          </button>
        </div>
        ${usedCount > 0 ? html`
        <p class="muted small" style="padding:0.5rem 0.25rem">Se quitará de la${usedCount === 1 ? '' : 's'} ${usedCount} rutina${usedCount === 1 ? '' : 's'} que lo usa${usedCount === 1 ? '' : 'n'}. Las sesiones registradas se mantienen.</p>` : ''}
      </div>
    </aside>
  `;
};

// ---------- Guided week builder ----------
// A step-per-day wizard (Día 1 → N) that makes filling the whole week feel
// self-guided: name the day, add exercises via a multi-select sheet, set reps,
// move on. It edits the existing routines in place (one per day, by order); an
// empty day simply reads as a rest day everywhere else.

// One-line summary of an exercise instance for the builder rows.
const exerciseSummary = (ex) => {
  const series = exSeries(ex);
  if (exKind(ex) === 'time') return seriesDuration(series) || 'Sin duración';
  const n = series.length;
  const reps = series.map((s) => numOrNull(s.reps));
  const uniform = reps.length && reps.every((r) => r === reps[0]) ? reps[0] : null;
  const w = fmtSeriesWeights(series, exUnit(ex));
  const repsPart = uniform != null ? `${n} × ${uniform}` : `${n} series`;
  return w ? `${repsPart} · ${w}` : repsPart;
};

// Build a fresh routine reference for a catalog row: 3 sets, reps default to 10
// (a sensible starting point), weight prefilled from the last known value.
const instanceFromCatalog = (cat) => {
  const prefillW = cat.lastWeight ? cat.lastWeight.value : null;
  const series = makeSeries(3, cat.kind).map((s) =>
    cat.kind === 'time' ? s : { ...s, weight: prefillW, reps: 10 });
  return { id: uid(), catalogId: cat.catalogId, series };
};

const renderBuild = (state, step, editExerciseId) => {
  const routines = state.doc.routines;
  if (routines.length === 0) return renderHome(state);
  const idx = Math.min(step, routines.length - 1);
  const routine = routines[idx];
  const total = routines.length;
  const isLast = idx >= total - 1;

  const dots = routines.map((r, i) => {
    const filled = r.exercises.length > 0;
    const cls = i === idx ? 'on' : (filled ? 'done' : '');
    return html`<span class="build-dot ${cls}" aria-hidden="true"></span>`;
  });

  const exItems = routine.exercises.map((inst) => {
    const ex = hydrateExercise(state, inst);
    const catKey = categoryOf({ category: ex.category, displayName: ex.name, kind: ex.kind });
    return html`
      <div class="build-ex">
        ${categoryTile(catKey, ex.kind)}
        <div class="build-ex-text">
          <span class="build-ex-name">${ex.name}</span>
          <span class="build-ex-sub">${exerciseSummary(ex)}</span>
        </div>
        <button class="build-ex-btn" data-action="build-edit" data-routine="${routine.id}" data-exercise="${ex.id}" data-step="${idx}" aria-label="Editar ${ex.name}">${icons.edit}</button>
        <button class="build-ex-btn danger-edit" data-action="remove-exercise" data-routine="${routine.id}" data-exercise="${ex.id}" aria-label="Quitar ${ex.name}">${icons.trash}</button>
      </div>`;
  });

  const body = routine.exercises.length === 0
    ? html`<div class="build-empty">
         <p>Agregá los ejercicios de este día, o dejalo vacío para marcarlo como <strong>descanso</strong>.</p>
       </div>`
    : html`<div class="build-ex-list">${exItems}</div>`;

  const drawer = editExerciseId
    ? renderDrawer(routine, hydrateExercise(state, routine.exercises.find((e) => e.id === editExerciseId)))
    : '';

  return html`
    <header class="build-bar">
      <button class="back-btn" data-action="build-finish" aria-label="Salir del armado">✕</button>
      <div class="build-progress">
        <div class="build-step-label">Armar mi semana · Paso ${idx + 1} de ${total}</div>
        <div class="build-dots">${dots}</div>
      </div>
      <span></span>
    </header>

    <div class="build-day">
      <span class="build-day-eyebrow">Día ${dayWord(idx)}</span>
      <input class="build-day-name" type="text" data-rename-routine data-routine="${routine.id}"
             value="${routine.name}" placeholder="Nombre del día" aria-label="Nombre del día" maxlength="80" />
      ${body}
      <button class="build-add" data-action="build-add" data-routine="${routine.id}">
        <span class="build-add-icon" aria-hidden="true">＋</span>
        Agregar ejercicios
      </button>
    </div>

    <nav class="build-nav">
      <button class="ghost" data-go="#/build/${idx - 1}" ${idx === 0 ? 'disabled' : ''}>Atrás</button>
      ${isLast
        ? html`<button class="primary" data-action="build-finish">Terminar</button>`
        : html`<button class="primary" data-go="#/build/${idx + 1}">Siguiente</button>`}
    </nav>
    ${drawer}
  `;
};

// Multi-select picker sheet over a build step: tick several exercises, "Agregar
// (N)" inserts them all into the day at once.
const renderBuildPickSheet = (state, step) => {
  const routine = state.doc.routines[Math.min(step, state.doc.routines.length - 1)];
  if (!routine) return '';
  const filter = normalizeName(ui.buildPickFilter);
  const all = buildCatalog(state).filter((c) => c.catalogId);
  const list = all.filter((c) => !filter || c.name.includes(filter));

  const groups = new Map();
  for (const c of list) {
    const key = categoryOf(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const sections = CATEGORY_ORDER.filter((k) => groups.has(k)).map((k) => {
    const rows = groups.get(k).sort((a, b) => a.displayName.localeCompare(b.displayName));
    const cat = CATEGORIES[k];
    const rowsHtml = rows.map((c) => {
      const sel = ui.buildPickSelected.has(c.catalogId);
      const inRoutine = routine.exercises.some((inst) => inst.catalogId === c.catalogId);
      return html`
        <button class="build-pick-row ${sel ? 'sel' : ''}" data-action="build-pick-toggle" data-catalog-id="${c.catalogId}">
          <span class="build-pick-check" aria-hidden="true"></span>
          ${categoryTile(k, c.kind)}
          <span class="build-pick-name">${c.displayName}${inRoutine ? html` <span class="build-pick-in">ya está</span>` : ''}</span>
        </button>`;
    });
    return html`
      <div class="catalog-group">
        <div class="catalog-group-head" style="--cat:${cat.color}">
          <span class="catalog-group-dot" aria-hidden="true"></span>
          <span class="catalog-group-label">${cat.label}</span>
        </div>
        <div class="build-pick-list">${rowsHtml}</div>
      </div>`;
  });

  const n = ui.buildPickSelected.size;
  return html`
    <div class="drawer-backdrop" data-action="build-pick-cancel"></div>
    <aside class="drawer build-pick-drawer" role="dialog" aria-modal="true" aria-label="Agregar ejercicios">
      <div class="drawer-head">
        <div class="drawer-handle" aria-hidden="true"></div>
        <div class="drawer-header">
          <h3>Agregar a ${routine.name}</h3>
          <button class="icon-btn" data-action="build-pick-cancel" aria-label="Cerrar">✕</button>
        </div>
        ${searchField('build-pick-filter', ui.buildPickFilter)}
      </div>
      <div class="drawer-body">
        <button class="catalog-new" data-action="add-catalog-exercise">
          <span class="catalog-new-icon" aria-hidden="true">＋</span>
          <span class="catalog-new-text">
            <span class="catalog-new-title">Crear ejercicio nuevo</span>
            <span class="catalog-new-sub">Se agrega al catálogo</span>
          </span>
        </button>
        ${sections.length ? sections
            : (filter ? emptySearch(ui.buildPickFilter)
                      : html`<p class="muted small" style="padding:0.5rem 0.25rem">No hay ejercicios todavía.</p>`)}
      </div>
      <div class="build-pick-foot">
        <button class="primary" data-action="build-pick-commit" ${n === 0 ? 'disabled' : ''}>
          ${n === 0 ? 'Elegí ejercicios' : `Agregar ${n}`}
        </button>
      </div>
    </aside>
  `;
};

const renderEdit = (state) => {
  const items = state.doc.routines.map((r, i) => html`
    <div class="edit-row" data-reorder-index="${i}" data-routine-id="${r.id}">
      <button class="drag-handle" data-drag-handle aria-label="Arrastrar para reordenar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
          <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
          <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>
      </button>
      <span class="rc-badge">${dayNum(i)}</span>
      <input class="edit-row-name" type="text"
             data-rename-routine data-routine="${r.id}"
             value="${r.name}" aria-label="Nombre de la rutina" />
      <button class="ex-edit danger-edit"
              data-action="remove-routine" data-routine="${r.id}"
              aria-label="Eliminar rutina">✕</button>
    </div>
  `);

  return html`
    <header class="app-bar">
      <div class="app-bar-left">
        ${backBtn('#/')}
      </div>
    </header>
    <div class="section">
      <span class="label">Editar rutinas</span>
      <span class="count">${String(state.doc.routines.length).padStart(2, '0')}</span>
    </div>
    <p class="edit-hint">Renombrá, reordená o eliminá rutinas. Para editar los ejercicios de una rutina, abríla y tocá <em>Editar</em>.</p>
    <button class="build-cta" data-go="#/build/0">
      <span class="build-cta-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/></svg>
      </span>
      <span class="build-cta-text">
        <span class="build-cta-title">Armar mi semana</span>
        <span class="build-cta-sub">Guía paso a paso para todos los días</span>
      </span>
      <span class="catalog-chev" aria-hidden="true">›</span>
    </button>
    <div class="edit-list" ${dataTest('routines-editor')} data-reorder-list>${items}</div>
    <div class="fab-row">
      <button class="fab" data-action="add-routine" aria-label="Nueva rutina">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
    ${bottomBar(state, doneBtn)}
  `;
};

// ---------- render dispatch ----------

// route.name → view. Each adapts the route object to the renderer's arguments,
// keeping the renderX signatures untouched.
const views = {
  home: (s) => renderHome(s),
  workout: (s, r) => renderWorkout(s, r.routineId, r.editExerciseId, !!r.editMode),
  edit: (s) => renderEdit(s),
  log: (s) => renderLog(s),
  motivation: () => renderMotivation(),
  dashboard: (s) => renderDashboard(s),
  catalog: (s, r) => renderCatalog(s, r.mode, r.routineId),
  exercise: (s, r) => renderExerciseDetail(s, r.slug, !!r.editMode, r.origin),
  build: (s, r) => renderBuild(s, r.step, r.editExerciseId),
};
// Overlays append to the main view, in stacking order, when their flag is set.
const overlays = [
  { when: (r) => ui.buildPickOpen && r.name === 'build', html: (s, r) => renderBuildPickSheet(s, r.step) },
  { when: () => ui.menuOpen, html: () => renderMenuSheet() },
  { when: () => ui.newRoutineOpen, html: () => renderNewRoutineSheet() },
  { when: () => ui.catalogFormOpen, html: () => renderCatalogFormSheet() },
  { when: () => stopwatchOpen, html: () => renderStopwatchSheet() },
];

const render = (state) => {
  const route = parseRoute();
  // The catalog-edit drawer's bulk dispatchers read `ui.catalogEditName` to
  // know which exercise's instances to update. Keep it in sync with the
  // route so navigation alone is enough state.
  ui.catalogEditName = (route.name === 'exercise' && route.editMode)
    ? normalizeName(unslug(route.slug))
    : null;
  let html = (views[route.name] ?? views.home)(state, route);
  for (const o of overlays) if (o.when(route)) html += o.html(state, route);

  const exerciseEditDrawerOpen = route.name === 'exercise' && !!route.editMode;
  const buildDrawerOpen = route.name === 'build' && (!!route.editExerciseId || ui.buildPickOpen);
  const drawerOpen = (route.name === 'workout' && !!route.editExerciseId) || ui.menuOpen || ui.newRoutineOpen || ui.catalogFormOpen || stopwatchOpen || exerciseEditDrawerOpen || buildDrawerOpen;
  const suppressDrawerAnim = drawerOpen && ui.lastDrawerOpen;
  const drawerJustOpened = drawerOpen && !ui.lastDrawerOpen;

  const routeKey = JSON.stringify(route);
  const sameRoute = routeKey === ui.lastRouteKey;

  const snap = captureUIState();
  mount(html);
  if (suppressDrawerAnim) {
    const drawer = root.querySelector('.drawer');
    const backdrop = root.querySelector('.drawer-backdrop');
    if (drawer) drawer.classList.add('no-anim');
    if (backdrop) backdrop.classList.add('no-anim');
  }
  restoreUIState(snap);

  // Scroll: keep position on same-route re-renders (undo, set toggles,
  // weight changes…), reset to top when the URL actually changed.
  if (sameRoute) {
    window.scrollTo({ top: snap.pageScroll || 0, left: 0, behavior: 'instant' });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  if (drawerOpen) document.body.setAttribute('data-drawer-open', '');
  else document.body.removeAttribute('data-drawer-open');
  ui.lastDrawerOpen = drawerOpen;
  ui.lastRouteKey = routeKey;

  // Auto-focus the name field when the new-routine drawer first opens.
  if (ui.newRoutineOpen) {
    const input = document.getElementById('new-routine-name');
    if (input && document.activeElement !== input) {
      requestAnimationFrame(() => input.focus());
    }
  }
  // Same for the new-catalog-exercise form — also re-focuses after each
  // "Guardar y crear otro" so the user can keep typing.
  if (ui.catalogFormOpen) {
    const input = document.getElementById('cat-form-name');
    if (input && document.activeElement !== input) {
      requestAnimationFrame(() => {
        input.focus();
        // Drop the caret at the end of any pre-seeded name so the user keeps typing.
        try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
      });
    }
    // One-shot: don't let the prefill reappear on a later, unrelated open.
    ui.catalogFormPrefill = '';
  }
  // Keep the caret in the catalog screen's search box across filter
  // re-renders. Caret only (no auto-keyboard) so it isn't jarring on mobile.
  if (route.name === 'catalog') {
    const input = document.getElementById('catalog-filter');
    if (input && document.activeElement !== input && ui.catalogFilter) {
      requestAnimationFrame(() => {
        input.focus({ preventScroll: true });
        try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
      });
    }
  }
  if (ui.buildPickOpen) {
    const input = document.getElementById('build-pick-filter');
    if (input && document.activeElement !== input && ui.buildPickFilter) {
      requestAnimationFrame(() => {
        input.focus({ preventScroll: true });
        try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
      });
    }
  }
  // Move focus into any other newly opened drawer (menu, editor, …) so
  // keyboard/AT users land inside the dialog they opened. Runs after the
  // form-drawer blocks above; skips if one of them already claimed focus.
  if (drawerJustOpened) {
    requestAnimationFrame(() => {
      const drawer = root.querySelector('.drawer');
      if (!drawer || drawer.contains(document.activeElement)) return;
      drawer.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
    });
  }

  // Wire drag-to-reorder on any list flagged with data-reorder-list. The
  // command to dispatch is selected by `data-reorder-kind`.
  root.querySelectorAll('[data-reorder-list]').forEach((list) => {
    const kind = list.dataset.reorderKind || 'routine';
    const routineId = list.dataset.reorderRoutine;
    attachReorder(list, (from, to) => {
      if (kind === 'exercise' && routineId) {
        store.dispatch(makeCommand('MOVE_EXERCISE', { routineId, from, to }));
      } else {
        store.dispatch(makeCommand('MOVE_ROUTINE', { from, to }));
      }
    });
  });

  // iOS Mobile Safari quirk: for non-interactive elements (plain <div> /
  // text), `click` events are only dispatched when the element has a
  // directly assigned onclick property OR `cursor: pointer` in CSS —
  // and event delegation via window/document doesn't qualify. So:
  //   - use el.onclick = fn (not addEventListener — only the property
  //     assignment satisfies the iOS heuristic)
  //   - .drawer-backdrop also has cursor: pointer in CSS
  // The delegated click registry still serves all real <button> tap targets.
  const titleEl = root.querySelector('[data-tap-title]');
  if (titleEl) titleEl.onclick = onTitleTap;
  const motivEl = root.querySelector('.motivation');
  if (motivEl) motivEl.onclick = () => go('#/');
  // Each backdrop carries the same data-close-*/data-cancel-* attribute as its
  // matching close button, so it routes through the very same click registry.
  root.querySelectorAll('.drawer-backdrop').forEach((bd) => {
    bd.onclick = (e) => runAction(bd, e);
  });

  // Scroll-aware elevation: a sticky header only grows its divider + shadow
  // once content has actually scrolled beneath it (the iOS large-title feel).
  // The frosted plate itself is always opaque — only the lift is gated.
  const pageHead = root.querySelector(':scope > .screen-head, :scope > .workout-bar');
  const setPageStuck = () => { if (pageHead) pageHead.classList.toggle('is-stuck', window.scrollY > 4); };
  // One persistent window listener, repointed at the current header each render.
  if (ui._onScroll) window.removeEventListener('scroll', ui._onScroll);
  ui._onScroll = setPageStuck;
  window.addEventListener('scroll', setPageStuck, { passive: true });
  setPageStuck();

  // Drawers scroll independently — gate their cap's lift on the drawer's own
  // scrollTop. The listener dies with the drawer element on the next render.
  const drawerEl = root.querySelector('.drawer');
  const drawerHead = drawerEl?.querySelector('.drawer-head');
  if (drawerEl && drawerHead) {
    const setDrawerStuck = () => drawerHead.classList.toggle('is-stuck', drawerEl.scrollTop > 4);
    drawerEl.addEventListener('scroll', setDrawerStuck, { passive: true });
    setDrawerStuck();
  }
};

// ---------- Export / Import ----------

// Rebuild a trustworthy document from arbitrary imported JSON. The render and
// dispatch paths assume the normalized model (routines with an `exercises`
// array, `[\w-]` ids, series shaped for the entry's kind), and replaceDoc
// persists before the first render — so a malformed file must never get
// through, or it crashes every subsequent launch. Ids are also interpolated
// into data attributes, so unsafe ones are regenerated (consistently, to keep
// references and session history linked). Legacy exports with inline exercise
// definitions (no catalogId) get a catalog entry synthesized by name.
// Returns null when the input isn't a plausible export.
const SAFE_ID = /^[\w-]+$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const sanitizeImportedDoc = (data) => {
  if (!data || typeof data !== 'object' || !Array.isArray(data.routines)) return null;

  // Per-collection id rewriting: keep safe unique ids, regenerate the rest,
  // and remember the mapping so references follow.
  const takeId = (v, used, map) => {
    const orig = typeof v === 'string' ? v : null;
    if (orig && map.has(orig)) return map.get(orig);
    let id = orig && SAFE_ID.test(orig) && !used.has(orig) ? orig : uid();
    while (used.has(id)) id = uid();
    used.add(id);
    if (orig) map.set(orig, id);
    return id;
  };
  const catIds = new Set(), catIdMap = new Map();
  const instIds = new Set(), instIdMap = new Map();
  const routineIds = new Set(), routineIdMap = new Map();

  const catalog = [];
  const catalogByName = new Map(); // normalized name -> entry (unique by name)
  const addCatalogEntry = (c) => {
    const name = String(c.name).trim();
    const key = normalizeName(name);
    const existing = catalogByName.get(key);
    if (existing) {
      // Duplicate name: keep the first entry, point this id at it.
      if (typeof c.id === 'string') catIdMap.set(c.id, existing.id);
      return existing;
    }
    const def = {
      id: takeId(c.id, catIds, catIdMap),
      name,
      category: typeof c.category === 'string' && VALID_CATEGORY.has(c.category) ? c.category : null,
      kind: c.kind === 'time' ? 'time' : 'reps',
      video: typeof c.video === 'string' && c.video.trim() ? c.video.trim() : null,
      notes: typeof c.notes === 'string' ? c.notes : '',
      unit: c.unit === 'lb' ? 'lb' : 'kg',
    };
    catalog.push(def);
    catalogByName.set(key, def);
    return def;
  };
  for (const c of (Array.isArray(data.catalog) ? data.catalog : [])) {
    if (c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim()) addCatalogEntry(c);
  }

  const routines = data.routines
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      id: takeId(r.id, routineIds, routineIdMap),
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Rutina',
      exercises: (Array.isArray(r.exercises) ? r.exercises : [])
        .filter((e) => e && typeof e === 'object')
        .map((e) => {
          let catalogId = typeof e.catalogId === 'string' ? (catIdMap.get(e.catalogId) ?? null) : null;
          // Legacy inline exercise: synthesize/reuse a catalog entry by name.
          if (!catalogId && typeof e.name === 'string' && e.name.trim()) {
            catalogId = addCatalogEntry(e).id;
          }
          if (!catalogId) return null; // unusable reference — drop it
          const kind = catalog.find((c) => c.id === catalogId)?.kind ?? 'reps';
          const series = reshapeSeries(
            Array.isArray(e.series) ? e.series.filter((s) => s && typeof s === 'object') : [],
            kind,
          );
          return { id: takeId(e.id, instIds, instIdMap), catalogId, series };
        })
        .filter(Boolean),
    }));

  // Sessions are historical records keyed by date -> instance id. Follow the
  // instance-id rewrites so history stays attached; snapshots are normalized
  // to the shape the dashboard reads.
  const sessions = {};
  if (data.sessions && typeof data.sessions === 'object' && !Array.isArray(data.sessions)) {
    for (const [date, day] of Object.entries(data.sessions)) {
      if (!DATE_KEY.test(date) || !day || typeof day !== 'object' || Array.isArray(day)) continue;
      const out = {};
      for (const [exId, entry] of Object.entries(day)) {
        const key = instIdMap.get(exId) ?? (SAFE_ID.test(exId) ? exId : null);
        if (!key) continue;
        const sets = Array.isArray(entry?.sets) ? entry.sets.map(Boolean)
          : Array.isArray(entry) ? entry.map(Boolean) : [];
        const rawSnap = entry?.snapshot;
        const snapshot = rawSnap && typeof rawSnap === 'object' && typeof rawSnap.name === 'string'
          ? {
              name: rawSnap.name,
              kind: rawSnap.kind === 'time' ? 'time' : 'reps',
              unit: rawSnap.unit === 'lb' ? 'lb' : 'kg',
              series: reshapeSeries(
                Array.isArray(rawSnap.series) ? rawSnap.series.filter((s) => s && typeof s === 'object') : [],
                rawSnap.kind === 'time' ? 'time' : 'reps',
              ),
              routineId: typeof rawSnap.routineId === 'string'
                ? (routineIdMap.get(rawSnap.routineId) ?? (SAFE_ID.test(rawSnap.routineId) ? rawSnap.routineId : null))
                : null,
            }
          : null;
        out[key] = { sets, snapshot };
      }
      if (Object.keys(out).length) sessions[date] = out;
    }
  }

  return { routines, catalog, sessions };
};

const exportConfig = async () => {
  const data = JSON.stringify(store.state.doc, null, 2);
  const filename = `arnold-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([data], { type: 'application/json' });

  // Prefer the system share sheet (iOS / Android) so the user can save to
  // Files, send to a contact, etc.
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Arnold · Configuración' });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return; // user cancelled the share
  }

  // Fallback: trigger a download via an <a download>.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Configuración exportada');
};

const importConfig = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.cssText = 'position:fixed;left:-9999px;';
  document.body.appendChild(input);

  const file = await new Promise((resolve) => {
    let resolved = false;
    const settle = (v) => { if (!resolved) { resolved = true; resolve(v); } };
    input.addEventListener('change', () => settle(input.files?.[0] || null), { once: true });
    // Modern browsers fire 'cancel' when the picker is dismissed.
    input.addEventListener('cancel', () => settle(null), { once: true });
    // Fallback for browsers without 'cancel': resolve null once focus returns
    // — generously, since a slow picker (iOS Files) can deliver `change` well
    // after refocus and settling early would silently drop a real selection.
    window.addEventListener('focus', () => {
      setTimeout(() => settle(null), 1500);
    }, { once: true });
    input.click();
  });
  input.remove();

  if (!file) return;

  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch {
    await confirmModal({
      title: 'Archivo inválido',
      message: 'No se pudo leer el JSON. Verificá que el archivo no esté corrupto.',
      confirmLabel: 'Entendido',
      cancelLabel: '',
    });
    return;
  }

  const doc = sanitizeImportedDoc(data);
  if (!doc) {
    await confirmModal({
      title: 'Archivo inválido',
      message: 'El JSON no tiene la estructura esperada (falta el campo "routines").',
      confirmLabel: 'Entendido',
      cancelLabel: '',
    });
    return;
  }

  const ok = await confirmModal({
    title: 'Reemplazar configuración',
    message: `Vas a sustituir tus ${store.state.doc.routines.length} rutinas y todas las sesiones por las del archivo (${doc.routines.length} rutinas). Esta acción no se puede deshacer.`,
    confirmLabel: 'Reemplazar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;

  store.replaceDoc(doc);
  go('#/');
  showToast('Configuración importada');
};

// ---------- event delegation ----------
//
// One delegated listener per event type. Each registry maps a data-attribute
// (or, for `delegateById`, an element id) to a handler `(el, event)`. The
// `closest()` selector is *derived from the registry keys*, so it can never
// drift out of sync with the handlers again. First matching attribute wins
// (object insertion order = the old if-chain precedence).

// change / input / submit are keyed by attribute / element id.
const fire = (registry, el, e) => {
  if (!el) return;
  for (const attr in registry) if (el.hasAttribute(attr)) return registry[attr](el, e);
};
const delegate = (type, registry, target = window) => {
  const sel = Object.keys(registry).map((a) => `[${a}]`).join(',');
  target.addEventListener(type, (e) => fire(registry, e.target.closest(sel), e));
};
const delegateById = (type, registry, target = window) => {
  target.addEventListener(type, (e) => registry[e.target.id]?.(e.target, e));
};

// Clicks dispatch on a single `data-action="verb"`; navigation keeps the terse,
// value-bearing `data-go="#/path"`. Param attributes (data-routine, data-name,
// data-index, …) ride along and are read by each handler. Backdrop taps reuse
// this same path (see render()), so "close" logic has one home.
const runAction = (el, e) => {
  if (!el) return;
  const name = el.dataset.action ?? (el.dataset.go != null ? 'go' : null);
  if (name) clickActions[name]?.(el, e);
};
const onClick = (e) => runAction(e.target.closest('[data-action],[data-go]'), e);

// --- click action handlers (the heavier ones extracted for readability) ---

const toggleSet = (t) => {
  const exerciseId = t.dataset.exercise;
  const setIndex = Number(t.dataset.index);
  const from = t.dataset.from === '1';
  const date = todayKey();
  const to = !from;
  // Snapshot only refreshes on completion (false → true). Toggling off
  // preserves the existing snapshot so undo behaves predictably.
  const found = findExerciseInState(store.state, exerciseId);
  const hx = found ? hydrateExercise(store.state, found.exercise) : null;
  const fromSnapshot = sessionSnapshot(store.state, date, exerciseId);
  const snapshot = to && hx
    ? {
        name: hx.name,
        kind: exKind(hx),
        unit: exUnit(hx),
        // Full per-set breakdown — history derives weight list + volume.
        series: structuredClone(exSeries(hx)),
        routineId: found.routine.id,
      }
    : undefined;
  store.dispatch(makeCommand('TOGGLE_SET', {
    date, exerciseId, setIndex, from, to,
    ...(snapshot !== undefined ? { snapshot, fromSnapshot } : {}),
  }));
};

const clearSets = async (t) => {
  const date = t.dataset.date;
  const current = store.state.doc.sessions[date];
  if (!current || Object.keys(current).length === 0) return;
  const ok = await confirmModal({
    title: 'Volver a empezar',
    message: 'Se van a desmarcar todas las series que completaste hoy. Vas a poder deshacer la acción.',
    confirmLabel: 'Volver a empezar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  store.dispatch(makeCommand('CLEAR_SETS', { date, from: structuredClone(current), to: null }));
};

const addExercise = (t) => {
  // Go to the catalog in pick mode for this routine.
  const routineId = t.dataset.routine;
  const r = store.state.doc.routines.find((x) => x.id === routineId);
  if (!r) return;
  ui.catalogFilter = '';
  go(`#/catalog/pick/${routineId}`);
};

const buildPickCommit = () => {
  const route = parseRoute();
  if (route.name !== 'build') return;
  const routine = store.state.doc.routines[Math.min(route.step, store.state.doc.routines.length - 1)];
  if (!routine || ui.buildPickSelected.size === 0) return;
  // Insert one reference per ticked catalog entry, in catalog order, as a
  // single batch command so the whole pick is one undo step.
  const cat = buildCatalog(store.state).filter((c) => c.catalogId && ui.buildPickSelected.has(c.catalogId));
  store.dispatch(makeCommand('ADD_EXERCISES', {
    routineId: routine.id,
    index: routine.exercises.length,
    exercises: cat.map((c) => instanceFromCatalog(c)),
  }));
  const n = ui.buildPickSelected.size;
  ui.buildPickOpen = false;
  ui.buildPickSelected.clear();
  ui.buildPickFilter = '';
  render(store.state);
  showToast(`${n} ${n === 1 ? 'ejercicio agregado' : 'ejercicios agregados'}`);
};

const pickCatalog = (t) => {
  // Insert a reference to the chosen catalog entry into the pick routine,
  // then open the new instance's editor to set its series.
  const route = parseRoute();
  const routineId = route.name === 'catalog' ? route.routineId : null;
  const r = store.state.doc.routines.find((x) => x.id === routineId);
  if (!r) return;
  const cat = buildCatalog(store.state).find((c) => c.name === normalizeName(t.dataset.name));
  if (!cat || !cat.catalogId) return;
  // Default series from the entry's kind, pre-filling weight from the latest
  // known value for convenience.
  const prefillW = cat.lastWeight ? cat.lastWeight.value : null;
  const series = makeSeries(3, cat.kind).map((s) =>
    cat.kind === 'time' ? s : { ...s, weight: prefillW });
  const exercise = { id: uid(), catalogId: cat.catalogId, series };
  store.dispatch(makeCommand('ADD_EXERCISE', { routineId, index: r.exercises.length, exercise }));
  ui.catalogFilter = '';
  go(`#/workout/${routineId}/edit/${exercise.id}`);
};

const seriesStep = (t) => {
  // +/- the set count from the editor's stepper. Resizes the instance's
  // series (cloning the last set's values into any new set).
  const routineId = t.dataset.routine;
  const exerciseId = t.dataset.exercise;
  const r = store.state.doc.routines.find((x) => x.id === routineId);
  const inst = r?.exercises.find((ex) => ex.id === exerciseId);
  if (!inst) return;
  const kind = hydrateExercise(store.state, inst).kind;
  const from = structuredClone(Array.isArray(inst.series) ? inst.series : []);
  const n = Math.max(1, Math.min(20, from.length + Number(t.dataset.seriesStep)));
  if (n === from.length) return;
  store.dispatch(makeCommand('UPDATE_SERIES', { routineId, exerciseId, from, to: resizeSeries(from, n, kind) }));
};

const deleteCatalog = async (t) => {
  const cat = buildCatalog(store.state).find((c) => c.name === normalizeName(t.dataset.name));
  if (!cat || !cat.catalogId) return;
  const catIdx = (store.state.doc.catalog ?? []).findIndex((c) => c.id === cat.catalogId);
  if (catIdx < 0) return;
  // Cascade: capture every routine reference (index + full instance) so the
  // delete removes them all and undo restores them exactly.
  const targets = [];
  store.state.doc.routines.forEach((r) => {
    r.exercises.forEach((inst, index) => {
      if (inst.catalogId === cat.catalogId) {
        targets.push({ routineId: r.id, index, exercise: structuredClone(inst) });
      }
    });
  });
  const days = [...new Set(cat.usedIn.map((u) => `Día ${dayNum(u.routineIndex)}`))].join(', ');
  const ok = await confirmModal({
    title: 'Eliminar ejercicio',
    message: targets.length
      ? `Se va a quitar "${cat.displayName}" del catálogo y de ${days}. Las sesiones registradas se mantienen como historial.`
      : `Se va a quitar "${cat.displayName}" del catálogo. Las sesiones registradas se mantienen como historial.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  const catalogTarget = {
    id: cat.catalogId,
    index: catIdx,
    exercise: structuredClone(store.state.doc.catalog[catIdx]),
  };
  store.dispatch(makeCommand('CATALOG_DELETE', { name: cat.displayName, targets, catalogTarget }));
  // From the exercise-detail edit drawer, return to the catalog list;
  // from the catalog screen itself, stay put.
  if (parseRoute().name === 'exercise') go('#/catalog');
  else render(store.state);
};

const removeExercise = async (t) => {
  const routineId = t.dataset.routine;
  const exerciseId = t.dataset.exercise;
  const r = store.state.doc.routines.find((x) => x.id === routineId);
  if (!r) return;
  const index = r.exercises.findIndex((e) => e.id === exerciseId);
  if (index < 0) return;
  const exercise = r.exercises[index];
  const ok = await confirmModal({
    title: 'Eliminar ejercicio',
    message: `Se va a quitar "${refName(store.state, exercise)}" de la rutina.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  store.dispatch(makeCommand('REMOVE_EXERCISE', { routineId, index, exercise }));
};

const removeRoutine = async (t) => {
  const routineId = t.dataset.routine;
  const index = store.state.doc.routines.findIndex((x) => x.id === routineId);
  if (index < 0) return;
  const routine = store.state.doc.routines[index];
  const ok = await confirmModal({
    title: 'Eliminar rutina',
    message: `Se va a quitar "${routine.name}" junto con todos sus ejercicios.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  store.dispatch(makeCommand('REMOVE_ROUTINE', { index, routine }));
  go('#/edit');
};

const resetToSeed = async () => {
  if (ui.menuOpen) { ui.menuOpen = false; render(store.state); }
  const ok = await confirmModal({
    title: 'Restaurar rutina inicial',
    message: 'Se van a borrar tus cambios y volver al programa original.',
    confirmLabel: 'Restaurar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  store.reset();
};

// The click registry. Backdrop taps (.drawer-backdrop) reuse this same table
// via fire() — see render() — so "close" logic has a single source of truth.
const clickActions = {
  'go': (t) => go(t.dataset.go),
  'done': () => {
    // Context-aware: leave workout-edit mode → normal workout view; else home.
    const route = parseRoute();
    if (route.name === 'workout' && route.editMode) go(`#/workout/${route.routineId}`);
    else go('#/');
  },
  'edit-exercise': (t) => go(`#/workout/${t.dataset.routine}/edit/${t.dataset.exercise}`),
  'menu': () => { ui.menuOpen = true; render(store.state); },
  'stopwatch': () => openStopwatch(),
  'close-stopwatch': () => closeStopwatch(),
  'close-menu': () => { ui.menuOpen = false; render(store.state); },
  'add-catalog-exercise': (t) => {
    // Open the create form over the catalog screen. A `data-routine` (from
    // pick mode) makes the new exercise also get added to that routine.
    // `data-prefill` (from an empty-search "Crear …") seeds the name field.
    ui.catalogFormOpen = true;
    ui.catalogPickRoutineId = t.dataset.routine || null;
    ui.catalogFormPrefill = t.dataset.prefill || '';
    render(store.state);
  },
  'clear-search': (t) => {
    const id = t.dataset.target;
    if (id === 'build-pick-filter') ui.buildPickFilter = '';
    else ui.catalogFilter = '';
    render(store.state);
    // Keep the field focused so the user can immediately retype.
    requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
  },
  'cancel-catalog-form': () => {
    ui.catalogFormOpen = false;
    ui.catalogPickRoutineId = null;
    render(store.state);
  },
  'export': async () => { ui.menuOpen = false; render(store.state); await exportConfig(); },
  'import': async () => { ui.menuOpen = false; render(store.state); await importConfig(); },
  'close-drawer': () => {
    const route = parseRoute();
    if (route.name === 'build' && route.editExerciseId) {
      go(`#/build/${route.step}`);
    } else if (route.name === 'workout' && route.editExerciseId) {
      // history.back so we return to whatever route opened the drawer; fall
      // back to the normal workout view if we landed here directly.
      if (history.length > 1) history.back();
      else go(`#/workout/${route.routineId}`);
    }
  },
  'undo': () => { const cmd = store.undo(); if (cmd) showToast(`Deshecho — ${describeCommand(cmd, store.state).toLowerCase()}`); },
  'redo': () => { const cmd = store.redo(); if (cmd) showToast(`Rehecho — ${describeCommand(cmd, store.state).toLowerCase()}`); },
  'toggle-media': (t) => {
    const id = t.dataset.exercise;
    if (ui.expandedMedia.has(id)) ui.expandedMedia.delete(id);
    else ui.expandedMedia.add(id);
    render(store.state);
  },
  'toggle-set': toggleSet,
  'clear-sets': clearSets,
  'add-routine': () => { ui.newRoutineOpen = true; render(store.state); },
  'cancel-new-routine': () => { ui.newRoutineOpen = false; render(store.state); },
  'add-exercise': addExercise,
  'build-finish': () => {
    ui.buildPickOpen = false;
    ui.buildPickSelected.clear();
    go('#/');
    showToast('Semana guardada 💪');
  },
  'build-edit': (t) => go(`#/build/${t.dataset.step}/ex/${t.dataset.exercise}`),
  'build-add': () => {
    ui.buildPickOpen = true;
    ui.buildPickSelected.clear();
    ui.buildPickFilter = '';
    render(store.state);
  },
  'build-pick-cancel': () => {
    ui.buildPickOpen = false;
    ui.buildPickSelected.clear();
    ui.buildPickFilter = '';
    render(store.state);
  },
  'build-pick-toggle': (t) => {
    const id = t.dataset.catalogId;
    if (ui.buildPickSelected.has(id)) ui.buildPickSelected.delete(id);
    else ui.buildPickSelected.add(id);
    render(store.state);
  },
  'build-pick-commit': buildPickCommit,
  'pick-catalog': pickCatalog,
  'close-catalog-edit': () => {
    const route = parseRoute();
    if (route.name === 'exercise' && route.editMode) {
      if (history.length > 1) history.back();
      else go(`#/${route.origin || 'dashboard'}/ex/${route.slug}`);
    }
  },
  'series-step': seriesStep,
  'detail-range': (t) => {
    const r = t.dataset.detailRange;
    if (r !== ui.detailRange) { ui.detailRange = r; render(store.state); }
  },
  'delete-catalog': deleteCatalog,
  'remove-exercise': removeExercise,
  'remove-routine': removeRoutine,
  'reset': resetToSeed,
};

// Live filters — fire on every keystroke. Not store mutations, so no command
// dispatch; keyed by input id.
const inputActions = {
  'catalog-filter': (t) => { ui.catalogFilter = t.value; render(store.state); },
  'build-pick-filter': (t) => { ui.buildPickFilter = t.value; render(store.state); },
};

// The catalog is unique by normalized name (buildCatalog keeps only the first
// match), so a rename that collides with another entry would make one of them
// unreachable in the UI. Creation already dedupes; renames must too.
const catalogNameTaken = (name, exceptId) =>
  (store.state.doc.catalog || []).some(
    (c) => c.id !== exceptId && normalizeName(c.name) === normalizeName(name),
  );

// Edit one catalog entry's definition field via UPDATE_CATALOG_ENTRY. Because
// routines reference the entry, the change propagates everywhere. A `kind`
// change reshapes the series of every referencing instance so undo is exact.
// Returns true if a command was dispatched.
const dispatchEntryFieldChange = (catalogId, field, value) => {
  const cat = store.state.doc.catalog || [];
  const idx = cat.findIndex((c) => c.id === catalogId);
  if (idx < 0) return false;
  const from = structuredClone(cat[idx]);
  const to = structuredClone(cat[idx]);
  if (field === 'name') {
    const trimmed = String(value).trim();
    if (!trimmed) return false;
    if (catalogNameTaken(trimmed, catalogId)) {
      showToast(`Ya existe "${trimmed}" en el catálogo`);
      render(store.state); // snap the field back to the stored name
      return false;
    }
    to.name = trimmed;
  } else if (field === 'kind') {
    to.kind = value === 'time' ? 'time' : 'reps';
  } else if (field === 'category') {
    to.category = normCategory(value);
  } else if (field === 'video') {
    to.video = String(value).trim() || null;
  } else if (field === 'notes') {
    to.notes = value;
  } else if (field === 'unit') {
    to.unit = value === 'lb' ? 'lb' : 'kg';
  } else {
    return false;
  }
  // When the kind changes, reshape the series of every referencing instance.
  let reshape;
  if (field === 'kind' && to.kind !== from.kind) {
    reshape = [];
    store.state.doc.routines.forEach((r) => r.exercises.forEach((inst) => {
      if (inst.catalogId !== catalogId) return;
      const fromS = structuredClone(Array.isArray(inst.series) ? inst.series : []);
      reshape.push({ routineId: r.id, exerciseId: inst.id, from: fromS, to: reshapeSeries(fromS, to.kind) });
    }));
  }
  if (!reshape && JSON.stringify(from) === JSON.stringify(to)) return false;
  store.dispatch(makeCommand('UPDATE_CATALOG_ENTRY', { catalogId, from, to, ...(reshape ? { reshape } : {}) }));
  return true;
};

// The catalog edit drawer (data-cat-update) targets the entry named by the
// current edit route. On rename the route slug + edit target move to the new
// name BEFORE dispatching, so the post-dispatch re-render resolves consistently.
const dispatchCatalogFieldChange = (field, value) => {
  if (!ui.catalogEditName) return;
  const entry = (store.state.doc.catalog || []).find((c) => normalizeName(c.name) === ui.catalogEditName);
  if (!entry) return;
  if (field === 'name') {
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === entry.name) return;
    // Bail before retargeting the route — otherwise a rejected rename leaves
    // the slug pointing at a name that doesn't exist.
    if (catalogNameTaken(trimmed, entry.id)) {
      showToast(`Ya existe "${trimmed}" en el catálogo`);
      render(store.state);
      return;
    }
    ui.catalogEditName = normalizeName(trimmed);
    const route = parseRoute();
    if (route.name === 'exercise' && route.editMode) {
      history.replaceState(null, '', `#/${route.origin || 'dashboard'}/ex/${slugify(trimmed)}/edit`);
    }
  }
  dispatchEntryFieldChange(entry.id, field, value);
};

// Field updates dispatch on `change` (blur / Enter), not per-keystroke, to
// avoid one command per character. Keyed by attribute.
const changeActions = {
  'data-cat-update': (t) => {
    const field = t.name;
    let value = t.value;
    if (field === 'video') value = String(value).trim() || null;
    dispatchCatalogFieldChange(field, value);
  },
  'data-rename-routine': (t) => {
    const routineId = t.dataset.routine;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const to = t.value.trim();
    if (!to || to === r.name) return;
    store.dispatch(makeCommand('RENAME_ROUTINE', { routineId, from: r.name, to }));
  },
  'data-update': (t) => {
    const routineId = t.dataset.routine;
    const exerciseId = t.dataset.exercise;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const inst = r.exercises.find((e) => e.id === exerciseId);
    if (!inst) return;
    const field = t.name;
    // Definition fields edit the catalog entry (and propagate to all routines).
    if (field === 'name' || field === 'kind' || field === 'category' || field === 'video' || field === 'notes' || field === 'unit') {
      dispatchEntryFieldChange(inst.catalogId, field, t.value);
      return;
    }
    // Per-instance series fields.
    const kind = hydrateExercise(store.state, inst).kind;
    const from = structuredClone(Array.isArray(inst.series) ? inst.series : []);
    let to = structuredClone(from);
    if (field === 'duration') {
      // One duration string applies to every set of a time exercise.
      const n = Math.max(1, to.length || 1);
      to = Array.from({ length: n }, () => ({ duration: t.value }));
    } else if (field === 'series-weight') {
      const i = Number(t.dataset.setIndex);
      if (to[i]) to[i] = { ...to[i], weight: numOrNull(t.value) };
    } else if (field === 'series-reps') {
      const i = Number(t.dataset.setIndex);
      if (to[i]) to[i] = { ...to[i], reps: numOrNull(t.value) };
    } else {
      return;
    }
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    store.dispatch(makeCommand('UPDATE_SERIES', { routineId, exerciseId, from, to }));
  },
};

// Form submits — keyed by form id. The new-routine and new-catalog-exercise
// drawers use <form>.
const submitActions = {
  'catalog-form': (form, e) => {
    e.preventDefault();
    const nameEl = document.getElementById('cat-form-name');
    const name = (nameEl?.value ?? '').trim();
    if (!name) { nameEl?.focus(); return; }
    const kind = document.getElementById('cat-form-kind')?.value === 'time' ? 'time' : 'reps';
    const category = normCategory(document.getElementById('cat-form-category')?.value);
    const video = (document.getElementById('cat-form-video')?.value ?? '').trim() || null;
    const notes = (document.getElementById('cat-form-notes')?.value ?? '').trim();
    const pickRoutineId = ui.catalogPickRoutineId;

    // The catalog is unique by normalized name — reuse a matching entry instead
    // of creating a duplicate; otherwise create one.
    let entry = (store.state.doc.catalog || []).find((c) => normalizeName(c.name) === normalizeName(name));
    if (!entry) {
      entry = { id: uid(), name, category, kind, video, notes, unit: 'kg' };
      store.dispatch(makeCommand('ADD_CATALOG_EXERCISE', {
        index: (store.state.doc.catalog ?? []).length, exercise: entry,
      }));
      showToast(`Ejercicio "${name}" creado`);
    } else {
      showToast(`"${entry.name}" ya estaba en el catálogo`);
    }

    if (pickRoutineId) {
      // Created from pick mode: also add a reference to the routine, then edit
      // the new instance to set its series.
      ui.catalogFormOpen = false;
      ui.catalogPickRoutineId = null;
      const r = store.state.doc.routines.find((x) => x.id === pickRoutineId);
      if (r) {
        const exercise = { id: uid(), catalogId: entry.id, series: makeSeries(3, entry.kind) };
        store.dispatch(makeCommand('ADD_EXERCISE', {
          routineId: r.id, index: r.exercises.length, exercise,
        }));
        go(`#/workout/${r.id}/edit/${exercise.id}`);
      } else {
        go('#/catalog');
      }
      return;
    }

    // "another" keeps the form open (blank, re-focused) to keep adding;
    // "close" closes it, revealing the new exercise on the catalog screen.
    ui.catalogFormOpen = e.submitter?.dataset.catalogFormSubmit === 'another';
    render(store.state);
  },
  'new-routine-form': (form, e) => {
    e.preventDefault();
    const input = document.getElementById('new-routine-name');
    const name = (input?.value ?? '').trim();
    if (!name) { input?.focus(); return; }
    const routine = { id: uid(), name, exercises: [] };
    store.dispatch(makeCommand('ADD_ROUTINE', { index: store.state.doc.routines.length, routine }));
    ui.newRoutineOpen = false;
    render(store.state);
    showToast(`Rutina "${name}" creada`);
  },
};

// Keyboard support for the modal layers. Drawers and the confirm modal carry
// aria-modal="true", which promises AT the background is inert — honor it for
// keyboard users too: Escape closes the top drawer (via the same action its
// backdrop uses) and Tab cycles inside the top-most layer instead of walking
// into obscured content.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const onLayerKeydown = (e) => {
  if (e.key === 'Escape' && !document.querySelector('.modal-wrap')) {
    const bd = root.querySelector('.drawer-backdrop');
    if (bd) { e.preventDefault(); runAction(bd, e); }
    return;
  }
  if (e.key !== 'Tab') return;
  const layer = document.querySelector('.modal-wrap .modal-dialog') ?? root.querySelector('.drawer');
  if (!layer) return;
  const items = [...layer.querySelectorAll(FOCUSABLE)]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!layer.contains(active)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
};

const isEditableTarget = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};
const onKeyDown = (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (!meta) return;
  if (e.key === 'z' || e.key === 'Z') {
    if (isEditableTarget(e)) return;
    e.preventDefault();
    const cmd = e.shiftKey ? store.redo() : store.undo();
    if (cmd) showToast(`${e.shiftKey ? 'Rehecho' : 'Deshecho'} — ${describeCommand(cmd, store.state).toLowerCase()}`);
  } else if (e.key === 'y' || e.key === 'Y') {
    if (isEditableTarget(e)) return;
    e.preventDefault();
    const cmd = store.redo();
    if (cmd) showToast(`Rehecho — ${describeCommand(cmd, store.state).toLowerCase()}`);
  }
};

// ---------- boot ----------

// Last-resort screen when the boot render throws (e.g. state persisted by an
// older/newer version that this code can't read). Without it the app is a
// permanently blank screen — the broken state re-crashes every launch and the
// in-app reset is unreachable. Static DOM, no innerHTML: it must not depend
// on the very render path that just failed.
const renderRecovery = (err) => {
  console.error('boot render failed', err);
  root.textContent = '';
  const wrap = document.createElement('div');
  wrap.className = 'boot-error';
  const h = document.createElement('h2');
  h.textContent = 'Algo salió mal';
  const p = document.createElement('p');
  p.textContent = 'No se pudo mostrar la aplicación con los datos guardados. Podés restaurar el programa original para volver a empezar.';
  const btn = document.createElement('button');
  btn.className = 'danger-primary';
  btn.textContent = 'Restaurar rutina inicial';
  btn.onclick = () => { store.reset(); location.hash = '#/'; location.reload(); };
  wrap.append(h, p, btn);
  root.appendChild(wrap);
};

const start = async () => {
  await store.ready;
  // Quotes hydrate from the IDB cache and refresh from network in the
  // background — they must never gate the first render (a slow first fetch
  // would hold the whole app hostage). Re-render only if the user is already
  // staring at the motivation screen when they arrive.
  initQuotes().then(() => {
    if (parseRoute().name === 'motivation') render(store.state);
  });
  store.subscribe(() => render(store.state));
  window.addEventListener('hashchange', () => {
    resetTransient();
    render(store.state);
  });
  window.addEventListener('click', onClick);
  delegate('change', changeActions);
  delegateById('input', inputActions);
  delegateById('submit', submitActions);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keydown', onLayerKeydown);
  try {
    render(store.state);
  } catch (err) {
    renderRecovery(err);
  }
};

start();
