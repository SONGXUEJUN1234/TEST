import * as SQLite from 'expo-sqlite';
import { CREATE_TABLE_SQL, SCHEMA_VERSION } from './schema';
import { seedFoodItems } from '../seed/foodSeed';

export const db = SQLite.openDatabaseSync('healthlog.db');

export const initDb = () => {
  db.withTransactionSync(() => {
    CREATE_TABLE_SQL.forEach((sql) => db.execSync(sql));
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM Meta WHERE key = ?', ['schemaVersion']);
    if (!row) {
      db.runSync('INSERT INTO Meta(key, value) VALUES(?, ?)', ['schemaVersion', String(SCHEMA_VERSION)]);
      db.runSync('INSERT OR IGNORE INTO Profile(id, createdAt, updatedAt) VALUES(1, ?, ?)', [Date.now(), Date.now()]);
    }
    const foodCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM FoodItem');
    if (!foodCount?.count) {
      seedFoodItems(db);
    }
  });
};

export const resetAllData = () => {
  db.withTransactionSync(() => {
    ['Vitals','MealEntry','WorkoutEntry','Plan','PlanCheckin','FoodItem'].forEach((t) => db.execSync(`DELETE FROM ${t}`));
    seedFoodItems(db);
  });
};
