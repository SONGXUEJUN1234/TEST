const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * 创建一个月度Excel测试文件
 * 每个Sheet代表一天
 */
function createMonthlyTestFile() {
    const testDir = path.join(__dirname, '..', 'mock_data', '2026', '01');

    // 确保目录存在
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    const workbook = XLSX.utils.book_new();

    // 创建3天的测试数据：01, 02, 03
    const days = ['01', '02', '03'];

    days.forEach(day => {
        // 创建基本数据
        const basicData = [
            ['日期', `2026-01-${day}`],
            ['部门', '测试部'],
            ['岗位', '测试工程师'],
            ['姓名', '测试用户'],
            [],
            ['KPI名称', 'KPI类型', '目标值', '实际值', '完成率', '单位', '备注'],
            ['测试销售额', '数量', 10000, 12000, 120, '元', '测试数据'],
            ['测试客户数', '数量', 5, 6, 120, '人', ''],
            ['测试合格率', '比率', 95, 98, 103.16, '%', ''],
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(basicData);
        XLSX.utils.book_append_sheet(workbook, worksheet, day);
    });

    // 添加一个非日期格式的Sheet（应该被跳过）
    const notesSheet = XLSX.utils.aoa_to_sheet([
        ['说明', '这是一个说明页，应该被跳过']
    ]);
    XLSX.utils.book_append_sheet(workbook, notesSheet, '说明');

    const filePath = path.join(testDir, '测试部-测试工程师-测试用户.xlsx');
    XLSX.writeFile(workbook, filePath);

    console.log(`测试文件已创建: ${filePath}`);
    console.log('  - Sheet列表: 01, 02, 03, 说明');
    console.log('  - 预期: 前3个Sheet会被解析，"说明"Sheet会被跳过');

    return filePath;
}

// 运行
createMonthlyTestFile();
