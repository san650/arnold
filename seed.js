// Initial routine, used when the IndexedDB blob is empty.
// Exercise names in Spanish (verified against ES gym sources). The English
// name and any clarifying note live in `notes`.
//
// Exercise model: each exercise carries a `series` array (one entry per set).
// `reps` exercises: { weight: number|null, reps: number|null } per set, with a
// shared `unit`. `time` exercises: { duration: string } per set.

// Three identical reps sets, no weight set yet, target 10 reps.
const reps3 = () => [
  { weight: null, reps: 10 },
  { weight: null, reps: 10 },
  { weight: null, reps: 10 },
];

export const SEED = {
  routines: [
    {
      id: 'day1',
      name: 'Día 1: Tren Superior (Empuje)',
      exercises: [
        { id: 'd1e1', name: 'Press de banca con barra', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Barbell Bench Press · pecho plano' },
        { id: 'd1e2', name: 'Press militar con barra', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/waeCyaAQRn8', notes: 'Barbell Military Press' },
        { id: 'd1e3', name: 'Press inclinado con mancuernas', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/bR_dKXdtfrQ', notes: 'Dumbbell Incline Press' },
        { id: 'd1e4', name: 'Elevaciones laterales con mancuernas', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/XPPfnSEATJA', notes: 'Dumbbell Lateral Raises' },
        { id: 'd1e5', name: 'Press francés con mancuerna', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/BW15DLXmvUY', notes: 'Dumbbell Tricep Extensions' },
      ],
    },
    {
      id: 'day2',
      name: 'Día 2: Tren Inferior',
      exercises: [
        { id: 'd2e1', name: 'Sentadilla con barra', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/S9iWwaqbD3Q', notes: 'Barbell Squats' },
        { id: 'd2e2', name: 'Sentadilla búlgara', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/9p5e2BSvoLs', notes: 'Bulgarian Split Squats · por pierna' },
        { id: 'd2e3', name: 'Prensa de piernas', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtu.be/px3fnV8dCl0', notes: 'Leg Press' },
        { id: 'd2e4', name: 'Extensión de cuádriceps', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtube.com/shorts/iQ92TuvBqRo', notes: 'Leg Extensions' },
        { id: 'd2e5', name: 'Elevación de talones de pie', kind: 'reps', unit: 'kg', series: reps3(), video: 'https://youtube.com/shorts/lyDp3tbx3qU', notes: 'Standing Calf Raises' },
      ],
    },
    {
      id: 'day3',
      name: 'Día 3: Descanso o Cardio',
      exercises: [],
    },
    {
      id: 'day4',
      name: 'Día 4: Tren Superior (Tirón)',
      exercises: [
        { id: 'd4e1', name: 'Peso muerto con barra', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Barbell Deadlifts' },
        { id: 'd4e2', name: 'Remo con barra inclinado', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Barbell Bent Over Rows' },
        { id: 'd4e3', name: 'Jalón al pecho en polea', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Lat Pulldowns' },
        { id: 'd4e4', name: 'Remo al mentón con mancuernas', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Dumbbell Upright Rows' },
        { id: 'd4e5', name: 'Curl de bíceps alterno con mancuernas', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Dumbbell Single Arm Bicep Curls' },
      ],
    },
    {
      id: 'day5',
      name: 'Día 5: Tren Inferior y Abdominales',
      exercises: [
        { id: 'd5e1', name: 'Sentadilla con barra', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Squats · variaciones o distinto rango de reps' },
        { id: 'd5e2', name: 'Curl femoral tumbado', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Hamstring Curls' },
        { id: 'd5e3', name: 'Puente de glúteos', kind: 'reps', unit: 'kg', series: reps3(), video: null, notes: 'Glute Bridges' },
        { id: 'd5e4', name: 'Plancha abdominal', kind: 'time', series: [{ duration: '30-60 seg' }, { duration: '30-60 seg' }, { duration: '30-60 seg' }], video: null, notes: 'Plank' },
      ],
    },
    {
      id: 'day6',
      name: 'Día 6: Descanso',
      exercises: [],
    },
    {
      id: 'day7',
      name: 'Día 7: Descanso',
      exercises: [],
    },
  ],
  catalog: [],
  sessions: {},
};
