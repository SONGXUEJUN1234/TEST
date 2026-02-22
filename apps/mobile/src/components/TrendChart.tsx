import React from 'react';
import { View, Text } from 'react-native';

export const TrendChart = ({ title, points }: { title: string; points: number[] }) => {
  const max = Math.max(...points, 1);
  return (
    <View style={{ padding: 8, borderWidth: 1, marginVertical: 8 }}>
      <Text>{title}（简易趋势图）</Text>
      {points.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ width: 40 }}>D{i + 1}</Text>
          <View style={{ height: 8, width: `${(p / max) * 100}%`, backgroundColor: '#4a90e2' }} />
          <Text> {p.toFixed(0)}</Text>
        </View>
      ))}
    </View>
  );
};
