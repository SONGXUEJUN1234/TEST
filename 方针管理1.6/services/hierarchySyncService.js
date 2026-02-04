/**
 * 指标层级关系Excel同步服务
 * 负责监控和导入层级关系Excel文件到数据库
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
// 已禁用自动监控，改为启动时全量同步
// const chokidar = require('chokidar');
const db = require('../database/db');

class HierarchySyncService {
    constructor() {
        this.watchPath = null;
        this.hierarchyCache = new Map(); // 缓存 KPI 性质数据: key="userName_kpiName", value="forward/reverse"
    }

    // 初始化同步服务 - 只执行一次全量同步，不启动监控
    async init(watchPath = null) {
        this.watchPath = watchPath || path.join(__dirname, '..', 'mock_data');

        console.log(`层级关系同步服务启动，扫描路径: ${this.watchPath}`);
        console.log('执行一次全量同步（不启用文件监控）...');

        // 只执行一次全量同步，不启动文件监控
        await this.syncAllFiles();
    }

    // 处理文件变化
    async handleFileChange(filePath, event) {
        try {
            // 只处理包含"层级关系"或"hierarchy"的.xlsx文件
            const fileName = path.basename(filePath).toLowerCase();
            if (!filePath.endsWith('.xlsx') ||
                (!fileName.includes('层级关系') && !fileName.includes('hierarchy'))) {
                return;
            }

            console.log(`检测到层级关系文件${event}: ${filePath}`);

            // 解析Excel文件
            const hierarchyData = await this.parseHierarchyExcel(filePath);

            // 同步到数据库
            if (!hierarchyData || hierarchyData.length === 0) {
                console.warn(`文件 ${filePath} 未解析到有效层级关系数据，跳过同步`);
                db.insertSyncLog(filePath, 'warning', '未解析到有效层级关系数据，跳过同步');
                return;
            }

            await this.syncToDatabase(hierarchyData, filePath);
            db.insertSyncLog(filePath, 'success', `成功同步 ${hierarchyData.length} 条层级关系数据`);
        } catch (error) {
            console.error(`处理层级关系文件失败 ${filePath}:`, error);
            db.insertSyncLog(filePath, 'error', error.message);
        }
    }

    // 解析层级关系Excel文件
    async parseHierarchyExcel(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                console.warn(`文件 ${filePath} 没有可用的Sheet`);
                return [];
            }
            const allHierarchyData = [];

            // 遍历所有Sheet
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const hierarchyData = this.parseHierarchyData(worksheet, filePath);
                allHierarchyData.push(...hierarchyData);
            }

            return allHierarchyData;
        } catch (error) {
            console.error(`解析层级关系Excel文件失败 ${filePath}:`, error);
            return null;
        }
    }

    // 解析层级关系数据
    parseHierarchyData(worksheet, filePath) {
        const hierarchyData = [];

        if (!worksheet || !worksheet['!ref']) {
            console.warn(`文件 ${filePath} 的Sheet没有有效数据范围`);
            return [];
        }

        // 查找表头行
        let headerRow = -1;
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let row = range.s.r; row <= range.e.r; row++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
            if (cell && (cell.v === '本级KPI名称' || cell.v === 'KPI名称')) {
                headerRow = row;
                break;
            }
        }

        if (headerRow === -1) {
            console.warn(`文件 ${filePath} 未找到层级关系表头`);
            return [];
        }

        // 解析数据行
        let invalidRowCount = 0;

        for (let row = headerRow + 1; row <= range.e.r; row++) {
            const kpiName = this.normalizeText(this.getCellValue(worksheet, row, 0));
            const userName = this.normalizeText(this.getCellValue(worksheet, row, 1));

            if (!kpiName && !userName) {
                continue; // 跳过空行
            }

            if (!kpiName || !userName) {
                invalidRowCount += 1;
                continue;
            }

            const hierarchyItem = {
                kpi_name: kpiName,
                user_name: userName,
                department: this.normalizeText(this.getCellValue(worksheet, row, 2)),
                position: this.normalizeText(this.getCellValue(worksheet, row, 3)),
                parent_kpi_name: this.normalizeText(this.getCellValue(worksheet, row, 4)),
                parent_user_name: this.normalizeText(this.getCellValue(worksheet, row, 5)),
                hierarchy_level: this.normalizeHierarchyLevel(this.getCellValue(worksheet, row, 6)),
                kpi_nature: this.mapKpiNature(this.getCellValue(worksheet, row, 7)) // 第8列：KPI性质
            };

            hierarchyData.push(hierarchyItem);
        }

        if (invalidRowCount > 0) {
            console.warn(`文件 ${filePath} 有 ${invalidRowCount} 行缺少KPI名称或姓名，已跳过`);
        }

        return hierarchyData;
    }

    // 获取单元格值
    getCellValue(worksheet, row, col) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        return cell ? cell.v : null;
    }

    normalizeText(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const text = value.toString().trim();
        return text;
    }

    normalizeHierarchyLevel(value) {
        if (value === null || value === undefined || value === '') {
            return 3;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? 3 : parsed;
    }

    /**
     * 映射 KPI性质：正向/反向 -> forward/reverse
     */
    mapKpiNature(nature) {
        if (!nature) return null;
        const text = nature.toString().trim();
        if (text === '正向') return 'forward';
        if (text === '反向') return 'reverse';
        return null;
    }

    /**
     * 从缓存或数据库获取 KPI 性质
     * @param {string} kpiName - KPI名称
     * @param {string} userName - 人员姓名
     * @returns {string|null} 'forward' | 'reverse' | null
     */
    getKpiNature(kpiName, userName) {
        // 先从缓存查找
        const key = `${userName}_${kpiName}`;
        if (this.hierarchyCache.has(key)) {
            return this.hierarchyCache.get(key);
        }

        // 缓存未命中，从数据库查询
        try {
            const result = db.db.prepare(`
                SELECT kpi_nature FROM kpi_hierarchy
                WHERE kpi_name = ? AND user_name = ?
                LIMIT 1
            `).get(kpiName, userName);

            if (result && result.kpi_nature) {
                // 更新缓存
                this.hierarchyCache.set(key, result.kpi_nature);
                return result.kpi_nature;
            }
        } catch (error) {
            console.error('查询KPI性质失败:', error);
        }

        return null;
    }

    /**
     * 重新加载缓存
     */
    reloadCache() {
        this.hierarchyCache.clear();
        try {
            const results = db.db.prepare(`
                SELECT kpi_name, user_name, kpi_nature FROM kpi_hierarchy
                WHERE kpi_nature IS NOT NULL
            `).all();

            results.forEach(row => {
                const key = `${row.user_name}_${row.kpi_name}`;
                this.hierarchyCache.set(key, row.kpi_nature);
            });

            console.log(`已重新加载层级关系缓存，共 ${this.hierarchyCache.size} 条`);
        } catch (error) {
            console.error('重新加载层级关系缓存失败:', error);
        }
    }

    // 同步到数据库
    async syncToDatabase(hierarchyData, filePath) {
        if (!hierarchyData || hierarchyData.length === 0) {
            console.warn(`文件 ${filePath} 没有有效层级关系数据，跳过数据库同步`);
            return;
        }

        // 先删除所有旧的层级关系数据
        db.hierarchyQueries?.deleteAll?.run();

        // 插入新数据（包含 kpi_nature 字段）
        const insert = db.db.prepare(`
            INSERT OR REPLACE INTO kpi_hierarchy
            (kpi_name, user_name, department, position, parent_kpi_name, parent_user_name, hierarchy_level, kpi_nature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.db.transaction((data) => {
            for (const item of data) {
                insert.run(
                    item.kpi_name,
                    item.user_name,
                    item.department || '',
                    item.position || '',
                    item.parent_kpi_name || '',
                    item.parent_user_name || '',
                    item.hierarchy_level || 3,
                    item.kpi_nature || null
                );
            }
        });

        insertMany(hierarchyData);

        // 同步后重新加载缓存
        this.reloadCache();

        console.log(`已同步 ${hierarchyData.length} 条层级关系到数据库`);
    }

    // 同步所有文件
    async syncAllFiles() {
        console.log('开始同步所有层级关系Excel文件...');

        const promises = [];

        this.walkDirectory(this.watchPath, (filePath) => {
            const fileName = path.basename(filePath).toLowerCase();
            if (filePath.endsWith('.xlsx') &&
                (fileName.includes('层级关系') || fileName.includes('hierarchy'))) {
                promises.push(this.handleFileChange(filePath, 'sync'));
            }
        });

        // 等待所有异步操作完成
        await Promise.all(promises);
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

    // 停止服务（已禁用监控，此方法保留兼容性）
    stop() {
        console.log('层级关系同步服务已停止');
    }
}

module.exports = new HierarchySyncService();
