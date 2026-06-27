// Initial document, used when storage is empty. The app assumes a fresh
// install, so the seed is authored directly in the normalized model:
//   catalog:           [{ id, name, kind, video, notes, unit }]   (source of truth)
//   routine.exercises: [{ id, catalogId, series }]                (references)
// `series`: reps → { weight, reps } per set; time → { duration } per set.
//
// Exercise names are in Spanish (verified against ES gym sources); the English
// name and any clarifying note live in `notes`.

// Three identical reps sets, no weight set yet, target 10 reps.
const reps3 = () => [
  { weight: null, reps: 10 },
  { weight: null, reps: 10 },
  { weight: null, reps: 10 },
];
const time3 = (d) => [{ duration: d }, { duration: d }, { duration: d }];

// A catalog definition, keyed for routine references. `id` is a stable,
// readable slug derived from the key.
const def = (key, name, extra = {}) => ({
  id: `cat-${key}`,
  name,
  kind: extra.kind === 'time' ? 'time' : 'reps',
  video: extra.video ?? null,
  notes: extra.notes ?? '',
  unit: 'kg',
});

// A routine reference to a catalog entry, with its per-instance series.
const ref = (id, key, series) => ({ id, catalogId: `cat-${key}`, series });

const CATALOG = [
  def('bench', 'Press de banca con barra', { notes: 'Barbell Bench Press · pecho plano' }),
  def('ohp', 'Press militar con barra', { video: 'https://youtu.be/waeCyaAQRn8', notes: 'Barbell Military Press' }),
  def('incline', 'Press inclinado con mancuernas', { video: 'https://youtu.be/bR_dKXdtfrQ', notes: 'Dumbbell Incline Press' }),
  def('lateral', 'Elevaciones laterales con mancuernas', { video: 'https://youtu.be/XPPfnSEATJA', notes: 'Dumbbell Lateral Raises' }),
  def('frenchpress', 'Press francés con mancuerna', { video: 'https://youtu.be/BW15DLXmvUY', notes: 'Dumbbell Tricep Extensions' }),
  def('squat', 'Sentadilla con barra', { video: 'https://youtu.be/S9iWwaqbD3Q', notes: 'Barbell Squats' }),
  def('bulgarian', 'Sentadilla búlgara', { video: 'https://youtu.be/9p5e2BSvoLs', notes: 'Bulgarian Split Squats · por pierna' }),
  def('legpress', 'Prensa de piernas', { video: 'https://youtu.be/px3fnV8dCl0', notes: 'Leg Press' }),
  def('legext', 'Extensión de cuádriceps', { video: 'https://youtube.com/shorts/iQ92TuvBqRo', notes: 'Leg Extensions' }),
  def('calf', 'Elevación de talones de pie', { video: 'https://youtube.com/shorts/lyDp3tbx3qU', notes: 'Standing Calf Raises' }),
  def('deadlift', 'Peso muerto con barra', { notes: 'Barbell Deadlifts' }),
  def('row', 'Remo con barra inclinado', { notes: 'Barbell Bent Over Rows' }),
  def('pulldown', 'Jalón al pecho en polea', { notes: 'Lat Pulldowns' }),
  def('upright', 'Remo al mentón con mancuernas', { notes: 'Dumbbell Upright Rows' }),
  def('curl', 'Curl de bíceps alterno con mancuernas', { notes: 'Dumbbell Single Arm Bicep Curls' }),
  def('hamcurl', 'Curl femoral tumbado', { notes: 'Hamstring Curls' }),
  def('glute', 'Puente de glúteos', { notes: 'Glute Bridges' }),
  def('plank', 'Plancha abdominal', { kind: 'time', notes: 'Plank' }),
];

export const SEED = {
  routines: [
    {
      id: 'day1',
      name: 'Día 1: Tren Superior (Empuje)',
      exercises: [
        ref('d1e1', 'bench', reps3()),
        ref('d1e2', 'ohp', reps3()),
        ref('d1e3', 'incline', reps3()),
        ref('d1e4', 'lateral', reps3()),
        ref('d1e5', 'frenchpress', reps3()),
      ],
    },
    {
      id: 'day2',
      name: 'Día 2: Tren Inferior',
      exercises: [
        ref('d2e1', 'squat', reps3()),
        ref('d2e2', 'bulgarian', reps3()),
        ref('d2e3', 'legpress', reps3()),
        ref('d2e4', 'legext', reps3()),
        ref('d2e5', 'calf', reps3()),
      ],
    },
    { id: 'day3', name: 'Día 3: Descanso o Cardio', exercises: [] },
    {
      id: 'day4',
      name: 'Día 4: Tren Superior (Tirón)',
      exercises: [
        ref('d4e1', 'deadlift', reps3()),
        ref('d4e2', 'row', reps3()),
        ref('d4e3', 'pulldown', reps3()),
        ref('d4e4', 'upright', reps3()),
        ref('d4e5', 'curl', reps3()),
      ],
    },
    {
      id: 'day5',
      name: 'Día 5: Tren Inferior y Abdominales',
      exercises: [
        ref('d5e1', 'squat', reps3()),
        ref('d5e2', 'hamcurl', reps3()),
        ref('d5e3', 'glute', reps3()),
        ref('d5e4', 'plank', time3('30-60 seg')),
      ],
    },
    { id: 'day6', name: 'Día 6: Descanso', exercises: [] },
    { id: 'day7', name: 'Día 7: Descanso', exercises: [] },
  ],
  catalog: CATALOG,
  sessions: {},
};
