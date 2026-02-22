import React, { useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { exportBackup, importBackup } from '../services/backup';
import { resetAllData } from '../db';

export default function SettingsScreen() {
  const [password, setPassword] = useState('123456');
  return <ScrollView contentContainerStyle={{padding:12,gap:8}}>
    <Text>设置页（纯离线）</Text>
    <TextInput placeholder='备份密码' value={password} onChangeText={setPassword} style={{borderWidth:1,padding:6}}/>
    <Button title='导出 .healthlog (AES-GCM)' onPress={() => exportBackup(password)} />
    <Button title='导入 .healthlog 覆盖恢复' onPress={() => importBackup(password)} />
    <Button title='清空数据' onPress={() => resetAllData()} />
    <Text>隐私说明：不上传任何数据，不调用网络API，所有数据仅保存在本机。</Text>
    <Text>免责声明：血压相关仅做健康生活方式提示，不替代医生诊疗。</Text>
  </ScrollView>;
}
