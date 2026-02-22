import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { db } from '../db';
import { SCHEMA_VERSION } from '../db/schema';

const TABLES = ['Profile', 'Vitals', 'FoodItem', 'MealEntry', 'WorkoutEntry', 'Plan', 'PlanCheckin'] as const;

const te = new TextEncoder();
const td = new TextDecoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120000 }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const exportBackup = async (password: string) => {
  const payload: Record<string, unknown> = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now()
  };
  TABLES.forEach((t) => {
    payload[t] = db.getAllSync(`SELECT * FROM ${t}`);
  });
  const data = te.encode(JSON.stringify(payload));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const packed = JSON.stringify({ salt: toB64(salt), iv: toB64(iv), cipher: toB64(encrypted) });
  const path = `${FileSystem.cacheDirectory}healthlog-${Date.now()}.healthlog`;
  await FileSystem.writeAsStringAsync(path, packed);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path);
  }
};

export const importBackup = async (password: string) => {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (picked.canceled) return;
  const content = await FileSystem.readAsStringAsync(picked.assets[0].uri);
  const packed = JSON.parse(content);
  const key = await deriveKey(password, fromB64(packed.salt));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(packed.iv) }, key, fromB64(packed.cipher));
  const data = JSON.parse(td.decode(new Uint8Array(decrypted)));
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error('schemaVersion 不兼容');

  db.withTransactionSync(() => {
    TABLES.forEach((t) => db.execSync(`DELETE FROM ${t}`));
    TABLES.forEach((t) => {
      (data[t] ?? []).forEach((row: Record<string, unknown>) => {
        const keys = Object.keys(row);
        db.runSync(`INSERT INTO ${t}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, keys.map((k) => row[k]));
      });
    });
  });
};
