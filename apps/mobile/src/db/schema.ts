export const SCHEMA_VERSION = 1;

export const CREATE_TABLE_SQL = [
  `CREATE TABLE IF NOT EXISTS Meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS Profile (
    id INTEGER PRIMARY KEY CHECK(id=1),
    sex TEXT, age INT, heightCm REAL, weightKg REAL, goal TEXT, activityLevel TEXT,
    dietaryPreferences TEXT, allergies TEXT, sleepSchedule TEXT,
    createdAt INT, updatedAt INT
  );`,
  `CREATE TABLE IF NOT EXISTS Vitals (
    id TEXT PRIMARY KEY, dateTime INT, systolic INT, diastolic INT, heartRate INT,
    weightKg REAL, sleepHours REAL, notes TEXT, createdAt INT, updatedAt INT
  );`,
  `CREATE TABLE IF NOT EXISTS FoodItem (
    id TEXT PRIMARY KEY, name TEXT, brand TEXT,
    caloriesPer100g REAL, proteinPer100g REAL, carbsPer100g REAL, fatPer100g REAL,
    isCustom INT, createdAt INT, updatedAt INT
  );`,
  `CREATE TABLE IF NOT EXISTS MealEntry (
    id TEXT PRIMARY KEY, dateTime INT, mealType TEXT,
    foodItemId TEXT, quantityGram REAL,
    caloriesOverride REAL, proteinOverride REAL, carbsOverride REAL, fatOverride REAL,
    notes TEXT, createdAt INT, updatedAt INT
  );`,
  `CREATE TABLE IF NOT EXISTS WorkoutEntry (
    id TEXT PRIMARY KEY, dateTime INT, category TEXT,
    type TEXT, durationMin REAL, intensity TEXT,
    sets INT, reps INT, weight REAL,
    notes TEXT, createdAt INT, updatedAt INT
  );`,
  `CREATE TABLE IF NOT EXISTS Plan (
    id TEXT PRIMARY KEY, weekStartDate TEXT,
    planJson TEXT, createdAt INT, updatedAt INT
  );`,
  `CREATE TABLE IF NOT EXISTS PlanCheckin (
    id TEXT PRIMARY KEY, date TEXT,
    itemsJson TEXT, completionScore REAL, createdAt INT, updatedAt INT
  );`
];
