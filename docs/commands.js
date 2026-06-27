// Every state mutation is a Command with apply/revert. The store funnels
// all writes through dispatch(), enabling undo, redo, and replay from one
// chokepoint. Payloads must carry both `from` and `to` so revert is exact.

const ensureSession = (state, date) => {
  if (!state.doc.sessions[date]) state.doc.sessions[date] = {};
};

const findRoutine = (state, routineId) =>
  state.doc.routines.find((r) => r.id === routineId);

const findExercise = (routine, exerciseId) =>
  routine.exercises.find((e) => e.id === exerciseId);

// Session entries are `{ sets: boolean[], snapshot: { name, kind, unit, series,
// routineId } | null }`. Returns a normalized copy.
const entryOf = (raw) => {
  if (raw && typeof raw === 'object') {
    return { sets: Array.isArray(raw.sets) ? [...raw.sets] : [], snapshot: raw.snapshot ?? null };
  }
  return { sets: [], snapshot: null };
};

export const COMMANDS = {
  TOGGLE_SET: {
    apply: (s, p) => {
      ensureSession(s, p.date);
      const sess = s.doc.sessions[p.date];
      const entry = entryOf(sess[p.exerciseId]);
      entry.sets[p.setIndex] = p.to;
      // Snapshot reflects the most recent claim about today's lift. Only
      // overwrite when the caller provided one (i.e. on a set-completion
      // toggle); undos restore the prior snapshot via p.fromSnapshot.
      if (p.snapshot !== undefined) entry.snapshot = p.snapshot ? structuredClone(p.snapshot) : null;
      sess[p.exerciseId] = entry;
    },
    revert: (s, p) => {
      ensureSession(s, p.date);
      const sess = s.doc.sessions[p.date];
      const entry = entryOf(sess[p.exerciseId]);
      entry.sets[p.setIndex] = p.from;
      if (p.fromSnapshot !== undefined) entry.snapshot = p.fromSnapshot ? structuredClone(p.fromSnapshot) : null;
      sess[p.exerciseId] = entry;
    },
    coalesceKey: (p) => `${p.date}:${p.exerciseId}:${p.setIndex}`,
  },

  CLEAR_SETS: {
    apply: (s, p) => {
      s.doc.sessions[p.date] = {};
    },
    revert: (s, p) => {
      s.doc.sessions[p.date] = structuredClone(p.from) || {};
    },
    coalesceKey: (p) => `clear:${p.date}`,
  },

  // Per-instance training params: swap one routine reference's `series`
  // (weights, reps, set count, duration) via from/to clones. Definition
  // fields live on the catalog entry, not here.
  UPDATE_SERIES: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const e = r && findExercise(r, p.exerciseId);
      if (e) e.series = structuredClone(p.to);
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const e = r && findExercise(r, p.exerciseId);
      if (e) e.series = structuredClone(p.from);
    },
    coalesceKey: (p) => `series:${p.routineId}:${p.exerciseId}`,
  },

  // Edit a catalog entry's definition fields (name, kind, video, notes, unit).
  // Because routines reference the entry, one edit propagates to every routine
  // automatically. A `kind` change reshapes the `series` of every referencing
  // instance; `p.reshape: [{ routineId, exerciseId, from, to }]` captures those
  // per-instance series so undo is exact.
  UPDATE_CATALOG_ENTRY: {
    apply: (s, p) => {
      const i = (s.doc.catalog || []).findIndex((c) => c.id === p.catalogId);
      if (i >= 0) s.doc.catalog[i] = structuredClone(p.to);
      for (const t of (p.reshape || [])) {
        const r = findRoutine(s, t.routineId);
        const e = r && findExercise(r, t.exerciseId);
        if (e) e.series = structuredClone(t.to);
      }
    },
    revert: (s, p) => {
      const i = (s.doc.catalog || []).findIndex((c) => c.id === p.catalogId);
      if (i >= 0) s.doc.catalog[i] = structuredClone(p.from);
      for (const t of (p.reshape || [])) {
        const r = findRoutine(s, t.routineId);
        const e = r && findExercise(r, t.exerciseId);
        if (e) e.series = structuredClone(t.from);
      }
    },
    coalesceKey: (p) => `cat-entry:${p.catalogId}`,
  },

  ADD_EXERCISE: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      r.exercises.splice(p.index, 0, structuredClone(p.exercise));
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      r.exercises.splice(p.index, 1);
    },
    coalesceKey: (p) => `add-ex:${p.routineId}:${p.exercise.id}`,
  },

  REMOVE_EXERCISE: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      r.exercises.splice(p.index, 1);
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      r.exercises.splice(p.index, 0, structuredClone(p.exercise));
    },
    coalesceKey: (p) => `rm-ex:${p.routineId}:${p.exercise.id}`,
  },

  RENAME_ROUTINE: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      r.name = p.to;
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      r.name = p.from;
    },
    coalesceKey: (p) => `rename:${p.routineId}`,
  },

  ADD_ROUTINE: {
    apply: (s, p) => {
      s.doc.routines.splice(p.index, 0, structuredClone(p.routine));
    },
    revert: (s, p) => {
      s.doc.routines.splice(p.index, 1);
    },
    coalesceKey: (p) => `add-r:${p.routine.id}`,
  },

  REMOVE_ROUTINE: {
    apply: (s, p) => {
      s.doc.routines.splice(p.index, 1);
    },
    revert: (s, p) => {
      s.doc.routines.splice(p.index, 0, structuredClone(p.routine));
    },
    coalesceKey: (p) => `rm-r:${p.routine.id}`,
  },

  // Add a standalone exercise definition to the catalog. Catalog entries hold
  // only the definition (name, kind, image/video, notes); routine-specific
  // params (sets/reps/duration/weight) are set on the routine instance.
  ADD_CATALOG_EXERCISE: {
    apply: (s, p) => {
      if (!Array.isArray(s.doc.catalog)) s.doc.catalog = [];
      s.doc.catalog.splice(p.index, 0, structuredClone(p.exercise));
    },
    revert: (s, p) => {
      if (!Array.isArray(s.doc.catalog)) return;
      s.doc.catalog.splice(p.index, 1);
    },
    coalesceKey: (p) => `add-cat:${p.exercise.id}`,
  },

  // Delete a catalog entry and cascade-remove every routine reference to it.
  // Sessions are preserved (they're historical records). `targets:
  // [{ routineId, index, exercise }]` captures each reference's position +
  // full instance, and `catalogTarget: { id, index, exercise }` the entry,
  // so undo restores everything exactly.
  CATALOG_DELETE: {
    apply: (s, p) => {
      // Remove from each routine, descending index so splices don't shift.
      const byRoutine = new Map();
      for (const t of p.targets) {
        if (!byRoutine.has(t.routineId)) byRoutine.set(t.routineId, []);
        byRoutine.get(t.routineId).push(t);
      }
      for (const [routineId, ts] of byRoutine) {
        const r = findRoutine(s, routineId);
        if (!r) continue;
        ts.sort((a, b) => b.index - a.index);
        for (const t of ts) r.exercises.splice(t.index, 1);
      }
      // Also remove the standalone catalog definition, if any.
      if (p.catalogTarget && Array.isArray(s.doc.catalog)) {
        const i = s.doc.catalog.findIndex((c) => c.id === p.catalogTarget.id);
        if (i >= 0) s.doc.catalog.splice(i, 1);
      }
    },
    revert: (s, p) => {
      // Re-insert ascending so each splice lands at the captured index.
      const byRoutine = new Map();
      for (const t of p.targets) {
        if (!byRoutine.has(t.routineId)) byRoutine.set(t.routineId, []);
        byRoutine.get(t.routineId).push(t);
      }
      for (const [routineId, ts] of byRoutine) {
        const r = findRoutine(s, routineId);
        if (!r) continue;
        ts.sort((a, b) => a.index - b.index);
        for (const t of ts) r.exercises.splice(t.index, 0, structuredClone(t.exercise));
      }
      if (p.catalogTarget) {
        if (!Array.isArray(s.doc.catalog)) s.doc.catalog = [];
        s.doc.catalog.splice(p.catalogTarget.index, 0, structuredClone(p.catalogTarget.exercise));
      }
    },
    coalesceKey: (p) => `cat-del:${p.name}`,
  },

  MOVE_ROUTINE: {
    apply: (s, p) => {
      const [moved] = s.doc.routines.splice(p.from, 1);
      s.doc.routines.splice(p.to, 0, moved);
    },
    revert: (s, p) => {
      const [moved] = s.doc.routines.splice(p.to, 1);
      s.doc.routines.splice(p.from, 0, moved);
    },
    // Each move is its own undo step (no coalescing across rapid taps).
    coalesceKey: () => 'move',
  },

  MOVE_EXERCISE: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const [moved] = r.exercises.splice(p.from, 1);
      r.exercises.splice(p.to, 0, moved);
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const [moved] = r.exercises.splice(p.to, 1);
      r.exercises.splice(p.from, 0, moved);
    },
    coalesceKey: (p) => `move-ex:${p.routineId}`,
  },
};

export const makeCommand = (type, payload) => ({ type, payload });

export const coalesceKeyOf = (cmd) =>
  `${cmd.type}:${COMMANDS[cmd.type].coalesceKey(cmd.payload)}`;

// Only meaningful for commands with primitive from/to. Object payloads
// always pass through (caller should pre-check equality if it matters).
export const isNoOp = (cmd) => {
  const { from, to } = cmd.payload;
  return from !== undefined && to !== undefined && from === to;
};
