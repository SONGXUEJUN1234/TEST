/**
 * 生成指标层级关系Excel模板
 *
 * Excel格式说明：
 * - 第1行：表头
 * - 第2行起：数据行
 *
 * 每一行定义：某人在某部门的某个KPI，支撑上级某人的某个KPI
 *
 * 列定义：
 * A列：本级KPI名称
 * B列：本级人员
 * C列：本级部门
 * D列：本级岗位
 * E列：上级KPI名称（支撑谁的指标，根节点留空）
 * F列：上级人员（根节点留空）
 * G列：层级级别（1=总经理级，2=部门经理级，3=员工级）
 */

const XLSX = require('xlsx');
const path = require('path');

// 创建Excel工作簿
const workbook = XLSX.utils.book_new();

// 模板数据（示例）
const templateData = [
    // 表头
    [
        '本级KPI名称',
        '本级人员',
        '本级部门',
        '本级岗位',
        '上级KPI名称',
        '上级人员',
        '层级级别'
    ],
    // 示例数据1：总经理级（根节点，上级为空）
    [
        '年度销售额达成率',
        '王总经理',
        '总经办',
        '总经理',
        '',
        '',
        1
    ],
    [
        '全厂良品率',
        '王总经理',
        '总经办',
        '总经理',
        '',
        '',
        1
    ],
    // 示例数据2：部门经理级（支撑总经理）
    [
        '部门销售额达成率',
        '陈销售经理',
        '销售部',
        '部门经理',
        '年度销售额达成率',
        '王总经理',
        2
    ],
    [
        '部门良品率',
        '李生产经理',
        '生产部',
        '部门经理',
        '全厂良品率',
        '王总经理',
        2
    ],
    // 示例数据3：员工级（支撑部门经理）
    [
        '个人销售额达成率',
        '周销售代表1',
        '销售部',
        '销售代表',
        '部门销售额达成率',
        '陈销售经理',
        3
    ],
    [
        '客户开发数量',
        '吴销售代表2',
        '销售部',
        '销售代表',
        '部门销售额达成率',
        '陈销售经理',
        3
    ],
    [
        '班组良品率',
        '张班组长A',
        '生产部',
        '班组长',
        '部门良品率',
        '李生产经理',
        3
    ],
    [
        '个人操作良品率',
        '赵操作工1',
        '生产部',
        '操作工',
        '班组良品率',
        '张班组长A',
        3
    ]
];

// 创建工作表
const worksheet = XLSX.utils.aoa_to_sheet(templateData);

// 设置列宽
worksheet['!cols'] = [
    { wch: 25 }, // 本级KPI名称
    { wch: 15 }, // 本级人员
    { wch: 15 }, // 本级部门
    { wch: 15 }, // 本级岗位
    { wch: 25 }, // 上级KPI名称
    { wch: 15 }, // 上级人员
    { wch: 12 }  // 层级级别
];

// 添加工作表到工作簿
XLSX.utils.book_append_sheet(workbook, worksheet, '指标层级关系');

// 保存文件到mock_data目录
const outputPath = path.join(__dirname, '..', 'mock_data', '指标层级关系模板.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`层级关系Excel模板已生成: ${outputPath}`);
console.log('\n使用说明:');
console.log('1. 复制此模板文件，按年月创建目录，如：mock_data/2026/01/');
console.log('2. 文件命名格式：任意名称.xlsx（如：层级关系-2026-01.xlsx）');
console.log('3. 每一行定义：某人在某部门的某个KPI，支撑上级某人的某个KPI');
console.log('4. 根节点（总经理级）的上级KPI名称和上级人员留空');
console.log('5. 系统会自动监控mock_data目录并导入到数据库');
console.log('\n层级级别说明:');
console.log('  1 = 总经理级（顶层，根节点）');
console.log('  2 = 部门经理级（中间层）');
console.log('  3 = 员工级（底层）');
