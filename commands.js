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

export const COMMANDS = {
  TOGGLE_SET: {
    apply: (s, p) => {
      ensureSession(s, p.date);
      const sess = s.doc.sessions[p.date];
      const arr = sess[p.exerciseId] ? [...sess[p.exerciseId]] : [];
      arr[p.setIndex] = p.to;
      sess[p.exerciseId] = arr;
    },
    revert: (s, p) => {
      ensureSession(s, p.date);
      const sess = s.doc.sessions[p.date];
      const arr = sess[p.exerciseId] ? [...sess[p.exerciseId]] : [];
      arr[p.setIndex] = p.from;
      sess[p.exerciseId] = arr;
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
