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

// Session entries are `{ sets: boolean[], snapshot: { name, kind, weight,
// duration, reps } | null }`. Legacy boolean[] entries are migrated on boot
// (see app.js). This helper accepts either shape and returns the new one.
const entryOf = (raw) => {
  if (Array.isArray(raw)) return { sets: [...raw], snapshot: null };
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

  SET_WEIGHT: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const e = findExercise(r, p.exerciseId);
      e.weight = p.to ? { ...p.to } : null;
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const e = findExercise(r, p.exerciseId);
      e.weight = p.from ? { ...p.from } : null;
    },
    coalesceKey: (p) => `weight:${p.routineId}:${p.exerciseId}`,
  },

  UPDATE_EXERCISE: {
    apply: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const i = r.exercises.findIndex((e) => e.id === p.exerciseId);
      r.exercises[i] = structuredClone(p.to);
    },
    revert: (s, p) => {
      const r = findRoutine(s, p.routineId);
      const i = r.exercises.findIndex((e) => e.id === p.exerciseId);
      r.exercises[i] = structuredClone(p.from);
    },
    coalesceKey: (p) => `update:${p.routineId}:${p.exerciseId}`,
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

  // Bulk catalog operations — act on every routine.exercise matching a
  // normalized name. `targets: [{ routineId, exerciseId, fromValue }]`
  // captures one row per matching instance so revert is exact.
  CATALOG_RENAME: {
    apply: (s, p) => {
      for (const t of p.targets) {
        const r = findRoutine(s, t.routineId);
        if (!r) continue;
        const e = findExercise(r, t.exerciseId);
        if (e) e.name = p.toName;
      }
    },
    revert: (s, p) => {
      for (const t of p.targets) {
        const r = findRoutine(s, t.routineId);
        if (!r) continue;
        const e = findExercise(r, t.exerciseId);
        if (e) e.name = t.fromValue;
      }
    },
    coalesceKey: (p) => `cat-rename:${p.toName}`,
  },

  // Generic per-field bulk update. `field` is one of `kind|reps|duration|
  // weight|video|notes|sets`. Targets keep `fromValue` per instance.
  CATALOG_UPDATE_FIELD: {
    apply: (s, p) => {
      for (const t of p.targets) {
        const r = findRoutine(s, t.routineId);
        if (!r) continue;
        const e = findExercise(r, t.exerciseId);
        if (!e) continue;
        e[p.field] = p.toValue === null || p.toValue === undefined
          ? (p.field === 'weight' || p.field === 'video' ? null : '')
          : (typeof p.toValue === 'object' ? structuredClone(p.toValue) : p.toValue);
      }
    },
    revert: (s, p) => {
      for (const t of p.targets) {
        const r = findRoutine(s, t.routineId);
        if (!r) continue;
        const e = findExercise(r, t.exerciseId);
        if (!e) continue;
        e[p.field] = t.fromValue === null || t.fromValue === undefined
          ? (p.field === 'weight' || p.field === 'video' ? null : '')
          : (typeof t.fromValue === 'object' ? structuredClone(t.fromValue) : t.fromValue);
      }
    },
    coalesceKey: (p) => `cat-field:${p.field}:${p.name}`,
  },

  // Remove every instance of a catalog exercise from all routines.
  // Sessions are preserved (they're historical records). `targets:
  // [{ routineId, index, exercise }]` captures position + full exercise
  // for revert.
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
