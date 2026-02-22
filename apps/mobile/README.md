# HealthLog (Expo + TypeScript, 纯离线)

## 启动
```bash
cd apps/mobile
npm install
npm run start
```
使用 Expo Go 扫码运行（iOS/Android）。

## 纯离线说明
- 无账号、无后端、无网络 API 调用。
- 数据仅存 SQLite 本地库（expo-sqlite）。
- 备份导出为 `.healthlog` 单文件，AES-GCM 密码加密。

## MVP 演示路径
1. Onboarding 填写个人档案。
2. 录入体征、饮食、运动。
3. 查看 Summary（输入项 + 公式来源）。
4. 查看 Advice（为什么 + 怎么做）。
5. 生成 Plan 并 Checkin。
6. 在 Settings 执行导出/导入。

## 免责声明
本 App 仅做健康生活方式管理，不提供医疗诊断，不替代医生建议。血压相关提示仅供参考。

## 常见问题
- 若导入失败：检查密码与 schemaVersion 是否兼容。
- 若 Expo Go 无法分享文件：可先在模拟器中验证导出文件生成。
