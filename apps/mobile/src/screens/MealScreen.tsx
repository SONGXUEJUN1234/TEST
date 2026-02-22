import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { db } from '../db';
import { insert, listByDate } from '../repositories/repo';
import { todayRange } from '../utils/date';
import { useAppRefresh } from '../state/AppContext';

export default function MealScreen() {
  const { refreshKey, refresh } = useAppRefresh();
  const [query, setQuery] = useState('');
  const [foodId, setFoodId] = useState('');
  const [foods, setFoods] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [quantityGram, setQuantityGram] = useState('100');
  useEffect(()=>{ setFoods(db.getAllSync('SELECT * FROM FoodItem WHERE name LIKE ? LIMIT 20', [`%${query}%`]) as any[]); const [s,e]=todayRange(); setMeals(listByDate('MealEntry', s,e) as any[]); },[query, refreshKey]);
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>饮食记录 CRUD（含内置食物库/搜索/自定义）</Text>
    <TextInput placeholder='搜索食物' value={query} onChangeText={setQuery} style={{borderWidth:1,padding:6}}/>
    {foods.slice(0,8).map((f)=><Button key={f.id} title={`${f.name} ${f.caloriesPer100g}kcal/100g`} onPress={()=>setFoodId(f.id)}/>)}
    <Text>已选食物: {foodId || '未选择'}</Text>
    <TextInput placeholder='份量克' value={quantityGram} onChangeText={setQuantityGram} style={{borderWidth:1,padding:6}}/>
    <Button title='新增餐次(午餐)' onPress={()=>{ if(!foodId) return; insert('MealEntry',{dateTime:Date.now(), mealType:'lunch', foodItemId:foodId, quantityGram:+quantityGram }); refresh(); }}/>
    <Button title='新增自定义食物(示例)' onPress={()=>{insert('FoodItem',{name:`自定义${Date.now()%1000}`,brand:'',caloriesPer100g:200,proteinPer100g:10,carbsPer100g:20,fatPer100g:8,isCustom:1}); refresh();}}/>
    {meals.map((m)=><Text key={m.id}>meal {m.mealType} {m.quantityGram}g</Text>)}
  </ScrollView>;
}
