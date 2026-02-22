import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { db } from '../db';
import { upsertProfile } from '../repositories/repo';
import { useAppRefresh } from '../state/AppContext';

export default function OnboardingScreen() {
  const { refresh } = useAppRefresh();
  const [form, setForm] = useState<any>({ sex: 'male', age: '30', heightCm: '170', weightKg: '65', goal: 'maintain', activityLevel: 'moderate', dietaryPreferences: '[]', allergies: '[]', sleepSchedule: '{"bed":"23:00"}' });
  useEffect(() => {
    const p = db.getFirstSync<any>('SELECT * FROM Profile WHERE id=1');
    if (p?.sex) setForm({ ...form, ...Object.fromEntries(Object.entries(p).map(([k,v]) => [k, String(v ?? '')])) });
  }, []);
  return <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
    <Text>新手引导与个人档案</Text>
    {['sex','age','heightCm','weightKg','goal','activityLevel','dietaryPreferences','allergies','sleepSchedule'].map((k)=><TextInput key={k} value={form[k]} onChangeText={(t)=>setForm({...form,[k]:t})} placeholder={k} style={{borderWidth:1,padding:6}} />)}
    <Button title='保存档案' onPress={()=>{upsertProfile({ ...form, age:+form.age, heightCm:+form.heightCm, weightKg:+form.weightKg }); refresh();}} />
    <Text>免责声明：本应用仅提供健康生活方式建议，不构成医疗诊断或治疗建议。</Text>
  </ScrollView>;
}
