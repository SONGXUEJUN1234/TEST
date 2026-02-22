import { ActivityLevel, MealEntry, Profile, WorkoutEntry, FoodItem } from '../types';

const activityFactor: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

const metTable: Record<string, Record<string, number>> = {
  walk: { low: 2.8, medium: 3.5, high: 4.3 },
  run: { low: 6, medium: 8, high: 10 },
  cycling: { low: 4, medium: 6.8, high: 8.5 },
  strength: { low: 3, medium: 4, high: 6 }
};

export const calculateBMR = (profile: Profile) => {
  const sexAdj = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexAdj;
  return { bmr, formula: 'Mifflin-St Jeor', inputs: { weightKg: profile.weightKg, heightCm: profile.heightCm, age: profile.age, sex: profile.sex } };
};

export const calculateTDEE = (profile: Profile) => {
  const bmr = calculateBMR(profile);
  const factor = activityFactor[profile.activityLevel] ?? 1.2;
  return { tdee: bmr.bmr * factor, factor, formula: 'TDEE = BMR * activityFactor' };
};

export const aggregateMeals = (meals: MealEntry[], foods: FoodItem[]) => {
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  return meals.reduce((acc, meal) => {
    const food = foodMap.get(meal.foodItemId);
    if (!food) return acc;
    const ratio = meal.quantityGram / 100;
    acc.calories += meal.caloriesOverride ?? food.caloriesPer100g * ratio;
    acc.protein += meal.proteinOverride ?? food.proteinPer100g * ratio;
    acc.carbs += meal.carbsOverride ?? food.carbsPer100g * ratio;
    acc.fat += meal.fatOverride ?? food.fatPer100g * ratio;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, formula: 'sum(quantityGram * nutritionPer100g / 100), override优先' });
};

export const estimateWorkoutCalories = (workouts: WorkoutEntry[], weightKg: number) => {
  const total = workouts.reduce((sum, w) => {
    const m = metTable[w.type]?.[w.intensity] ?? metTable[w.category === 'strength' ? 'strength' : 'walk'][w.intensity];
    return sum + ((m * 3.5 * weightKg) / 200) * w.durationMin;
  }, 0);
  return { calories: total, formula: 'kcal = MET * 3.5 * weightKg / 200 * minutes', metSource: '简化MET表(内置)' };
};
