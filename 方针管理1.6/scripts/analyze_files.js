const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * 分析现有Excel文件结构
 */
function analyzeExcelFiles() {
    const mockDataDir = path.join(__dirname, '..', 'mock_data');
    const files = [];

    // 递归查找所有xlsx文件
    function walkDir(dir) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walkDir(fullPath);
            } else if (item.endsWith('.xlsx')) {
                files.push(fullPath);
            }
        });
    }

    walkDir(mockDataDir);

    console.log('========================================');
    console.log(`找到 ${files.length} 个Excel文件`);
    console.log('========================================\n');

    // 分析每个文件
    const fileAnalysis = [];

    files.forEach(filePath => {
        try {
            const workbook = XLSX.readFile(filePath);
            const fileName = path.basename(filePath);

            // 获取第一个Sheet的数据
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

            // 查找日期信息
            let date = '未知';
            let department = '未知';
            let position = '未知';
            let userName = '未知';

            for (let i = 0; i < Math.min(10, rawData.length); i++) {
                const row = rawData[i];
                if (row && row.length >= 2) {
                    const key = String(row[0] || '').trim();
                    const value = row[1];
                    if (key === '日期') date = value;
                    if (key === '部门') department = value;
                    if (key === '岗位') position = value;
                    if (key === '姓名') userName = value;
                }
            }

            fileAnalysis.push({
                filePath,
                fileName,
                date,
                department,
                position,
                userName,
                sheetCount: workbook.SheetNames.length,
                sheetNames: workbook.SheetNames
            });
        } catch (error) {
            console.error(`分析文件失败: ${filePath}`, error.message);
        }
    });

    // 按人员分组
    const byPerson = {};
    fileAnalysis.forEach(item => {
        const key = `${item.department}-${item.position}-${item.userName}`;
        if (!byPerson[key]) {
            byPerson[key] = [];
        }
        byPerson[key].push(item);
    });

    console.log('按人员分组:');
    console.log('========================================\n');

    for (const [person, items] of Object.entries(byPerson)) {
        console.log(`${person}:`);
        console.log(`  文件数: ${items.length}`);
        const dates = items.map(i => i.date).sort();
        console.log(`  日期: ${dates.join(', ')}`);
        console.log('');
    }

    return { files: fileAnalysis, byPerson };
}

// 运行分析
const result = analyzeExcelFiles();

// 导出结果供后续使用
module.exports = result;
