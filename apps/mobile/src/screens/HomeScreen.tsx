import React from 'react';
import { ScrollView, Text, Button } from 'react-native';

export default function HomeScreen({ navigation }: any) {
  return <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
    <Text>HealthLog Dashboard（纯离线）</Text>
    <Text>关键卡片：快速记录体征、饮食、运动，并查看今日总结/明日建议/一周计划。</Text>
    <Button title='快捷添加体征' onPress={() => navigation.navigate('Vitals')} />
    <Button title='快捷添加饮食' onPress={() => navigation.navigate('Meal')} />
    <Button title='快捷添加运动' onPress={() => navigation.navigate('Workout')} />
    <Button title='今日总结' onPress={() => navigation.navigate('Summary')} />
    <Button title='明日建议' onPress={() => navigation.navigate('Advice')} />
    <Button title='一周计划' onPress={() => navigation.navigate('Plan')} />
  </ScrollView>;
}
