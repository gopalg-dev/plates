// Imported first by simulate.ts: the app's db module reads these when it first connects, so every
// repo call lands in the simulator's own database and never in the dev one.
process.env.MONGODB_URI = 'mongodb://localhost:27017'
process.env.MONGODB_DB = 'workout_plan_v3_sim'
