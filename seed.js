// Initial routine, used when the IndexedDB blob is empty.
// Exercise names kept in English (lifter conventions) with optional
// Spanish clarifications in `notes`.

export const SEED = {
  routines: [
    {
      id: 'day1',
      name: 'Día 1: Tren Superior (Empuje)',
      exercises: [
        { id: 'd1e1', name: 'Barbell Bench Press', sets: 3, reps: '8-12', weight: null, video: null, notes: 'pecho plano' },
        { id: 'd1e2', name: 'Barbell Military Press', sets: 3, reps: '8-12', weight: null, video: 'https://youtu.be/waeCyaAQRn8', notes: '' },
        { id: 'd1e3', name: 'Dumbbell Incline Press', sets: 3, reps: '8-12', weight: null, video: 'https://youtu.be/bR_dKXdtfrQ', notes: '' },
        { id: 'd1e4', name: 'Dumbbell Lateral Raises', sets: 3, reps: '8-12', weight: null, video: 'https://youtu.be/XPPfnSEATJA', notes: '' },
        { id: 'd1e5', name: 'Dumbbell Tricep Extensions', sets: 3, reps: '8-12', weight: null, video: 'https://youtube.com/shorts/8FNGBJUHfsA', notes: '' },
      ],
    },
    {
      id: 'day2',
      name: 'Día 2: Tren Inferior',
      exercises: [
        { id: 'd2e1', name: 'Barbell Squats', sets: 3, reps: '8-12', weight: null, video: 'https://youtube.com/shorts/S9iWwaqbD3Q', notes: '' },
        { id: 'd2e2', name: 'Bulgarian Split Squats', sets: 3, reps: '8-12 por pierna', weight: null, video: 'https://youtube.com/shorts/9p5e2BSvoLs', notes: '' },
        { id: 'd2e3', name: 'Leg Press', sets: 3, reps: '8-12', weight: null, video: 'https://youtube.com/shorts/px3fnV8dCl0', notes: '' },
        { id: 'd2e4', name: 'Leg Extensions', sets: 3, reps: '8-12', weight: null, video: 'https://youtube.com/shorts/iQ92TuvBqRo', notes: '' },
        { id: 'd2e5', name: 'Standing Calf Raises', sets: 3, reps: '8-12', weight: null, video: 'https://youtube.com/shorts/lyDp3tbx3qU', notes: '' },
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
        { id: 'd4e1', name: 'Barbell Deadlifts', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
        { id: 'd4e2', name: 'Barbell Bent Over Rows', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
        { id: 'd4e3', name: 'Lat Pulldowns', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
        { id: 'd4e4', name: 'Dumbbell Upright Rows', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
        { id: 'd4e5', name: 'Dumbbell Single Arm Bicep Curls', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
      ],
    },
    {
      id: 'day5',
      name: 'Día 5: Tren Inferior y Abdominales',
      exercises: [
        { id: 'd5e1', name: 'Squats', sets: 3, reps: '8-12', weight: null, video: null, notes: 'variaciones o distinto rango de reps' },
        { id: 'd5e2', name: 'Hamstring Curls', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
        { id: 'd5e3', name: 'Glute Bridges', sets: 3, reps: '8-12', weight: null, video: null, notes: '' },
        { id: 'd5e4', name: 'Plank', sets: 3, reps: '30-60 seg', weight: null, video: null, notes: '' },
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
  sessions: {},
};
