/**
 * 清理数据库中错误的用户数据
 *
 * 问题：项目初始化时，由于使用"1-5机"、"1-4机"等命名，
 * 导致数据库中存储了错误的用户名，如"1号机工艺员"等。
 *
 * 此脚本将：
 * 1. 检测并删除包含这些错误用户名的记录
 * 2. 重新触发Excel文件同步
 */

const db = require('../database/db');
const excelSyncService = require('../services/excelSyncService');

// 需要清理的错误用户名模式
const INVALID_USER_PATTERNS = [
    '1号机工艺员',
    '2号机工艺员',
    '3号机工艺员',
    '4号机工艺员',
    '5号机工艺员',
    '1机',
    '2机',
    '3机',
    '4机',
    '5机',
    '1-5机',
    '1-4机',
    '号机',
    '机工艺员',
    // 可以添加更多模式
];

/**
 * 检查用户名是否匹配错误模式
 */
function isInvalidUserName(userName) {
    if (!userName) return false;
    const name = String(userName).trim();
    return INVALID_USER_PATTERNS.some(pattern => name.includes(pattern));
}

/**
 * 清理数据库中的错误用户数据
 */
function cleanupInvalidUsers() {
    console.log('开始清理数据库中的错误用户数据...\n');

    // 初始化数据库连接
    db.initDatabase();

    // 获取所有KPI数据
    const allKpiData = db.kpiQueries.getAll.all();
    console.log(`数据库中共有 ${allKpiData.length} 条KPI记录`);

    // 找出包含错误用户名的记录
    const invalidRecords = allKpiData.filter(record => isInvalidUserName(record.user_name));

    if (invalidRecords.length === 0) {
        console.log('未发现包含错误用户名的记录');
        return;
    }

    console.log(`\n发现 ${invalidRecords.length} 条包含错误用户名的记录:`);

    // 按用户名分组显示
    const invalidUserGroups = {};
    invalidRecords.forEach(record => {
        if (!invalidUserGroups[record.user_name]) {
            invalidUserGroups[record.user_name] = [];
        }
        invalidUserGroups[record.user_name].push(record);
    });

    // 显示每个错误用户名的统计
    Object.keys(invalidUserGroups).forEach(userName => {
        const records = invalidUserGroups[userName];
        console.log(`\n  - 用户名: "${userName}" (${records.length} 条记录)`);
        console.log(`    日期范围: ${records[0].date} ~ ${records[records.length - 1].date}`);
        console.log(`    部门: ${records[0].department}`);
        console.log(`    岗位: ${records[0].position}`);
    });

    // 询问是否确认删除
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('\n是否删除这些记录? (输入 yes 确认): ', (answer) => {
        rl.close();

        if (answer.toLowerCase() === 'yes') {
            // 执行删除
            const deleteStmt = db.db.prepare('DELETE FROM kpi_data WHERE user_name = ?');
            let deletedCount = 0;

            Object.keys(invalidUserGroups).forEach(userName => {
                const result = deleteStmt.run(userName);
                deletedCount += result.changes;
                console.log(`已删除用户 "${userName}" 的 ${result.changes} 条记录`);
            });

            console.log(`\n总共删除了 ${deletedCount} 条记录`);
            console.log('数据库清理完成！');
        } else {
            console.log('取消删除操作');
        }

        // 关闭数据库连接
        process.exit(0);
    });
}

// 如果需要直接执行（不带确认）
function forceCleanup() {
    console.log('开始强制清理数据库中的错误用户数据...\n');

    db.initDatabase();

    const allKpiData = db.kpiQueries.getAll.all();
    const invalidRecords = allKpiData.filter(record => isInvalidUserName(record.user_name));

    if (invalidRecords.length === 0) {
        console.log('未发现包含错误用户名的记录');
        return;
    }

    console.log(`发现 ${invalidRecords.length} 条包含错误用户名的记录`);

    const deleteStmt = db.db.prepare('DELETE FROM kpi_data WHERE user_name = ?');
    let deletedCount = 0;

    const uniqueInvalidUsers = [...new Set(invalidRecords.map(r => r.user_name))];
    uniqueInvalidUsers.forEach(userName => {
        const result = deleteStmt.run(userName);
        deletedCount += result.changes;
        console.log(`已删除用户 "${userName}" 的 ${result.changes} 条记录`);
    });

    console.log(`\n总共删除了 ${deletedCount} 条记录`);
    console.log('数据库清理完成！');
}

// 命令行参数：--force 表示强制执行，不询问确认
if (process.argv.includes('--force')) {
    forceCleanup();
} else {
    cleanupInvalidUsers();
}

module.exports = { isInvalidUserName, cleanupInvalidUsers, forceCleanup };
