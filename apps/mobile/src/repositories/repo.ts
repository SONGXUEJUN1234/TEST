import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';

export const upsertProfile = (payload: Record<string, unknown>) => {
  const now = Date.now();
  db.runSync(
    `INSERT INTO Profile(id, sex, age, heightCm, weightKg, goal, activityLevel, dietaryPreferences, allergies, sleepSchedule, createdAt, updatedAt)
     VALUES(1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET sex=excluded.sex, age=excluded.age, heightCm=excluded.heightCm, weightKg=excluded.weightKg,
     goal=excluded.goal, activityLevel=excluded.activityLevel, dietaryPreferences=excluded.dietaryPreferences,
     allergies=excluded.allergies, sleepSchedule=excluded.sleepSchedule, updatedAt=excluded.updatedAt`,
    [payload.sex, payload.age, payload.heightCm, payload.weightKg, payload.goal, payload.activityLevel, payload.dietaryPreferences, payload.allergies, payload.sleepSchedule, now, now]
  );
};

export const insert = (table: string, data: Record<string, unknown>) => {
  const now = Date.now();
  const row = { id: uuidv4(), ...data, createdAt: now, updatedAt: now };
  const keys = Object.keys(row);
  db.runSync(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, keys.map((k) => row[k]));
};

export const listByDate = (table: string, dayStart: number, dayEnd: number) => db.getAllSync(`SELECT * FROM ${table} WHERE dateTime BETWEEN ? AND ? ORDER BY dateTime DESC`, [dayStart, dayEnd]);

export const removeById = (table: string, id: string) => db.runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
