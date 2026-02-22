import React, { useState } from 'react';
import { ScrollView, Text, Button } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { evaluate } from '../services/adviceEngine';

export default function PlanScreen() {
  const [msg, setMsg] = useState('');
  const profile = db.getFirstSync<any>('SELECT * FROM Profile WHERE id=1') || { sex:'male', age:30, heightCm:170, weightKg:65, activityLevel:'moderate' };
  const foods = db.getAllSync<any>('SELECT * FROM FoodItem');
  const buildPlan = () => {
    const result = evaluate(profile as any, [{ meals: [], workouts: [], vitals: [], foods }] as any);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const planJson = JSON.stringify(result.planItems);
    db.runSync('INSERT INTO Plan(id, weekStartDate, planJson, createdAt, updatedAt) VALUES(?,?,?,?,?)', [uuidv4(), weekStart.toISOString().slice(0,10), planJson, Date.now(), Date.now()]);
    setMsg('已生成本周计划，可逐日勾选完成。');
  };
  const checkin = () => {
    const date = new Date().toISOString().slice(0,10);
    db.runSync('INSERT INTO PlanCheckin(id, date, itemsJson, completionScore, createdAt, updatedAt) VALUES(?,?,?,?,?,?)', [uuidv4(), date, JSON.stringify([{ key:'diet_protein', done:true }]), 0.5, Date.now(), Date.now()]);
    setMsg('今日完成度已记录。');
  };
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>一周计划页</Text>
    <Button title='自动生成计划' onPress={buildPlan} />
    <Button title='勾选今日完成(示例)' onPress={checkin} />
    <Text>{msg}</Text>
  </ScrollView>;
}
