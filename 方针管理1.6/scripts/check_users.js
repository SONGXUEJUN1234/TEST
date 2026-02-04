const db = require('../database/db');
db.initDatabase();

const allData = db.kpiQueries.getAll.all();
const invalidPatterns = ['1号机工艺员', '2号机工艺员', '3号机工艺员', '4号机工艺员', '5号机工艺员', '号机'];
const invalidRecords = allData.filter(r => invalidPatterns.some(p => (r.user_name || '').includes(p)));

console.log('=== 数据库检查结果 ===');
console.log('总记录数:', allData.length);
console.log('错误记录数:', invalidRecords.length);

if (invalidRecords.length > 0) {
    const byUser = {};
    invalidRecords.forEach(r => {
        const key = r.user_name || '(空)';
        if (!byUser[key]) byUser[key] = [];
        byUser[key].push(r);
    });
    console.log('\n发现以下错误用户名:');
    Object.keys(byUser).forEach(u => {
        const recs = byUser[u];
        console.log(`  - "${u}" (${recs.length}条)`);
        console.log(`    部门: ${recs[0].department}, 岗位: ${recs[0].position}`);
    });
}

process.exit(0);
