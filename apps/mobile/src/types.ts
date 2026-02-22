export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export interface Profile {
  id: number;
  sex: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  weightKg: number;
  goal: string;
  activityLevel: ActivityLevel;
  dietaryPreferences: string;
  allergies: string;
  sleepSchedule: string;
  createdAt: number;
  updatedAt: number;
}

export interface Vitals {
  id: string;
  dateTime: number;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  weightKg?: number;
  sleepHours?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  isCustom: number;
  createdAt: number;
  updatedAt: number;
}

export interface MealEntry {
  id: string;
  dateTime: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodItemId: string;
  quantityGram: number;
  caloriesOverride?: number;
  proteinOverride?: number;
  carbsOverride?: number;
  fatOverride?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutEntry {
  id: string;
  dateTime: number;
  category: 'aerobic' | 'strength';
  type: string;
  durationMin: number;
  intensity: 'low' | 'medium' | 'high';
  sets?: number;
  reps?: number;
  weight?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
