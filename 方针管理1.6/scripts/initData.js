const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// KPI模板定义
const kpiTemplates = {
    '总经理': [
        { name: '公司销售额', type: '财务', unit: '万元', target: 1000 },
        { name: '公司利润', type: '财务', unit: '万元', target: 150 },
        { name: '客户满意度', type: '客户', unit: '%', target: 95 },
        { name: '员工满意度', type: '人力', unit: '%', target: 85 },
        { name: '安全生产天数', type: '安全', unit: '天', target: 365 },
    ],
    '部门经理': [
        { name: '部门产值', type: '生产', unit: '万元', target: 500 },
        { name: '部门成本控制', type: '财务', unit: '万元', target: 400 },
        { name: '部门出勤率', type: '人力', unit: '%', target: 98 },
        { name: '部门培训完成率', type: '人力', unit: '%', target: 100 },
        { name: '部门安全事故数', type: '安全', unit: '次', target: 0 },
    ],
    '班组长': [
        { name: '班组产量', type: '生产', unit: '件', target: 1000 },
        { name: '产品合格率', type: '质量', unit: '%', target: 98 },
        { name: '班组效率', type: '生产', unit: '%', target: 95 },
        { name: '物料消耗控制', type: '成本', unit: '%', target: 100 },
    ],
    '销售代表': [
        { name: '个人销售额', type: '销售', unit: '万元', target: 50 },
        { name: '新客户开发数', type: '销售', unit: '个', target: 5 },
        { name: '客户回访率', type: '客户', unit: '%', target: 80 },
        { name: '合同签订数', type: '销售', unit: '份', target: 3 },
    ],
    '操作工': [
        { name: '个人产量', type: '生产', unit: '件', target: 200 },
        { name: '产品合格率', type: '质量', unit: '%', target: 99 },
        { name: '设备保养完成率', type: '设备', unit: '%', target: 100 },
        { name: '出勤天数', type: '人力', unit: '天', target: 22 },
    ],
    '质检员': [
        { name: '检验批次', type: '质量', unit: '批', target: 50 },
        { name: '问题检出率', type: '质量', unit: '%', target: 95 },
        { name: '检验及时率', type: '质量', unit: '%', target: 98 },
    ],
    '采购员': [
        { name: '采购完成率', type: '采购', unit: '%', target: 100 },
        { name: '采购成本节约', type: '成本', unit: '%', target: 5 },
        { name: '供应商准时交付率', type: '采购', unit: '%', target: 95 },
    ],
    '人事专员': [
        { name: '招聘完成率', type: '人力', unit: '%', target: 100 },
        { name: '培训覆盖率', type: '人力', unit: '%', target: 95 },
        { name: '员工流失率', type: '人力', unit: '%', target: 5 },
    ],
    '会计': [
        { name: '报销处理及时率', type: '财务', unit: '%', target: 98 },
        { name: '账务准确率', type: '财务', unit: '%', target: 100 },
        { name: '报表及时提交率', type: '财务', unit: '%', target: 100 },
    ]
};

// 生成随机变动（模拟真实数据）
function generateRandomValue(target, variance = 0.2) {
    const randomFactor = 1 + (Math.random() * variance * 2 - variance);
    return Math.round(target * randomFactor * 100) / 100;
}

// 生成Excel文件
function generateExcelFile(userInfo, date) {
    const kpis = kpiTemplates[userInfo.position] || kpiTemplates['操作工'];

    const data = [
        ['日经营看板', '', '', '', ''],
        ['日期', date, '', '', ''],
        ['部门', userInfo.department, '', '', ''],
        ['岗位', userInfo.position, '', '', ''],
        ['姓名', userInfo.name, '', '', ''],
        [''],
        ['KPI名称', 'KPI类型', '目标值', '实际值', '完成率', '单位', '备注'],
    ];

    kpis.forEach(kpi => {
        const actual = generateRandomValue(kpi.target, 0.25);
        const completion = Math.round((actual / kpi.target) * 100 * 100) / 100;

        data.push([
            kpi.name,
            kpi.type,
            kpi.target,
            actual,
            completion,
            kpi.unit,
            ''
        ]);
    });

    // 创建工作簿
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // 设置列宽
    worksheet['!cols'] = [
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 8 },
        { wch: 15 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KPI数据');

    return workbook;
}

// 生成模拟数据
async function generateMockData() {
    const db = require('../database/db');

    console.log('开始生成模拟Excel数据...');

    // 初始化数据库
    await db.initDatabase();
    db.insertTestUsers();

    const users = db.getAllUsers();

    // 生成最近30天的数据
    const today = new Date();
    const dataDir = path.join(__dirname, '..', 'mock_data');

    // 创建模拟数据目录
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() - dayOffset);
        const dateStr = date.toISOString().split('T')[0];

        // 按日期组织文件夹
        const [year, month, day] = dateStr.split('-');
        const dateDir = path.join(dataDir, year, month, day);

        if (!fs.existsSync(dateDir)) {
            fs.mkdirSync(dateDir, { recursive: true });
        }

        console.log(`生成 ${dateStr} 的数据...`);

        // 为每个用户生成Excel文件
        for (const user of users) {
            const workbook = generateExcelFile(user, dateStr);
            const fileName = `${user.department}-${user.position}-${user.name}.xlsx`;
            const filePath = path.join(dateDir, fileName);

            XLSX.writeFile(workbook, filePath);
        }
    }

    console.log('模拟Excel数据生成完成！');
    console.log(`数据保存在: ${dataDir}`);
}

// 运行
generateMockData().catch(console.error);
