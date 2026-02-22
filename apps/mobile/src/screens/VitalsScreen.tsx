import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { insert, listByDate } from '../repositories/repo';
import { todayRange } from '../utils/date';
import { useAppRefresh } from '../state/AppContext';

export default function VitalsScreen() {
  const { refreshKey, refresh } = useAppRefresh();
  const [form, setForm] = useState<any>({ systolic:'', diastolic:'', heartRate:'', weightKg:'', sleepHours:'', notes:'' });
  const [items, setItems] = useState<any[]>([]);
  useEffect(()=>{ const [s,e]=todayRange(); setItems(listByDate('Vitals', s,e) as any[]); },[refreshKey]);
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>体征记录 CRUD</Text>
    {['systolic','diastolic','heartRate','weightKg','sleepHours','notes'].map((k)=><TextInput key={k} value={form[k]} placeholder={k} onChangeText={(t)=>setForm({...form,[k]:t})} style={{borderWidth:1,padding:6}}/>)}
    <Button title='新增体征' onPress={()=>{insert('Vitals',{dateTime:Date.now(), ...form, systolic:+form.systolic||null, diastolic:+form.diastolic||null, heartRate:+form.heartRate||null, weightKg:+form.weightKg||null, sleepHours:+form.sleepHours||null }); refresh();}}/>
    {items.map((x)=><Text key={x.id}>{new Date(x.dateTime).toLocaleTimeString()} BP {x.systolic}/{x.diastolic} 睡眠{x.sleepHours}</Text>)}
  </ScrollView>;
}
