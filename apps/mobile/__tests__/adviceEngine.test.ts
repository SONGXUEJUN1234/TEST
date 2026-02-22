import { evaluate } from '../src/services/adviceEngine';

test('advice includes protein when low', () => {
  const profile: any = { sex: 'male', age: 30, heightCm: 175, weightKg: 70, activityLevel: 'moderate' };
  const days: any[] = [{ meals: [], workouts: [], vitals: [{ sleepHours: 5 }], foods: [] }];
  const r = evaluate(profile, days);
  expect(r.advice.some((a) => a.title.includes('蛋白'))).toBeTruthy();
  expect(r.advice.some((a) => a.title.includes('睡眠不足'))).toBeTruthy();
});
