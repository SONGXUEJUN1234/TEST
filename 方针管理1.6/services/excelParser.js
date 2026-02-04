const XLSX = require('xlsx');
const path = require('path');
const crypto = require('crypto');
const hierarchySyncService = require('./hierarchySyncService');

/**
 * Excel解析器
 * 负责解析Excel文件并提取KPI数据
 */
class ExcelParser {
    /**
     * 解析Excel文件
     * @param {string} filePath - Excel文件路径
     * @param {string} date - 数据日期
     * @returns {Array} KPI数据数组
     */
    parseFile(filePath, date) {
        try {
            const workbook = XLSX.readFile(filePath);
            const kpiData = [];

            // 遍历所有Sheet
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];

                // 读取原始数据（header: 1返回二维数组）
                const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1});

                // 查找表头行（包含"KPI名称"的行）
                let headerRowIndex = -1;
                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (row && row.some(cell => cell && String(cell).includes('KPI名称'))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    console.log(`文件 ${filePath} 的Sheet ${sheetName} 没有找到KPI表头行`);
                    return; // 跳过这个Sheet，而不是return整个文件
                }

                // 获取表头
                const headers = rawData[headerRowIndex];
                // 从表头下一行开始是数据
                const dataRows = rawData.slice(headerRowIndex + 1);

                // 从文件名提取信息
                const fileInfo = this.parseFileName(filePath);

                // ⚠️ 关键修复：从文件路径提取年月，从Sheet名称提取日期
                // 文件路径格式：.../2026/01/文件.xlsx
                // Sheet名称格式：'01', '02', ..., '16' 表示日期
                let sheetDate = date;

                // 如果从路径没有提取到完整日期，尝试从路径提取年月 + Sheet名称提取日
                if (!date) {
                    // 从文件路径提取年月
                    const pathMatch = filePath.match(/(\d{4})[\/\\](\d{1,2})[\/\\]/);
                    if (pathMatch && /^\d{1,2}$/.test(sheetName)) {
                        const [, year, month] = pathMatch;
                        const day = parseInt(sheetName, 10);
                        if (day >= 1 && day <= 31) {
                            sheetDate = `${year}-${month.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            console.log(`✨ 从路径 ${year}/${month} 和Sheet名称 "${sheetName}" 组合生成日期: ${sheetDate}`);
                        }
                    }
                }

                // 如果仍然没有日期，跳过这个Sheet（层级关系表等不需要日期的表）
                if (!sheetDate) {
                    return;
                }

                // 解析每一行数据
                dataRows.forEach((row, index) => {
                    // 将数组转换为对象
                    const rowObj = {};
                    row.forEach((value, i) => {
                        if (headers[i]) {
                            rowObj[headers[i]] = value;
                        }
                    });

                    const kpi = this.parseRow(rowObj, fileInfo, sheetDate, sheetName, index);
                    if (kpi) {
                        kpiData.push(kpi);
                    }
                });
            });

            return kpiData;
        } catch (error) {
            console.error(`解析文件失败: ${filePath}`, error.message);
            throw error;
        }
    }

    /**
     * 解析文件名，提取部门、岗位、姓名信息
     * 文件名格式：部门-岗位-姓名.xlsx 或 部门-姓名.xlsx
     */
    parseFileName(filePath) {
        const fileName = path.basename(filePath, path.extname(filePath));
        const parts = fileName.split('-');

        let department = '未知部门';
        let position = '未知岗位';
        let userName = '未知';

        if (parts.length >= 3) {
            [department, position, userName] = parts;
        } else if (parts.length === 2) {
            [department, userName] = parts;
            position = '员工';
        } else if (parts.length === 1) {
            userName = parts[0];
        }

        return { department, position, userName };
    }

    /**
     * 获取KPI方向（正向/反向）
     * 优先从层级关系表获取，如果没有则使用关键词匹配
     * @param {string} kpiName - KPI名称
     * @param {string} userName - 人员姓名
     * @returns {string} 'forward' | 'reverse'
     */
    classifyKpiDirection(kpiName, userName) {
        if (!kpiName) return 'forward';

        // 优先从层级关系表获取 KPI 性质（本级KPI指标的性质）
        if (userName) {
            const kpiNature = hierarchySyncService.getKpiNature(kpiName, userName);
            if (kpiNature) {
                return kpiNature;
            }
        }

        // 回退：如果没有在层级关系表中找到，使用关键词匹配
        console.log(`警告: KPI "${kpiName}" (用户: ${userName}) 在层级关系表中未找到，使用关键词匹配`);

        // 特殊情况：成本控制、费用控制是正向指标（控制能力越高越好）
        if (kpiName.includes('成本控制') || kpiName.includes('费用控制')) {
            return 'forward';
        }

        const reverseKeywords = [
            '成本', '费用', '消耗', '损耗','单耗',
            '不合格率', '缺陷率', '报废率', '不良率', '投诉次数', '故障率',
            '投诉退货损失', '拒收率', '差错率', '失误率','用电量','电耗',
            '流失率', '离职率', '人员流失','用量','气泡','水耗','故障时间','返工数量',
            '库存天数', '周转天数', '停机时间','退货数量', '库存质量损失','人员工时','安全事故','温度','超标',' downtime'
        ];

        const forwardKeywords = [
            '产量', '销量', '销售额', '收入', '利润',
            '合格率', '达成率', '完成率', '合格率',
            '准时率', '及时性', '符合率','出料量','标准化',
            '满意度', '好评率', '水分','准确率',
            '有效性', '利用率', '效率', '双确认','出售金额','配方超差','效能'
        ];

        // 优先检查反向关键词（更明确）
        for (const keyword of reverseKeywords) {
            if (kpiName.includes(keyword)) {
                return 'reverse';
            }
        }

        // 检查正向关键词
        for (const keyword of forwardKeywords) {
            if (kpiName.includes(keyword)) {
                return 'forward';
            }
        }

        // 默认为正向指标
        return 'forward';
    }

    /**
     * 解析单行数据
     */
    parseRow(row, fileInfo, date, sheetName, index) {
        // 检查是否是有效的KPI行
        if (!this.isValidKpiRow(row)) {
            return null;
        }

        // 提取KPI字段（支持多种命名方式）
        const kpiName = this.getValue(row, ['KPI名称', '指标名称', '指标', 'KPI', '名称']);
        if (!kpiName) return null;

        const targetValue = this.getNumberValue(row, ['目标值', '目标', '计划值', '计划']);
        const actualValue = this.getNumberValue(row, ['实际值', '实际', '完成值', '完成']);
        const unit = this.getValue(row, ['单位', '计量单位']);
        const remark = this.getValue(row, ['备注', '说明', ' Remark']);
        const kpiType = this.getValue(row, ['KPI类型', '指标类型', '类型']);

        // 获取KPI方向（从层级关系表或关键词匹配）
        const kpiDirection = this.classifyKpiDirection(kpiName, fileInfo.userName);

        // 计算完成率
        let completionRate = null;
        if (targetValue !== null && actualValue !== null && targetValue !== 0) {
            completionRate = Math.round((actualValue / targetValue) * 100);
        }

        // 如果行中有完成率字段，使用该值
        const rowCompletionRate = this.getNumberValue(row, ['完成率', '达成率', '达成']);
        if (rowCompletionRate !== null) {
            completionRate = rowCompletionRate;
        }

        return {
            id: this.generateId(fileInfo, kpiName, date),
            file_path: '',
            date: date,
            department: fileInfo.department,
            position: fileInfo.position,
            user_name: fileInfo.userName,
            kpi_name: kpiName,
            kpi_type: kpiType || sheetName,
            kpi_direction: kpiDirection,
            target_value: targetValue,
            actual_value: actualValue,
            completion_rate: completionRate,
            unit: unit || '',
            remark: remark || ''
        };
    }

    /**
     * 检查是否是有效的KPI行
     */
    isValidKpiRow(row) {
        // 必须包含KPI名称字段
        const kpiName = this.getValue(row, ['KPI名称', '指标名称', '指标', 'KPI', '名称']);
        return !!kpiName;
    }

    /**
     * 获取字符串值
     */
    getValue(row, fieldNames) {
        for (const name of fieldNames) {
            if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
                return String(row[name]).trim();
            }
        }
        return null;
    }

    /**
     * 获取数值
     */
    getNumberValue(row, fieldNames) {
        for (const name of fieldNames) {
            if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
                const value = parseFloat(row[name]);
                if (!isNaN(value)) {
                    return value;
                }
            }
        }
        return null;
    }

    /**
     * 生成唯一ID
     */
    generateId(fileInfo, kpiName, date) {
        const source = `${fileInfo.userName}_${fileInfo.department}_${kpiName}_${date}`;
        return crypto.createHash('md5').update(source).digest('hex');
    }
}

module.exports = new ExcelParser();
