const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const db = require('../database/db');
const hierarchySyncService = require('./hierarchySyncService');

class ExcelSyncService {
    constructor() {
        this.watchPath = null;
        this.watcher = null;
        this.syncInterval = null;
    }

    // 初始化同步服务
    init(watchPath = null) {
        this.watchPath = watchPath || path.join(__dirname, '..', 'mock_data');

        console.log(`Excel同步服务启动，监控路径: ${this.watchPath}`);

        // 启动文件监控
        this.startFileWatcher();

        // 启动定时同步
        this.startPeriodicSync();

        // 立即执行一次同步
        this.syncAllFiles();
    }

    // 启动文件监控
    startFileWatcher() {
        this.watcher = chokidar.watch(this.watchPath, {
            ignored: /(^|[\/\\])\../, // 忽略隐藏文件
            persistent: true,
            ignoreInitial: false, // 初始扫描时也触发事件
            awaitWriteFinish: {
                stabilityThreshold: 2000, // 文件写入完成后等待2秒再处理
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', filePath => this.handleFileChange(filePath, 'add'))
            .on('change', filePath => this.handleFileChange(filePath, 'change'))
            .on('error', error => console.error(`文件监控错误: ${error}`));
    }

    // 启动定时同步
    startPeriodicSync() {
        // 已停止自动同步 - 由于加密系统限制，改为通过NPM手工更新
        // this.syncInterval = setInterval(() => {
        //     this.syncAllFiles();
        // }, 30000);
        console.log('自动同步已禁用，将通过NPM手工更新');
    }

    // 处理文件变化
    async handleFileChange(filePath, event) {
        try {
            // 只处理.xlsx文件
            if (!filePath.endsWith('.xlsx')) {
                return;
            }

            console.log(`检测到文件${event}: ${filePath}`);

            // 解析Excel文件
            const kpiData = await this.parseExcelFile(filePath);

            // 同步到数据库
            if (kpiData && kpiData.length > 0) {
                await this.syncToDatabase(kpiData, filePath);
                db.insertSyncLog(filePath, 'success', `成功同步 ${kpiData.length} 条KPI数据`);
            }
        } catch (error) {
            console.error(`处理文件失败 ${filePath}:`, error);
            db.insertSyncLog(filePath, 'error', error.message);
        }
    }

    // 解析Excel文件 - 支持多Sheet格式（每人每月一个文件，每个Sheet代表一天）
    async parseExcelFile(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const allKpiData = [];

            // 遍历所有Sheet（每个Sheet代表一天）
            for (const sheetName of workbook.SheetNames) {
                // Sheet名称格式: "01-01", "01-02" 等
                const date = this.parseDateFromSheetName(sheetName, filePath);

                // 如果Sheet名称不符合日期格式，跳过（可能是说明页等）
                if (!date) {
                    console.log(`跳过非日期格式的Sheet: ${sheetName}`);
                    continue;
                }

                const worksheet = workbook.Sheets[sheetName];

                // 解析基本信息
                const basicInfo = this.parseBasicInfo(worksheet);

                // 用Sheet名称解析的日期覆盖文件中的日期
                basicInfo.date = date;

                if (!basicInfo.name) {
                    console.warn(`文件 ${filePath} 的Sheet ${sheetName} 缺少姓名信息`);
                    continue;
                }

                // 解析该日期的KPI数据
                const kpiData = this.parseKpiData(worksheet, basicInfo, filePath);
                allKpiData.push(...kpiData);
            }

            return allKpiData;
        } catch (error) {
            console.error(`解析Excel文件失败 ${filePath}:`, error);
            return null;
        }
    }

    // 从Sheet名称解析日期
    // Sheet名称格式: "01", "02", "03" 等（代表日期）
    // 从文件路径提取年月信息
    parseDateFromSheetName(sheetName, filePath) {
        // Sheet名称格式: "01", "02", "03" 等（1-31的数字）
        const day = parseInt(sheetName, 10);
        if (day >= 1 && day <= 31) {
            // 从文件路径提取年月
            // 路径格式: mock_data/2026/01/文件名.xlsx 或 mock_data\2026\01\文件名.xlsx
            // 统一使用正则分割，支持 / 和 \ 两种分隔符
            const pathParts = filePath.split(/[\/\\]/);
            const monthFolder = pathParts[pathParts.length - 2]; // "01"
            const yearFolder = pathParts[pathParts.length - 3]; // "2026"

            // 验证年月格式
            if (/^\d{4}$/.test(yearFolder) && /^\d{2}$/.test(monthFolder)) {
                // 格式化日期为 "2026-01-01"
                const dayStr = String(day).padStart(2, '0');
                return `${yearFolder}-${monthFolder}-${dayStr}`;
            }
        }
        return null;
    }

    // 解析基本信息
    parseBasicInfo(worksheet) {
        const info = {
            date: '',
            department: '',
            position: '',
            name: ''
        };

        // 遍历前10行，查找基本信息
        for (let row = 1; row <= 10; row++) {
            const keyCell = worksheet[XLSX.utils.encode_cell({ r: row - 1, c: 0 })];
            const valueCell = worksheet[XLSX.utils.encode_cell({ r: row - 1, c: 1 })];

            if (keyCell && valueCell) {
                const key = keyCell.v.trim();
                const value = valueCell.v;

                if (key === '日期') info.date = value;
                if (key === '部门') info.department = value;
                if (key === '岗位') info.position = value;
                if (key === '姓名') info.name = value;
            }
        }

        return info;
    }

    // 解析KPI数据
    parseKpiData(worksheet, basicInfo, filePath) {
        const kpiData = [];

        // 查找表头行（包含"KPI名称"的行）
        let headerRow = -1;
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let row = range.s.r; row <= range.e.r; row++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
            if (cell && cell.v === 'KPI名称') {
                headerRow = row;
                break;
            }
        }

        if (headerRow === -1) {
            console.warn(`文件 ${filePath} 未找到KPI数据表头`);
            return [];
        }

        // 解析数据行
        for (let row = headerRow + 1; row <= range.e.r; row++) {
            const kpiNameCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];

            if (!kpiNameCell || !kpiNameCell.v) {
                continue; // 跳过空行
            }

            // 从层级关系表获取KPI方向（正向/反向）
            const kpiDirection = this.classifyKpiDirection(kpiNameCell.v, basicInfo.name);

            const kpiItem = {
                id: this.generateId(basicInfo.name, kpiNameCell.v, basicInfo.date),
                date: basicInfo.date,
                department: basicInfo.department,
                position: basicInfo.position,
                user_name: basicInfo.name,
                kpi_name: kpiNameCell.v,
                kpi_type: this.getCellValue(worksheet, row, 1),
                kpi_direction: kpiDirection,  // 新增：自动分类的正向/反向标识
                target_value: this.getCellValue(worksheet, row, 2),
                actual_value: this.getCellValue(worksheet, row, 3),
                completion_rate: this.getCellValue(worksheet, row, 4),
                unit: this.getCellValue(worksheet, row, 5),
                remark: this.getCellValue(worksheet, row, 6),
                file_path: filePath
            };

            // 计算完成率（如果Excel中没有）
            // 统一公式：完成率 = 实际值 / 目标值 × 100%
            // 正反向指标只在状态判断时有区别，不改变达成率计算公式
            if (kpiItem.target_value && kpiItem.actual_value && !kpiItem.completion_rate) {
                // 统一使用 实际/目标 × 100%，前端会根据kpi_direction判断状态
                kpiItem.completion_rate = Math.round((kpiItem.actual_value / kpiItem.target_value) * 100 * 100) / 100;
            }

            kpiData.push(kpiItem);
        }

        return kpiData;
    }

    // 生成唯一ID
    generateId(userName, kpiName, date) {
        const crypto = require('crypto');
        const source = `${userName}_${kpiName}_${date}`;
        return crypto.createHash('md5').update(source).digest('hex');
    }

    /**
     * 获取KPI方向（正向/反向）
     * 优先从层级关系表获取，如果没有则使用关键词匹配作为回退
     * @param {string} kpiName - KPI名称
     * @param {string} userName - 人员姓名
     * @returns {string} 'forward' | 'reverse'
     */
    classifyKpiDirection(kpiName, userName) {
        if (!kpiName) return 'forward';

        // 优先从层级关系表获取 KPI 性质
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

    // 获取单元格值
    getCellValue(worksheet, row, col) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        return cell ? cell.v : null;
    }

    // 同步到数据库
    async syncToDatabase(kpiData, filePath) {
        // 先删除该文件的旧数据
        db.db.prepare('DELETE FROM kpi_data WHERE file_path = ?').run(filePath);

        // 插入新数据（包含kpi_direction字段）
        const insert = db.db.prepare(`
            INSERT OR REPLACE INTO kpi_data
            (id, file_path, date, department, position, user_name, kpi_name, kpi_type, kpi_direction, target_value, actual_value, completion_rate, unit, remark)
            VALUES (@id, @file_path, @date, @department, @position, @user_name, @kpi_name, @kpi_type, @kpi_direction, @target_value, @actual_value, @completion_rate, @unit, @remark)
        `);

        const insertMany = db.db.transaction((data) => {
            for (const item of data) {
                insert.run(item);
            }
        });

        insertMany(kpiData);

        console.log(`已同步 ${kpiData.length} 条KPI数据到数据库`);
    }

    // 同步所有文件
    syncAllFiles() {
        console.log('开始同步所有Excel文件...');

        this.walkDirectory(this.watchPath, (filePath) => {
            if (filePath.endsWith('.xlsx')) {
                this.handleFileChange(filePath, 'sync');
            }
        });
    }

    // 遍历目录
    walkDirectory(dir, callback) {
        if (!fs.existsSync(dir)) {
            console.warn(`目录不存在: ${dir}`);
            return;
        }

        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                this.walkDirectory(filePath, callback);
            } else if (stat.isFile()) {
                callback(filePath);
            }
        });
    }

    // 停止服务
    stop() {
        if (this.watcher) {
            this.watcher.close();
        }

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        console.log('Excel同步服务已停止');
    }
}

module.exports = new ExcelSyncService();
