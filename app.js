import { store } from './store.js';
import { makeCommand } from './commands.js';
import { loadQuotes, saveQuotes } from './db.js';

const root = document.getElementById('view');

// ---------- safe rendering ----------

// All dynamic strings are escaped via `esc()` before being interpolated.
// The view is mounted as a parsed Fragment (no script execution, no
// inline event-handler attributes) rather than via innerHTML assignment.

const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

// Only allow http/https/youtube links. Block javascript:/data: in hrefs.
const safeUrl = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim();
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

// Transient: which exercises have their media expanded. Not persisted.
const expandedMedia = new Set();

const mount = (htmlString) => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.deleteContents();
  range.setStart(root, 0);
  const frag = range.createContextualFragment(htmlString);
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

// Easter-egg: 3 taps on the title within 600ms opens the motivation screen.
let titleTaps = 0;
let titleTapTimer = null;
const onTitleTap = () => {
  titleTaps++;
  if (titleTapTimer) clearTimeout(titleTapTimer);
  if (titleTaps >= 3) {
    titleTaps = 0;
    go('#/motivation');
    return;
  }
  titleTapTimer = setTimeout(() => { titleTaps = 0; }, 600);
};

// In-app confirmation modal. Replaces window.confirm() with a styled
// dialog. Returns a Promise<boolean> — true on confirm, false on cancel.
const confirmModal = ({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive = false }) => {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    const html = `
      <div class="modal-backdrop" data-modal-action="cancel"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true">
        ${title ? `<h3>${esc(title)}</h3>` : ''}
        ${message ? `<p>${esc(message)}</p>` : ''}
        <div class="modal-actions">
          ${cancelLabel ? `<button class="ghost" data-modal-action="cancel">${esc(cancelLabel)}</button>` : ''}
          <button class="${destructive ? 'danger-primary' : 'primary'}" data-modal-action="confirm">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    const range = document.createRange();
    range.selectNodeContents(wrap);
    const frag = range.createContextualFragment(html);
    wrap.appendChild(frag);
    document.body.appendChild(wrap);
    let resolved = false;
    const close = (result) => {
      if (resolved) return;
      resolved = true;
      wrap.remove();
      resolve(result);
    };
    wrap.addEventListener('click', (e) => {
      const t = e.target.closest('[data-modal-action]');
      if (!t) return;
      close(t.dataset.modalAction === 'confirm');
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
    });
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

// Tracks whether the drawer was already open in the previous render so
// subsequent re-renders (auto-saves) don't replay the slide-up animation.
let lastDrawerOpen = false;

// Tracks last route serialization so we can decide whether a re-render is
// for the same view (preserve scroll) or a navigation (scroll to top).
let lastRouteKey = null;

// Transient: bottom kebab menu open state (not persisted, not URL-routed).
let menuOpen = false;
// Transient: "new routine" name-entry drawer (open from the edit list).
let newRoutineOpen = false;

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
  if (a.hasAttribute('data-weight-value')) parts.push('[data-weight-value]');
  if (a.hasAttribute('data-weight-unit')) parts.push('[data-weight-unit]');
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

const sessionFor = (state, date, exerciseId) =>
  state.doc.sessions[date]?.[exerciseId] ?? [];

const countDoneFor = (state, date, routine) => {
  let total = 0, done = 0;
  for (const ex of routine.exercises) {
    total += ex.sets;
    const arr = sessionFor(state, date, ex.id);
    for (let i = 0; i < ex.sets; i++) if (arr[i]) done++;
  }
  return { total, done };
};

// ---------- routing ----------

const parseRoute = () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (!h) return { name: 'home' };
  const parts = h.split('/');
  if (parts[0] === 'workout' && parts[1]) {
    const r = { name: 'workout', routineId: parts[1] };
    if (parts[2] === 'edit') {
      r.editMode = true;
      if (parts[3]) r.editExerciseId = parts[3];
    }
    return r;
  }
  if (parts[0] === 'edit') return { name: 'edit' };
  if (parts[0] === 'log') return { name: 'log' };
  if (parts[0] === 'motivation') return { name: 'motivation' };
  return { name: 'home' };
};

const go = (path) => { location.hash = path; };

// ---------- views ----------

// SVG icons used in the bottom toolbar.
const iconUndo = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`;
const iconRedo = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>`;
const iconKebab = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>`;
const iconBack = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const backBtn = (href, label = 'Volver al inicio') =>
  `<button class="back-btn" data-go="${esc(href)}" aria-label="${esc(label)}">${iconBack}</button>`;

// Fixed bottom action bar rendered on every view. Left: undo/redo.
// Right: contextual primary action (Editar on home, Listo on edit) + kebab.
const bottomBar = (state, primary = '') => `
  <nav class="bottom-bar">
    <div class="bottom-bar-inner">
      <div class="group">
        <button class="tool-btn" data-undo aria-label="Deshacer" ${state._undo ? '' : 'disabled'}>${iconUndo}</button>
        <button class="tool-btn" data-redo aria-label="Rehacer" ${state._redo ? '' : 'disabled'}>${iconRedo}</button>
      </div>
      <div class="group">
        ${primary}
        <button class="tool-btn" data-menu aria-label="Más opciones">${iconKebab}</button>
      </div>
    </div>
  </nav>
`;

const doneBtn = '<button class="icon-btn primary" data-done>Listo</button>';
const editBtn = '<button class="icon-btn primary" data-go="#/edit">Editar</button>';

// Square brand badge — amber barbell on charcoal
const logoSvg = `
<svg class="app-logo" viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="6" fill="transparent"/>
  <g fill="#ffffff">
    <rect x="4" y="17" width="3" height="6" rx="0.5"/>
    <rect x="8" y="13" width="3" height="14" rx="0.5"/>
    <rect x="13" y="18" width="14" height="4"/>
    <rect x="29" y="13" width="3" height="14" rx="0.5"/>
    <rect x="33" y="17" width="3" height="6" rx="0.5"/>
  </g>
</svg>`;

const DAY_WORDS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce'];
const dayWord = (i) => DAY_WORDS[i] ?? String(i + 1);
const dayNum = (i) => String(i + 1).padStart(2, '0');
const displayName = (raw) => {
  const idx = raw.indexOf(':');
  return (idx >= 0 ? raw.slice(idx + 1).trim() : raw);
};

// Daily motivational quotes. Loaded from /quotes.json, cached in IndexedDB.
// Cache invalidates when the file's raw text differs from the cached copy.
let quotesCache = [];

const refreshQuotesFromNetwork = async () => {
  try {
    const res = await fetch('./quotes.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const raw = await res.text();
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;
    const cached = await loadQuotes().catch(() => null);
    if (!cached || cached.raw !== raw) {
      await saveQuotes({ raw, quotes: list });
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
const exTarget = (ex) => exKind(ex) === 'time' ? (ex.duration || '—') : (ex.reps || '—');
const exTargetLabel = (ex) => exKind(ex) === 'time' ? 'Duración' : 'Reps';

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
      ? `<span class="num small muted">Día de descanso</span>`
      : `
        <div class="progress-bar" aria-hidden="true"><div style="width:${pct}%"></div></div>
        <span class="progress-num">${String(done).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
      `;
    return `
      <button class="routine-card ${isRest ? 'rest' : ''} ${active ? 'active' : ''}" data-go="#/workout/${esc(r.id)}">
        <div class="rc-row1">
          <span class="rc-badge">${dayNum(i)}</span>
          <div class="rc-title">
            <span class="rc-eyebrow">Día ${esc(dayWord(i))}</span>
            ${esc(displayName(r.name))}
          </div>
          <span class="rc-chev" aria-hidden="true">›</span>
        </div>
        <div class="rc-row2">${meta}</div>
      </button>`;
  }).join('');

  return `
    <header class="app-bar">
      <div class="app-bar-left">
        ${logoSvg}
        <h1 class="app-title" data-tap-title>Arnold</h1>
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
      const name = found?.exercise.name ?? 'un ejercicio';
      const verb = p.to ? 'Marcaste' : 'Desmarcaste';
      return `${verb} la serie ${p.setIndex + 1} de ${name}`;
    }
    case 'CLEAR_SETS':
      return `Reiniciaste el checklist del día`;
    case 'SET_WEIGHT': {
      const found = findExerciseInState(state, p.exerciseId);
      const name = found?.exercise.name ?? 'un ejercicio';
      const w = p.to ? `${p.to.value} ${p.to.unit}` : 'sin peso';
      return `Cambiaste el peso de ${name} a ${w}`;
    }
    case 'UPDATE_EXERCISE':
      return `Editaste ${p.to?.name ?? 'un ejercicio'}`;
    case 'ADD_EXERCISE':
      return `Agregaste ${p.exercise.name}`;
    case 'REMOVE_EXERCISE':
      return `Eliminaste ${p.exercise.name}`;
    case 'RENAME_ROUTINE':
      return `Renombraste la rutina a "${p.to}"`;
    case 'ADD_ROUTINE':
      return `Agregaste la rutina "${p.routine.name}"`;
    case 'REMOVE_ROUTINE':
      return `Eliminaste la rutina "${p.routine.name}"`;
    case 'MOVE_ROUTINE':
      return `Reordenaste rutinas`;
    default:
      return cmd.type;
  }
};

const renderNewRoutineSheet = () => `
  <div class="drawer-backdrop" data-cancel-new-routine></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Nueva rutina">
    <div class="drawer-handle" aria-hidden="true"></div>
    <div class="drawer-header">
      <h3>Nueva rutina</h3>
      <button class="icon-btn" data-cancel-new-routine aria-label="Cerrar">✕</button>
    </div>
    <form class="drawer-body" id="new-routine-form" autocomplete="off">
      <div class="field">
        <label for="new-routine-name">Nombre</label>
        <input type="text" id="new-routine-name" name="name"
               placeholder="Día 8: Cardio" maxlength="80"
               autocomplete="off" />
      </div>
      <div class="bottom-action">
        <button class="primary" type="submit">Crear rutina</button>
      </div>
    </form>
  </aside>
`;

const renderMenuSheet = () => `
  <div class="drawer-backdrop" data-close-menu></div>
  <aside class="drawer drawer-menu" role="dialog" aria-modal="true" aria-label="Más opciones">
    <div class="drawer-handle" aria-hidden="true"></div>
    <div class="drawer-header">
      <h3>Más opciones</h3>
      <button class="icon-btn" data-close-menu aria-label="Cerrar">✕</button>
    </div>
    <ul class="menu-list">
      <li>
        <button class="menu-item" data-export>
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
        <button class="menu-item" data-import>
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
        <button class="menu-item" data-reset>
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

const renderMotivation = () => {
  const quote = pickQuote();
  const words = quote.split(/(\s+)/).map((tok, i) => {
    if (/^\s+$/.test(tok)) return tok;
    return `<span class="word" style="animation-delay:${50 + i * 35}ms">${esc(tok)}</span>`;
  }).join('');
  return `
    <div class="motivation" data-go="#/" role="dialog" aria-label="Frase motivacional">
      <p class="quote">${words}</p>
      <span class="motivation-hint">tocá para volver</span>
    </div>
  `;
};

const renderLog = (state) => {
  const past = [...store.history.past].reverse();
  const items = past.map((cmd) => `
    <li class="log-item">
      <span class="log-desc">${esc(describeCommand(cmd, state))}</span>
      <span class="log-time">${esc(fmtRelTime(cmd.t))}</span>
    </li>
  `).join('');
  return `
    <header class="workout-bar">
      ${backBtn('#/')}
      <div class="title-block">
        <div class="title">Registro</div>
        <div class="sub">${past.length} ${past.length === 1 ? 'acción' : 'acciones'}</div>
      </div>
      <span></span>
    </header>
    ${past.length === 0
      ? '<p class="muted small" style="padding:1rem 0.25rem">Sin acciones todavía.</p>'
      : `<ul class="log">${items}</ul>`}
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
        ? `<div class="rest-card">Día de descanso. Recupera, hidrata, volvé más fuerte.</div>`
        : `<div class="empty-state">
             <div class="empty-icon" aria-hidden="true">＋</div>
             <p>Esta rutina está vacía.</p>
             <button class="primary" data-add-exercise data-routine="${esc(routine.id)}" data-open-drawer="1">Agregar primer ejercicio</button>
           </div>`)
    : routine.exercises.map((ex) => {
        const arr = sessionFor(state, date, ex.id);
        const doneCount = arr.slice(0, ex.sets).filter(Boolean).length;
        const sets = Array.from({ length: ex.sets }, (_, i) => {
          const done = !!arr[i];
          return `<button class="set-btn ${done ? 'done' : ''}"
                          data-toggle-set
                          data-exercise="${esc(ex.id)}"
                          data-index="${i}"
                          data-from="${done ? '1' : '0'}"
                          aria-pressed="${done}"
                          aria-label="Serie ${i + 1}">
                    <span class="lbl">Serie</span>
                    <span class="n">${i + 1}</span>
                  </button>`;
        }).join('');

        const weightChip = ex.weight
          ? `<span class="stat-chip weight"><span class="k">Peso</span> ${esc(ex.weight.value)} ${esc(ex.weight.unit)}</span>`
          : '';

        const url = safeUrl(ex.video);
        const media = parseMedia(url);
        let video = '';
        if (media) {
          if (media.kind === 'link') {
            video = `<a class="video-link" href="${esc(media.url)}" target="_blank" rel="noopener noreferrer">Abrir enlace</a>`;
          } else {
            const open = expandedMedia.has(ex.id);
            const label = media.kind === 'image'
              ? (open ? 'Ocultar imagen' : 'Ver imagen')
              : (open ? 'Ocultar video' : 'Ver video');
            const embed = open ? renderMedia(media) : '';
            video = `
              <button class="video-link" data-toggle-media data-exercise="${esc(ex.id)}" aria-expanded="${open}">${label}</button>
              ${embed}
            `;
          }
        }

        const notes = ex.notes ? `<p class="ex-notes">${esc(ex.notes)}</p>` : '';
        const complete = doneCount === ex.sets && ex.sets > 0;

        const editActions = editMode ? `
          <div class="ex-edit-actions">
            <button class="ex-edit"
                    data-edit-exercise
                    data-routine="${esc(routine.id)}"
                    data-exercise="${esc(ex.id)}"
                    aria-label="Editar ejercicio">✎</button>
            <button class="ex-edit danger-edit"
                    data-remove-exercise
                    data-routine="${esc(routine.id)}"
                    data-exercise="${esc(ex.id)}"
                    aria-label="Eliminar ejercicio">✕</button>
          </div>
        ` : '';
        return `
          <article class="exercise ${complete ? 'complete' : ''}">
            <div class="ex-head">
              <h3>${esc(ex.name)}</h3>
              ${editActions}
            </div>
            ${notes}
            <div class="ex-stats">
              <span class="stat-chip"><span class="k">Series</span> ${ex.sets}</span>
              <span class="stat-chip"><span class="k">${exTargetLabel(ex)}</span> ${esc(exTarget(ex))}</span>
              ${weightChip}
            </div>
            <div class="sets">${sets}</div>
            ${video}
          </article>
        `;
      }).join('');

  const { total, done } = countDoneFor(state, date, routine);

  const drawer = editExerciseId
    ? renderDrawer(routine, routine.exercises.find((e) => e.id === editExerciseId))
    : '';

  const idx = state.doc.routines.findIndex((x) => x.id === routine.id);
  const num = idx >= 0 ? idx : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return `
    <header class="workout-bar">
      ${backBtn('#/')}
      <div class="title-block">
        <div class="title">${esc(displayName(routine.name))}</div>
        <div class="sub">Día ${dayNum(num)} · ${String(done).padStart(2, '0')} / ${String(total).padStart(2, '0')} series</div>
      </div>
      <span></span>
    </header>
    <div class="workout-progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
    ${items}
    ${editMode && routine.exercises.length > 0 ? `
      <div class="fab-row">
        <button class="fab" data-add-exercise data-routine="${esc(routine.id)}" aria-label="Agregar ejercicio">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    ` : ''}
    ${!editMode && routine.exercises.length > 0 ? `
      <div class="bottom-action">
        <button class="ghost" data-clear-sets data-date="${esc(date)}">Volver a empezar</button>
      </div>
    ` : ''}
    ${drawer}
    ${bottomBar(state, routine.exercises.length > 0
      ? (editMode
          ? '<button class="icon-btn primary" data-done>Listo</button>'
          : `<button class="icon-btn primary" data-go="#/workout/${esc(routine.id)}/edit">Editar</button>`)
      : '')}
  `;
};

const renderMedia = (media) => {
  if (media.kind === 'youtube') {
    const cls = media.short ? 'media-wrap short' : 'media-wrap';
    const src = `https://www.youtube.com/embed/${esc(media.id)}`;
    return `<div class="${cls}"><iframe src="${src}" title="YouTube" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  }
  if (media.kind === 'image') {
    return `<div class="media-wrap"><img src="${esc(media.url)}" alt="" loading="lazy" /></div>`;
  }
  return '';
};

const renderDrawer = (routine, ex) => {
  if (!ex) return '';
  const w = ex.weight ?? { value: '', unit: 'kg' };
  return `
    <div class="drawer-backdrop" data-close-drawer></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Editar ejercicio">
      <div class="drawer-handle" aria-hidden="true"></div>
      <div class="drawer-header">
        <h3>Editar ejercicio</h3>
        <button class="icon-btn" data-close-drawer aria-label="Cerrar">✕</button>
      </div>
      <div class="drawer-body">
        <div class="field">
          <label>Nombre</label>
          <input type="text" data-update name="name" value="${esc(ex.name)}"
                 data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}" />
        </div>
        <div class="field">
          <label>Tipo</label>
          <select data-update name="kind"
                  data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}">
            <option value="reps" ${exKind(ex) === 'reps' ? 'selected' : ''}>Repeticiones</option>
            <option value="time" ${exKind(ex) === 'time' ? 'selected' : ''}>Tiempo (cardio)</option>
          </select>
        </div>
        <div class="row">
          <div class="field" style="flex:1">
            <label>Series</label>
            <input type="number" min="1" max="20" inputmode="numeric"
                   data-update name="sets" value="${ex.sets}"
                   data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}" />
          </div>
          <div class="field" style="flex:2">
            ${exKind(ex) === 'time' ? `
              <label>Duración</label>
              <input type="text" data-update name="duration" value="${esc(ex.duration ?? '')}"
                     data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}"
                     placeholder="30 min" />
            ` : `
              <label>Reps</label>
              <input type="text" data-update name="reps" value="${esc(ex.reps ?? '')}"
                     data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}"
                     placeholder="8-12" />
            `}
          </div>
        </div>
        <div class="field">
          <label>Peso</label>
          <div class="row weight-row">
            <input type="number" inputmode="decimal" step="0.5"
                   data-weight-value
                   data-routine="${esc(routine.id)}"
                   data-exercise="${esc(ex.id)}"
                   value="${esc(w.value)}"
                   placeholder="0" style="flex:1" />
            <select data-weight-unit
                    data-routine="${esc(routine.id)}"
                    data-exercise="${esc(ex.id)}">
              <option value="kg" ${w.unit === 'kg' ? 'selected' : ''}>kg</option>
              <option value="lb" ${w.unit === 'lb' ? 'selected' : ''}>lb</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Imagen o video (URL)</label>
          <input type="text" data-update name="video" value="${esc(ex.video ?? '')}"
                 data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}"
                 placeholder="https://youtu.be/... o https://.../foto.jpg" />
        </div>
        <div class="field">
          <label>Notas</label>
          <input type="text" data-update name="notes" value="${esc(ex.notes ?? '')}"
                 data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}" />
        </div>
        <div class="bottom-action">
          <button class="primary" data-close-drawer>Listo</button>
        </div>
      </div>
    </aside>
  `;
};

const renderEdit = (state) => {
  const items = state.doc.routines.map((r, i) => `
    <div class="edit-row" data-reorder-index="${i}" data-routine-id="${esc(r.id)}">
      <button class="drag-handle" data-drag-handle aria-label="Arrastrar para reordenar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
          <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
          <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>
      </button>
      <span class="rc-badge">${dayNum(i)}</span>
      <input class="edit-row-name" type="text"
             data-rename-routine data-routine="${esc(r.id)}"
             value="${esc(r.name)}" aria-label="Nombre de la rutina" />
      <button class="ex-edit danger-edit"
              data-remove-routine data-routine="${esc(r.id)}"
              aria-label="Eliminar rutina">✕</button>
    </div>
  `).join('');

  return `
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
    <div class="edit-list" data-reorder-list>${items}</div>
    <div class="fab-row">
      <button class="fab" data-add-routine aria-label="Nueva rutina">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
    ${bottomBar(state, doneBtn)}
  `;
};


// ---------- render dispatch ----------

const render = (state) => {
  state._undo = store.canUndo();
  state._redo = store.canRedo();

  const route = parseRoute();
  let html;
  if (route.name === 'workout') html = renderWorkout(state, route.routineId, route.editExerciseId, !!route.editMode);
  else if (route.name === 'edit') html = renderEdit(state);
  else if (route.name === 'log') html = renderLog(state);
  else if (route.name === 'motivation') html = renderMotivation(state);
  else html = renderHome(state);

  if (menuOpen) html += renderMenuSheet();
  if (newRoutineOpen) html += renderNewRoutineSheet();

  const drawerOpen = (route.name === 'workout' && !!route.editExerciseId) || menuOpen || newRoutineOpen;
  const suppressDrawerAnim = drawerOpen && lastDrawerOpen;

  const routeKey = JSON.stringify(route);
  const sameRoute = routeKey === lastRouteKey;

  const ui = captureUIState();
  mount(html);
  if (suppressDrawerAnim) {
    const drawer = root.querySelector('.drawer');
    const backdrop = root.querySelector('.drawer-backdrop');
    if (drawer) drawer.classList.add('no-anim');
    if (backdrop) backdrop.classList.add('no-anim');
  }
  restoreUIState(ui);

  // Scroll: keep position on same-route re-renders (undo, set toggles,
  // weight changes…), reset to top when the URL actually changed.
  if (sameRoute) {
    window.scrollTo({ top: ui.pageScroll || 0, left: 0, behavior: 'instant' });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  if (drawerOpen) document.body.setAttribute('data-drawer-open', '');
  else document.body.removeAttribute('data-drawer-open');
  lastDrawerOpen = drawerOpen;
  lastRouteKey = routeKey;

  // Auto-focus the name field when the new-routine drawer first opens.
  if (newRoutineOpen) {
    const input = document.getElementById('new-routine-name');
    if (input && document.activeElement !== input) {
      requestAnimationFrame(() => input.focus());
    }
  }

  // Wire drag-to-reorder on any list flagged with data-reorder-list.
  const list = root.querySelector('[data-reorder-list]');
  if (list) {
    attachReorder(list, (from, to) => {
      store.dispatch(makeCommand('MOVE_ROUTINE', { from, to }));
    });
  }
};

// ---------- Export / Import ----------

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
    input.addEventListener('change', () => { resolved = true; resolve(input.files?.[0] || null); }, { once: true });
    // If the user dismisses the picker without selecting a file there's no
    // event — resolve with null after focus returns and no change fired.
    window.addEventListener('focus', () => {
      setTimeout(() => { if (!resolved) resolve(null); }, 350);
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

  if (!data || typeof data !== 'object' || !Array.isArray(data.routines)) {
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
    message: `Vas a sustituir tus ${store.state.doc.routines.length} rutinas y todas las sesiones por las del archivo (${data.routines.length} rutinas). Esta acción no se puede deshacer.`,
    confirmLabel: 'Reemplazar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;

  // Ensure sessions exists so the store doesn't break later.
  if (!data.sessions || typeof data.sessions !== 'object') data.sessions = {};

  store.replaceDoc(data);
  go('#/');
  showToast('Configuración importada');
};

// ---------- event delegation ----------

const onClick = async (e) => {
  const t = e.target.closest('[data-go],[data-done],[data-undo],[data-redo],[data-toggle-set],[data-toggle-media],[data-clear-sets],[data-add-routine],[data-add-exercise],[data-remove-exercise],[data-remove-routine],[data-reset],[data-edit-exercise],[data-close-drawer],[data-tap-title],[data-menu],[data-close-menu],[data-export],[data-import],[data-cancel-new-routine]');
  if (!t) return;

  if (t.hasAttribute('data-tap-title')) {
    onTitleTap();
    return;
  }
  if (t.hasAttribute('data-go')) {
    go(t.getAttribute('data-go'));
    return;
  }
  if (t.hasAttribute('data-done')) {
    // Context-aware: leave workout-edit mode → normal workout view; else home.
    const route = parseRoute();
    if (route.name === 'workout' && route.editMode) {
      go(`#/workout/${route.routineId}`);
    } else {
      go('#/');
    }
    return;
  }
  if (t.hasAttribute('data-edit-exercise')) {
    const routineId = t.dataset.routine;
    const exerciseId = t.dataset.exercise;
    go(`#/workout/${routineId}/edit/${exerciseId}`);
    return;
  }
  if (t.hasAttribute('data-menu')) {
    menuOpen = true;
    render(store.state);
    return;
  }
  if (t.hasAttribute('data-close-menu')) {
    menuOpen = false;
    render(store.state);
    return;
  }
  if (t.hasAttribute('data-export')) {
    menuOpen = false;
    render(store.state);
    await exportConfig();
    return;
  }
  if (t.hasAttribute('data-import')) {
    menuOpen = false;
    render(store.state);
    await importConfig();
    return;
  }
  if (t.hasAttribute('data-close-drawer')) {
    const route = parseRoute();
    if (route.name === 'workout' && route.editExerciseId) {
      // history.back so we return to whatever route opened the drawer
      // (edit-routine list, workout normal, workout edit). Fall back to
      // the normal workout view if we landed here directly.
      if (history.length > 1) history.back();
      else go(`#/workout/${route.routineId}`);
    }
    return;
  }
  if (t.hasAttribute('data-undo')) {
    const cmd = store.undo();
    if (cmd) showToast(`Deshecho — ${describeCommand(cmd, store.state).toLowerCase()}`);
    return;
  }
  if (t.hasAttribute('data-redo')) {
    const cmd = store.redo();
    if (cmd) showToast(`Rehecho — ${describeCommand(cmd, store.state).toLowerCase()}`);
    return;
  }
  if (t.hasAttribute('data-toggle-media')) {
    const id = t.dataset.exercise;
    if (expandedMedia.has(id)) expandedMedia.delete(id);
    else expandedMedia.add(id);
    render(store.state);
    return;
  }
  if (t.hasAttribute('data-toggle-set')) {
    const exerciseId = t.dataset.exercise;
    const setIndex = Number(t.dataset.index);
    const from = t.dataset.from === '1';
    store.dispatch(makeCommand('TOGGLE_SET', {
      date: todayKey(), exerciseId, setIndex, from, to: !from,
    }));
    return;
  }
  if (t.hasAttribute('data-clear-sets')) {
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
    store.dispatch(makeCommand('CLEAR_SETS', {
      date, from: structuredClone(current), to: null,
    }));
    return;
  }
  if (t.hasAttribute('data-add-routine')) {
    newRoutineOpen = true;
    render(store.state);
    return;
  }
  if (t.hasAttribute('data-cancel-new-routine')) {
    newRoutineOpen = false;
    render(store.state);
    return;
  }
  if (t.hasAttribute('data-add-exercise')) {
    const routineId = t.dataset.routine;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const exercise = {
      id: uid(), name: 'Nuevo ejercicio',
      kind: 'reps', sets: 3, reps: '8-12', duration: '',
      weight: null, video: null, notes: '',
    };
    store.dispatch(makeCommand('ADD_EXERCISE', {
      routineId, index: r.exercises.length, exercise,
    }));
    // Always open the drawer on the new exercise — closing it (history.back)
    // returns the user to whichever view they were on (edit-routine,
    // workout normal, workout edit).
    go(`#/workout/${routineId}/edit/${exercise.id}`);
    return;
  }
  if (t.hasAttribute('data-remove-exercise')) {
    const routineId = t.dataset.routine;
    const exerciseId = t.dataset.exercise;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const index = r.exercises.findIndex((e) => e.id === exerciseId);
    if (index < 0) return;
    const exercise = r.exercises[index];
    const ok = await confirmModal({
      title: 'Eliminar ejercicio',
      message: `Se va a quitar "${exercise.name}" de la rutina.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    store.dispatch(makeCommand('REMOVE_EXERCISE', { routineId, index, exercise }));
    return;
  }
  if (t.hasAttribute('data-remove-routine')) {
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
    return;
  }
  if (t.hasAttribute('data-reset')) {
    if (menuOpen) { menuOpen = false; render(store.state); }
    const ok = await confirmModal({
      title: 'Restaurar rutina inicial',
      message: 'Se van a borrar tus cambios y volver al programa original.',
      confirmLabel: 'Restaurar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    store.reset();
    return;
  }
};

// Field updates dispatch on `change` (blur / Enter), not per-keystroke,
// to avoid one command per character.
const onChange = (e) => {
  const t = e.target;

  if (t.matches('[data-rename-routine]')) {
    const routineId = t.dataset.routine;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const to = t.value.trim();
    if (!to || to === r.name) return;
    store.dispatch(makeCommand('RENAME_ROUTINE', { routineId, from: r.name, to }));
    return;
  }

  if (t.matches('[data-update]')) {
    const routineId = t.dataset.routine;
    const exerciseId = t.dataset.exercise;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const ex = r.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const field = t.name;
    const from = structuredClone(ex);
    const to = structuredClone(ex);
    if (field === 'sets') {
      const n = Math.max(1, Math.min(20, Number(t.value) || 1));
      to.sets = n;
      t.value = n;
    } else if (field === 'video') {
      to.video = t.value.trim() || null;
    } else {
      to[field] = t.value;
    }
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    store.dispatch(makeCommand('UPDATE_EXERCISE', { routineId, exerciseId, from, to }));
    return;
  }

  if (t.matches('[data-weight-value], [data-weight-unit]')) {
    const row = t.closest('.weight-row');
    const valEl = row.querySelector('[data-weight-value]');
    const unitEl = row.querySelector('[data-weight-unit]');
    const routineId = valEl.dataset.routine;
    const exerciseId = valEl.dataset.exercise;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    const ex = r?.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const raw = valEl.value.trim();
    const to = raw === ''
      ? null
      : { value: Number(raw), unit: unitEl.value };
    if (to && Number.isNaN(to.value)) return;
    const from = ex.weight ? { ...ex.weight } : null;
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    store.dispatch(makeCommand('SET_WEIGHT', { routineId, exerciseId, from, to }));
  }
};

// Form submit: only the new-routine drawer uses a <form>.
const onSubmit = (e) => {
  if (e.target.id !== 'new-routine-form') return;
  e.preventDefault();
  const input = document.getElementById('new-routine-name');
  const name = (input?.value ?? '').trim();
  if (!name) { input?.focus(); return; }
  const routine = { id: uid(), name, exercises: [] };
  store.dispatch(makeCommand('ADD_ROUTINE', {
    index: store.state.doc.routines.length, routine,
  }));
  newRoutineOpen = false;
  render(store.state);
  showToast(`Rutina "${name}" creada`);
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

const start = async () => {
  await store.ready;
  // Hydrate quotes from IDB cache (instant) and refresh from network in
  // the background. If the cache is empty this awaits the network fetch.
  await initQuotes();
  store.subscribe(() => render(store.state));
  window.addEventListener('hashchange', () => {
    menuOpen = false;
    newRoutineOpen = false;
    render(store.state);
  });
  window.addEventListener('click', onClick);
  window.addEventListener('change', onChange);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('submit', onSubmit);
  render(store.state);
};

start();
