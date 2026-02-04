/**
 * 数据库迁移脚本：添加 kpi_nature 字段到 kpi_hierarchy 表
 * 运行方式：node scripts/migrate_add_kpi_nature.js
 */

const db = require('../database/db');

console.log('开始数据库迁移：添加 kpi_nature 字段...');

try {
    // 检查 kpi_nature 字段是否已存在
    const pragma = db.db.pragma('table_info(kpi_hierarchy)');
    const hasColumn = pragma.some(col => col.name === 'kpi_nature');

    if (hasColumn) {
        console.log('kpi_nature 字段已存在，跳过迁移');
    } else {
        // 添加 kpi_nature 字段
        db.db.exec('ALTER TABLE kpi_hierarchy ADD COLUMN kpi_nature TEXT');
        console.log('已添加 kpi_nature 字段到 kpi_hierarchy 表');
    }

    // 重新同步层级关系表（包含 KPI 性质数据）
    console.log('开始同步层级关系表...');
    const hierarchySyncService = require('../services/hierarchySyncService');
    hierarchySyncService.init(); // 初始化并同步

    console.log('数据库迁移完成！');
    process.exit(0);
} catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
}
