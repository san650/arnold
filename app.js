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

const mount = (htmlString) => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.deleteContents();
  range.setStart(root, 0);
  const frag = range.createContextualFragment(htmlString);
  root.appendChild(frag);
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
  if (parts[0] === 'workout' && parts[1]) return { name: 'workout', routineId: parts[1] };
  if (parts[0] === 'edit' && parts[1]) return { name: 'edit-routine', routineId: parts[1] };
  if (parts[0] === 'edit') return { name: 'edit' };
  return { name: 'home' };
};

const go = (path) => { location.hash = path; };

// ---------- views ----------

const undoBar = (state) => `
  <div class="actions">
    <button class="icon-btn" data-undo title="Deshacer" aria-label="Deshacer" ${state._undo ? '' : 'disabled'}>↶</button>
    <button class="icon-btn" data-redo title="Rehacer" aria-label="Rehacer" ${state._redo ? '' : 'disabled'}>↷</button>
  </div>
`;

const renderHome = (state) => {
  const date = todayKey();
  const cards = state.doc.routines.map((r) => {
    const { total, done } = countDoneFor(state, date, r);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const count = r.exercises.length;
    const sub = count === 0
      ? 'Sin ejercicios'
      : `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'}`;
    return `
      <button class="routine-card" data-go="#/workout/${esc(r.id)}">
        <div class="title">${esc(r.name)}</div>
        <div class="subtitle">${esc(sub)}</div>
        <div class="meta">
          <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
          <div>${done}/${total}</div>
        </div>
      </button>`;
  }).join('');

  return `
    <header class="header">
      <h1>Arnold</h1>
      ${undoBar(state)}
    </header>
    <div class="today">${esc(fmtTodayLabel())}</div>
    <div class="routine-list">${cards}</div>
    <div class="bottom-action">
      <button data-go="#/edit">Editar rutinas</button>
    </div>
  `;
};

const renderWorkout = (state, routineId) => {
  const routine = state.doc.routines.find((r) => r.id === routineId);
  if (!routine) return renderHome(state);
  const date = todayKey();

  const items = routine.exercises.length === 0
    ? `<div class="rest-card">Sin ejercicios programados.<br/>Buen momento para descansar o hacer cardio.</div>`
    : routine.exercises.map((ex) => {
        const arr = sessionFor(state, date, ex.id);
        const sets = Array.from({ length: ex.sets }, (_, i) => {
          const done = !!arr[i];
          return `<button class="set-btn ${done ? 'done' : ''}"
                          data-toggle-set
                          data-exercise="${esc(ex.id)}"
                          data-index="${i}"
                          data-from="${done ? '1' : '0'}"
                          aria-pressed="${done}"
                          aria-label="Serie ${i + 1}">${i + 1}</button>`;
        }).join('');

        const weightLabel = ex.weight ? `${esc(ex.weight.value)} ${esc(ex.weight.unit)}` : '—';
        const w = ex.weight ?? { value: '', unit: 'kg' };
        const weightInput = `
          <div class="row weight-row">
            <span class="muted small">Peso:</span>
            <input type="number" inputmode="decimal" step="0.5"
                   data-weight-value
                   data-routine="${esc(routine.id)}"
                   data-exercise="${esc(ex.id)}"
                   value="${esc(w.value)}"
                   placeholder="0" />
            <select data-weight-unit
                    data-routine="${esc(routine.id)}"
                    data-exercise="${esc(ex.id)}">
              <option value="kg" ${w.unit === 'kg' ? 'selected' : ''}>kg</option>
              <option value="lb" ${w.unit === 'lb' ? 'selected' : ''}>lb</option>
            </select>
            <span class="muted small right">${weightLabel}</span>
          </div>
        `;

        const url = safeUrl(ex.video);
        const video = url
          ? `<a class="video-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">▶ Ver video</a>`
          : '';

        const notes = ex.notes ? `<p class="notes">${esc(ex.notes)}</p>` : '';

        return `
          <div class="exercise">
            <h3>${esc(ex.name)}</h3>
            ${notes}
            <div class="target">${ex.sets} × ${esc(ex.reps)}</div>
            <div class="sets">${sets}</div>
            ${weightInput}
            ${video}
          </div>
        `;
      }).join('');

  const { total, done } = countDoneFor(state, date, routine);

  return `
    <header class="header">
      <div class="back-row" style="margin:0">
        <button class="back-btn" data-go="#/">← Inicio</button>
      </div>
      ${undoBar(state)}
    </header>
    <h2 class="workout-title">${esc(routine.name)}</h2>
    <p class="workout-sub">${esc(fmtTodayLabel())} · ${done}/${total} series</p>
    ${items}
    ${routine.exercises.length > 0 ? `
      <div class="bottom-action">
        <button data-clear-sets data-date="${esc(date)}">Reiniciar checklist de hoy</button>
      </div>
    ` : ''}
  `;
};

const renderEdit = (state) => {
  const items = state.doc.routines.map((r) => `
    <button class="routine-card" data-go="#/edit/${esc(r.id)}">
      <div class="title">${esc(r.name)}</div>
      <div class="subtitle">${r.exercises.length} ejercicios</div>
    </button>
  `).join('');

  return `
    <header class="header">
      <div class="back-row" style="margin:0">
        <button class="back-btn" data-go="#/">← Inicio</button>
      </div>
      ${undoBar(state)}
    </header>
    <h2 class="workout-title">Editar rutinas</h2>
    <div class="routine-list">${items}</div>
    <div class="bottom-action">
      <button class="primary" data-add-routine>+ Nueva rutina</button>
    </div>
    <div class="bottom-action">
      <button class="danger" data-reset>Restaurar rutina inicial</button>
    </div>
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

  return `
    <header class="header">
      <div class="back-row" style="margin:0">
        <button class="back-btn" data-go="#/edit">← Rutinas</button>
      </div>
      ${undoBar(state)}
    </header>
    <div class="field">
      <label>Nombre de la rutina</label>
      <input type="text" data-rename-routine data-routine="${esc(r.id)}" value="${esc(r.name)}" />
    </div>
    <div class="section-title">Ejercicios</div>
    ${rows || '<p class="muted small">Sin ejercicios.</p>'}
    <div class="bottom-action">
      <button class="primary" data-add-exercise data-routine="${esc(r.id)}">+ Agregar ejercicio</button>
    </div>
    <div class="bottom-action">
      <button class="danger" data-remove-routine data-routine="${esc(r.id)}">Eliminar rutina</button>
    </div>
  `;
};

// ---------- render dispatch ----------

const render = (state) => {
  state._undo = store.canUndo();
  state._redo = store.canRedo();

  const route = parseRoute();
  let html;
  if (route.name === 'workout') html = renderWorkout(state, route.routineId);
  else if (route.name === 'edit') html = renderEdit(state);
  else if (route.name === 'edit-routine') html = renderEditRoutine(state, route.routineId);
  else html = renderHome(state);
  mount(html);
};

// ---------- event delegation ----------

const onClick = (e) => {
  const t = e.target.closest('[data-go],[data-undo],[data-redo],[data-toggle-set],[data-clear-sets],[data-add-routine],[data-add-exercise],[data-remove-exercise],[data-remove-routine],[data-reset]');
  if (!t) return;

  if (t.hasAttribute('data-go')) {
    go(t.getAttribute('data-go'));
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
