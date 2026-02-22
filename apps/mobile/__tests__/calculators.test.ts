import { aggregateMeals, calculateBMR, calculateTDEE } from '../src/services/calculators';

test('calculate BMR/TDEE', () => {
  const profile: any = { sex: 'male', age: 30, heightCm: 175, weightKg: 70, activityLevel: 'moderate' };
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(profile);
  expect(bmr.bmr).toBeGreaterThan(1600);
  expect(tdee.tdee).toBeGreaterThan(bmr.bmr);
});

test('aggregate meal', () => {
  const foods: any[] = [{ id: 'a', caloriesPer100g: 200, proteinPer100g: 10, carbsPer100g: 20, fatPer100g: 5 }];
  const meals: any[] = [{ foodItemId: 'a', quantityGram: 150 }];
  const m = aggregateMeals(meals, foods as any);
  expect(m.calories).toBeCloseTo(300);
  expect(m.protein).toBeCloseTo(15);
});
