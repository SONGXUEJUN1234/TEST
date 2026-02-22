import React from 'react';
import { ScrollView, Text } from 'react-native';
import { db } from '../db';
import { evaluate } from '../services/adviceEngine';

export default function AdviceScreen() {
  const profile = db.getFirstSync<any>('SELECT * FROM Profile WHERE id=1') || { sex:'male', age:30, heightCm:170, weightKg:65, activityLevel:'moderate' };
  const foods = db.getAllSync<any>('SELECT * FROM FoodItem');
  const dayBlocks = Array.from({ length: 3 }).map((_, i) => {
    const start = Date.now() - (2 - i) * 86400000;
    const ds = new Date(start); ds.setHours(0,0,0,0);
    const s = ds.getTime(); const e = s + 86400000 - 1;
    return {
      meals: db.getAllSync<any>('SELECT * FROM MealEntry WHERE dateTime BETWEEN ? AND ?', [s, e]),
      workouts: db.getAllSync<any>('SELECT * FROM WorkoutEntry WHERE dateTime BETWEEN ? AND ?', [s, e]),
      vitals: db.getAllSync<any>('SELECT * FROM Vitals WHERE dateTime BETWEEN ? AND ?', [s, e]),
      foods
    };
  });
  const result = evaluate(profile as any, dayBlocks as any);
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>明日建议（可解释规则引擎）</Text>
    <Text>计算依据：{result.explain}</Text>
    {result.advice.map((a,idx)=><Text key={idx}>[{a.cautionLevel}] {a.title}\n为什么: {a.reason}\n怎么做: {a.actionSteps.join('；')}</Text>)}
  </ScrollView>;
}
