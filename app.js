import { store } from './store.js';
import { makeCommand } from './commands.js';

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

// Tracks whether the drawer was already open in the previous render so
// subsequent re-renders (auto-saves) don't replay the slide-up animation.
let lastDrawerOpen = false;

// Focus + drawer-scroll preservation across full re-renders. Without this,
// every per-field change in the drawer would blow away focus + the soft
// keyboard. We re-target the same element by its semantic data attributes.
const captureUIState = () => {
  const a = document.activeElement;
  const drawer = root.querySelector('.drawer');
  const scroll = drawer ? drawer.scrollTop : 0;
  if (!a || a === document.body || a === document.documentElement) {
    return { selector: null, scroll };
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
  return { selector, selectionStart, selectionEnd, scroll };
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

const fmtTodayLabel = () => {
  const d = new Date();
  return new Intl.DateTimeFormat('es', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
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
    if (parts[2] === 'edit' && parts[3]) r.editExerciseId = parts[3];
    return r;
  }
  if (parts[0] === 'edit' && parts[1]) return { name: 'edit-routine', routineId: parts[1] };
  if (parts[0] === 'edit') return { name: 'edit' };
  return { name: 'home' };
};

const go = (path) => { location.hash = path; };

// ---------- views ----------

// Fixed bottom action bar rendered on every view. Left: undo/redo.
// Right: contextual primary action (Editar on home, Listo on edit, etc).
const bottomBar = (state, primary = '') => `
  <nav class="bottom-bar">
    <div class="bottom-bar-inner">
      <div class="group">
        <button class="icon-btn" data-undo aria-label="Deshacer" ${state._undo ? '' : 'disabled'}>↶</button>
        <button class="icon-btn" data-redo aria-label="Rehacer" ${state._redo ? '' : 'disabled'}>↷</button>
      </div>
      <div class="group">${primary}</div>
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
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
const dayWord = (i) => DAY_WORDS[i] ?? String(i + 1);
const roman = (n) => ROMAN[n - 1] ?? String(n);
const dayNum = (i) => String(i + 1).padStart(2, '0');
const displayName = (raw) => {
  const idx = raw.indexOf(':');
  return (idx >= 0 ? raw.slice(idx + 1).trim() : raw);
};

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
        <h1 class="app-title">Arnold</h1>
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

const renderWorkout = (state, routineId, editExerciseId) => {
  const routine = state.doc.routines.find((r) => r.id === routineId);
  if (!routine) return renderHome(state);
  const date = todayKey();

  const items = routine.exercises.length === 0
    ? `<div class="rest-card">Día de descanso. Recupera, hidrata, vuelve más fuerte.</div>`
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

        return `
          <article class="exercise ${complete ? 'complete' : ''}">
            <div class="ex-head">
              <h3>${esc(ex.name)}</h3>
              <button class="ex-edit"
                      data-edit-exercise
                      data-routine="${esc(routine.id)}"
                      data-exercise="${esc(ex.id)}"
                      aria-label="Editar ejercicio">✎</button>
            </div>
            ${notes}
            <div class="ex-stats">
              <span class="stat-chip"><span class="k">Series</span> ${ex.sets}</span>
              <span class="stat-chip"><span class="k">Reps</span> ${esc(ex.reps)}</span>
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
      <button class="back" data-go="#/" aria-label="Volver">‹ Inicio</button>
      <div class="title-block">
        <div class="title">${esc(displayName(routine.name))}</div>
        <div class="sub">Día ${dayNum(num)} · ${String(done).padStart(2, '0')} / ${String(total).padStart(2, '0')} series</div>
      </div>
      <span></span>
    </header>
    <div class="workout-progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
    ${items}
    ${routine.exercises.length > 0 ? `
      <div class="bottom-action">
        <button class="ghost" data-clear-sets data-date="${esc(date)}">Reiniciar checklist</button>
      </div>
    ` : ''}
    ${drawer}
    ${bottomBar(state)}
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
        <div class="row">
          <div class="field" style="flex:1">
            <label>Series</label>
            <input type="number" min="1" max="20" inputmode="numeric"
                   data-update name="sets" value="${ex.sets}"
                   data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}" />
          </div>
          <div class="field" style="flex:2">
            <label>Reps</label>
            <input type="text" data-update name="reps" value="${esc(ex.reps)}"
                   data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}" />
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
          <label>Video (URL)</label>
          <input type="text" data-update name="video" value="${esc(ex.video ?? '')}"
                 data-routine="${esc(routine.id)}" data-exercise="${esc(ex.id)}"
                 placeholder="https://youtu.be/..." />
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
    <button class="routine-card" data-go="#/edit/${esc(r.id)}">
      <div class="rc-row1">
        <span class="rc-badge">${dayNum(i)}</span>
        <div class="rc-title">
          <span class="rc-eyebrow">Día ${esc(dayWord(i))}</span>
          ${esc(displayName(r.name))}
        </div>
        <span class="rc-chev" aria-hidden="true">›</span>
      </div>
      <div class="rc-row2"><span class="num small muted">${String(r.exercises.length).padStart(2, '0')} ejercicios</span></div>
    </button>
  `).join('');

  return `
    <header class="app-bar">
      <div class="app-bar-left">
        <button class="back" data-go="#/" aria-label="Volver" style="background:transparent;border:0;color:var(--fg);font-family:var(--display);font-weight:700;font-size:0.95rem;padding:0.5rem 0.5rem 0.5rem 0;min-height:40px">‹ Inicio</button>
      </div>
    </header>
    <div class="section">
      <span class="label">Editar rutinas</span>
      <span class="count">${String(state.doc.routines.length).padStart(2, '0')}</span>
    </div>
    <div class="routine-list">${items}</div>
    <div class="bottom-action">
      <button class="primary" data-add-routine>+ Nueva rutina</button>
    </div>
    <div class="bottom-action">
      <button class="danger" data-reset>Restaurar rutina inicial</button>
    </div>
    ${bottomBar(state, doneBtn)}
  `;
};

const renderEditRoutine = (state, routineId) => {
  const r = state.doc.routines.find((x) => x.id === routineId);
  if (!r) return renderEdit(state);

  const rows = r.exercises.map((ex) => `
    <div class="exercise" data-ex-row="${esc(ex.id)}">
      <div class="field">
        <label>Nombre</label>
        <input type="text" data-update name="name" value="${esc(ex.name)}"
               data-routine="${esc(r.id)}" data-exercise="${esc(ex.id)}" />
      </div>
      <div class="row">
        <div class="field" style="flex:1">
          <label>Series</label>
          <input type="number" min="1" max="20" data-update name="sets" value="${ex.sets}"
                 data-routine="${esc(r.id)}" data-exercise="${esc(ex.id)}" />
        </div>
        <div class="field" style="flex:2">
          <label>Reps</label>
          <input type="text" data-update name="reps" value="${esc(ex.reps)}"
                 data-routine="${esc(r.id)}" data-exercise="${esc(ex.id)}" />
        </div>
      </div>
      <div class="field">
        <label>Video (URL)</label>
        <input type="text" data-update name="video" value="${esc(ex.video ?? '')}"
               data-routine="${esc(r.id)}" data-exercise="${esc(ex.id)}"
               placeholder="https://youtu.be/..." />
      </div>
      <div class="field">
        <label>Notas</label>
        <input type="text" data-update name="notes" value="${esc(ex.notes ?? '')}"
               data-routine="${esc(r.id)}" data-exercise="${esc(ex.id)}" />
      </div>
      <div class="exercise-row-actions">
        <button class="danger" data-remove-exercise
                data-routine="${esc(r.id)}" data-exercise="${esc(ex.id)}">Eliminar</button>
      </div>
    </div>
  `).join('');

  const idx = state.doc.routines.findIndex((x) => x.id === r.id);
  const num = idx >= 0 ? idx : 0;
  return `
    <header class="workout-bar">
      <button class="back" data-go="#/edit" aria-label="Volver">‹ Rutinas</button>
      <div class="title-block">
        <div class="title">${esc(displayName(r.name))}</div>
        <div class="sub">Día ${dayNum(num)} · ${String(r.exercises.length).padStart(2, '0')} ejercicios</div>
      </div>
      <span></span>
    </header>
    <div class="field">
      <label>Nombre de la rutina</label>
      <input type="text" data-rename-routine data-routine="${esc(r.id)}" value="${esc(r.name)}" />
    </div>
    <div class="section">
      <span class="label">Ejercicios</span>
      <span class="count">${String(r.exercises.length).padStart(2, '0')}</span>
    </div>
    ${rows || '<p class="muted small">Sin ejercicios.</p>'}
    <div class="bottom-action">
      <button class="primary" data-add-exercise data-routine="${esc(r.id)}">+ Agregar ejercicio</button>
    </div>
    <div class="bottom-action">
      <button class="danger" data-remove-routine data-routine="${esc(r.id)}">Eliminar rutina</button>
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
  if (route.name === 'workout') html = renderWorkout(state, route.routineId, route.editExerciseId);
  else if (route.name === 'edit') html = renderEdit(state);
  else if (route.name === 'edit-routine') html = renderEditRoutine(state, route.routineId);
  else html = renderHome(state);

  const drawerOpen = route.name === 'workout' && !!route.editExerciseId;
  const suppressDrawerAnim = drawerOpen && lastDrawerOpen;

  const ui = captureUIState();
  mount(html);
  if (suppressDrawerAnim) {
    const drawer = root.querySelector('.drawer');
    const backdrop = root.querySelector('.drawer-backdrop');
    if (drawer) drawer.classList.add('no-anim');
    if (backdrop) backdrop.classList.add('no-anim');
  }
  restoreUIState(ui);

  if (drawerOpen) document.body.setAttribute('data-drawer-open', '');
  else document.body.removeAttribute('data-drawer-open');
  lastDrawerOpen = drawerOpen;
};

// ---------- event delegation ----------

const onClick = (e) => {
  const t = e.target.closest('[data-go],[data-done],[data-undo],[data-redo],[data-toggle-set],[data-toggle-media],[data-clear-sets],[data-add-routine],[data-add-exercise],[data-remove-exercise],[data-remove-routine],[data-reset],[data-edit-exercise],[data-close-drawer]');
  if (!t) return;

  if (t.hasAttribute('data-go')) {
    go(t.getAttribute('data-go'));
    return;
  }
  if (t.hasAttribute('data-done')) {
    go('#/');
    return;
  }
  if (t.hasAttribute('data-edit-exercise')) {
    const routineId = t.dataset.routine;
    const exerciseId = t.dataset.exercise;
    go(`#/workout/${routineId}/edit/${exerciseId}`);
    return;
  }
  if (t.hasAttribute('data-close-drawer')) {
    const route = parseRoute();
    if (route.name === 'workout' && route.editExerciseId) {
      go(`#/workout/${route.routineId}`);
    }
    return;
  }
  if (t.hasAttribute('data-undo')) {
    store.undo();
    return;
  }
  if (t.hasAttribute('data-redo')) {
    store.redo();
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
    if (!confirm('¿Reiniciar las series marcadas de hoy?')) return;
    store.dispatch(makeCommand('CLEAR_SETS', {
      date, from: structuredClone(current), to: null,
    }));
    return;
  }
  if (t.hasAttribute('data-add-routine')) {
    const name = prompt('Nombre de la nueva rutina:', 'Nueva rutina');
    if (!name) return;
    const routine = { id: uid(), name: name.trim(), exercises: [] };
    store.dispatch(makeCommand('ADD_ROUTINE', {
      index: store.state.doc.routines.length, routine,
    }));
    return;
  }
  if (t.hasAttribute('data-add-exercise')) {
    const routineId = t.dataset.routine;
    const r = store.state.doc.routines.find((x) => x.id === routineId);
    if (!r) return;
    const exercise = {
      id: uid(), name: 'Nuevo ejercicio', sets: 3, reps: '8-12',
      weight: null, video: null, notes: '',
    };
    store.dispatch(makeCommand('ADD_EXERCISE', {
      routineId, index: r.exercises.length, exercise,
    }));
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
    if (!confirm(`¿Eliminar "${exercise.name}"?`)) return;
    store.dispatch(makeCommand('REMOVE_EXERCISE', { routineId, index, exercise }));
    return;
  }
  if (t.hasAttribute('data-remove-routine')) {
    const routineId = t.dataset.routine;
    const index = store.state.doc.routines.findIndex((x) => x.id === routineId);
    if (index < 0) return;
    const routine = store.state.doc.routines[index];
    if (!confirm(`¿Eliminar la rutina "${routine.name}"?`)) return;
    store.dispatch(makeCommand('REMOVE_ROUTINE', { index, routine }));
    go('#/edit');
    return;
  }
  if (t.hasAttribute('data-reset')) {
    if (!confirm('Esto borrará tus cambios y volverá a la rutina inicial. ¿Continuar?')) return;
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
    if (e.shiftKey) store.redo(); else store.undo();
  } else if (e.key === 'y' || e.key === 'Y') {
    if (isEditableTarget(e)) return;
    e.preventDefault();
    store.redo();
  }
};

// ---------- boot ----------

const start = async () => {
  await store.ready;
  store.subscribe(() => render(store.state));
  window.addEventListener('hashchange', () => render(store.state));
  window.addEventListener('click', onClick);
  window.addEventListener('change', onChange);
  window.addEventListener('keydown', onKeyDown);
  render(store.state);
};

start();
