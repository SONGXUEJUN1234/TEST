/**
 * 手动触发Excel数据同步
 *
 * 用途：清理错误数据后，重新同步所有Excel文件到数据库
 */

const path = require('path');
const excelSyncService = require('../services/excelSyncService');
const db = require('../database/db');

async function syncAllData() {
    console.log('========================================');
    console.log('  开始同步Excel数据到数据库');
    console.log('========================================\n');

    // 初始化数据库
    db.initDatabase();

    // 获取同步前的数据量
    const beforeCount = db.kpiQueries.getAll.all().length;
    console.log(`同步前数据库中有 ${beforeCount} 条KPI记录\n`);

    // 执行同步
    const mockDataPath = path.join(__dirname, '..', 'mock_data');
    console.log(`正在扫描目录: ${mockDataPath}\n`);

    excelSyncService.init(mockDataPath);

    // 等待一段时间让同步完成
    console.log('\n等待同步完成...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 获取同步后的数据量
    const afterCount = db.kpiQueries.getAll.all().length;
    console.log(`\n同步后数据库中有 ${afterCount} 条KPI记录`);
    console.log(`新增/更新了 ${afterCount - beforeCount} 条记录`);

    // 显示一些统计信息
    const departments = db.kpiQueries.getAllDepartments.all();
    const users = db.db.prepare('SELECT DISTINCT user_name FROM kpi_data').all();
    const dates = db.kpiQueries.getAllDates.all();

    console.log('\n========================================');
    console.log('  同步完成！统计信息:');
    console.log('========================================');
    console.log(`部门数量: ${departments.length}`);
    console.log(`人员数量: ${users.length}`);
    console.log(`日期范围: ${dates[0]?.date} ~ ${dates[dates.length - 1]?.date}`);
    console.log('========================================\n');

    process.exit(0);
}

syncAllData().catch(error => {
    console.error('同步失败:', error);
    process.exit(1);
});
