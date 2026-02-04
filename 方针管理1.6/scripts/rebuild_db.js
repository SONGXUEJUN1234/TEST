/**
 * 重建数据库并同步数据
 */
const db = require('../database/db');
const excelSyncService = require('../services/excelSyncService');
const path = require('path');

async function rebuildDatabase() {
    console.log('========================================');
    console.log('重建数据库');
    console.log('========================================\n');

    // 清空现有KPI数据
    console.log('清空现有KPI数据...');
    db.db.prepare('DELETE FROM kpi_data').run();
    console.log('✓ KPI数据已清空\n');

    // 清空同步日志
    console.log('清空同步日志...');
    db.db.prepare('DELETE FROM file_sync_log').run();
    console.log('✓ 同步日志已清空\n');

    // 同步所有文件
    const watchPath = require('path').join(__dirname, '..', 'mock_data');
    console.log(`同步目录: ${watchPath}`);
    console.log('========================================\n');

    const syncResults = [];
    const filePaths = [];

    // 收集所有文件路径
    excelSyncService.walkDirectory(watchPath, (filePath) => {
        if (filePath.endsWith('.xlsx') && !filePath.includes('~$')) {
            filePaths.push(filePath);
        }
    });

    // 逐个处理文件
    for (const filePath of filePaths) {
        try {
            const kpiData = await excelSyncService.parseExcelFile(filePath);
            if (kpiData && kpiData.length > 0) {
                excelSyncService.syncToDatabase(kpiData, filePath);
                syncResults.push({ file: path.basename(filePath), count: kpiData.length, status: 'success' });
                console.log(`✓ ${path.basename(filePath)}: ${kpiData.length}条`);
            }
        } catch (error) {
            syncResults.push({ file: path.basename(filePath), count: 0, status: 'error', error: error.message });
            console.error(`✗ ${path.basename(filePath)}: ${error.message}`);
        }
    }

    console.log('\n========================================');
    console.log('同步完成');
    console.log('========================================');

    const success = syncResults.filter(r => r.status === 'success');
    const errors = syncResults.filter(r => r.status === 'error');

    console.log(`成功: ${success.length} 个文件`);
    console.log(`失败: ${errors.length} 个文件`);
    console.log(`总记录数: ${success.reduce((sum, r) => sum + r.count, 0)} 条`);

    if (errors.length > 0) {
        console.log('\n错误文件:');
        errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
    }

    // 验证数据
    console.log('\n========================================');
    console.log('验证数据库');
    console.log('========================================\n');

    const recordCount = db.db.prepare('SELECT COUNT(*) as count FROM kpi_data').get();
    console.log(`数据库记录总数: ${recordCount.count}`);

    const dateCount = db.db.prepare('SELECT COUNT(DISTINCT date) as count FROM kpi_data').get();
    console.log(`不同日期数: ${dateCount.count}`);

    const userCount = db.db.prepare('SELECT COUNT(DISTINCT user_name) as count FROM kpi_data').get();
    console.log(`不同用户数: ${userCount.count}`);

    const dates = db.db.prepare('SELECT DISTINCT date FROM kpi_data ORDER BY date').all();
    console.log(`\n日期列表: ${dates.map(d => d.date).join(', ')}`);

    console.log('\n========================================');
    console.log('数据库重建完成！');
    console.log('========================================');
}

rebuildDatabase();
