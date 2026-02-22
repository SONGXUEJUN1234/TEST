import React, { useMemo } from 'react';
import { ScrollView, Text } from 'react-native';
import { db } from '../db';
import { aggregateMeals, calculateBMR, calculateTDEE, estimateWorkoutCalories } from '../services/calculators';
import { todayRange } from '../utils/date';
import { TrendChart } from '../components/TrendChart';

export default function SummaryScreen() {
  const profile = db.getFirstSync<any>('SELECT * FROM Profile WHERE id=1') || { sex:'male', age:30, heightCm:170, weightKg:65, activityLevel:'moderate' };
  const [s,e]=todayRange();
  const meals = db.getAllSync<any>('SELECT * FROM MealEntry WHERE dateTime BETWEEN ? AND ?', [s,e]);
  const foods = db.getAllSync<any>('SELECT * FROM FoodItem');
  const workouts = db.getAllSync<any>('SELECT * FROM WorkoutEntry WHERE dateTime BETWEEN ? AND ?', [s,e]);
  const bmr = calculateBMR(profile as any);
  const tdee = calculateTDEE(profile as any);
  const intake = aggregateMeals(meals as any, foods as any);
  const burn = estimateWorkoutCalories(workouts as any, profile.weightKg || 65);
  const trend = useMemo(()=> Array.from({length:7}).map((_,i)=>{
    const ds = s - (6-i)*86400000; const de = ds + 86400000 -1;
    const dayMeals = db.getAllSync<any>('SELECT * FROM MealEntry WHERE dateTime BETWEEN ? AND ?', [ds,de]);
    return aggregateMeals(dayMeals as any, foods as any).calories;
  }),[]);
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>今日摄入 {intake.calories.toFixed(0)} kcal，运动消耗 {burn.calories.toFixed(0)} kcal，净热量 {(intake.calories-burn.calories).toFixed(0)} kcal</Text>
    <Text>宏量营养分布：蛋白{intake.protein.toFixed(1)}g 碳水{intake.carbs.toFixed(1)}g 脂肪{intake.fat.toFixed(1)}g</Text>
    <TrendChart title='7天摄入热量趋势' points={trend} />
    <Text>输入项：体重{profile.weightKg}kg, 身高{profile.heightCm}cm, 年龄{profile.age}, 性别{profile.sex}, 活动水平{profile.activityLevel}</Text>
    <Text>计算依据/公式来源名称：{bmr.formula}; {tdee.formula}; {intake.formula}; {burn.formula} + {burn.metSource}</Text>
  </ScrollView>;
}
