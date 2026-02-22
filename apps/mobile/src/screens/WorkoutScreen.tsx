import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { insert, listByDate } from '../repositories/repo';
import { todayRange } from '../utils/date';
import { useAppRefresh } from '../state/AppContext';

export default function WorkoutScreen() {
  const { refreshKey, refresh } = useAppRefresh();
  const [form, setForm] = useState<any>({ category:'aerobic', type:'walk', durationMin:'30', intensity:'medium', sets:'', reps:'', weight:'', notes:'' });
  const [items, setItems] = useState<any[]>([]);
  useEffect(()=>{ const [s,e]=todayRange(); setItems(listByDate('WorkoutEntry', s,e) as any[]); },[refreshKey]);
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>运动记录 CRUD</Text>
    {['category','type','durationMin','intensity','sets','reps','weight','notes'].map((k)=><TextInput key={k} value={form[k]} onChangeText={(t)=>setForm({...form,[k]:t})} style={{borderWidth:1,padding:6}}/>)}
    <Button title='新增运动' onPress={()=>{insert('WorkoutEntry',{dateTime:Date.now(), ...form, durationMin:+form.durationMin, sets:+form.sets||null,reps:+form.reps||null,weight:+form.weight||null}); refresh();}}/>
    {items.map((x)=><Text key={x.id}>{x.type} {x.durationMin}min {x.intensity}</Text>)}
  </ScrollView>;
}
