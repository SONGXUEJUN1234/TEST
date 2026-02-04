// 已禁用chokidar自动监控，改为启动时全量扫描
// const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const excelParser = require('./excelParser');

/**
 * Excel文件扫描器
 * 启动时扫描一次所有Excel文件并同步到数据库
 */
class ExcelWatcher {
    constructor() {
        this.debounceTimer = new Map();
        this.processingQueue = new Map();
        this.isProcessing = false;
    }

    /**
     * 启动扫描 - 扫描一次所有Excel文件并同步
     * @param {string} dirPath - 扫描目录路径
     */
    start(dirPath) {
        console.log(`开始扫描目录: ${dirPath}`);
        console.log('执行一次全量扫描（不启用文件监控）...');

        // 扫描目录并同步所有文件
        this.walkDirectory(dirPath, (filePath) => {
            if (this.isExcelFile(filePath)) {
                this.processingQueue.set(filePath, Date.now());
            }
        });

        // 处理队列
        this.processQueue();
    }

    /**
     * 遍历目录
     */
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

    /**
     * 处理队列中的文件（按顺序处理，避免并发冲突）
     */
    async processQueue() {
        if (this.isProcessing) {
            return;
        }

        if (this.processingQueue.size === 0) {
            console.log('✅ 全量扫描完成');
            return;
        }

        this.isProcessing = true;

        try {
            const [filePath] = this.processingQueue.keys();
            this.processingQueue.delete(filePath);

            console.log(`处理文件: ${filePath} (剩余: ${this.processingQueue.size})`);
            await this.syncFile(filePath);

        } catch (error) {
            console.error(`处理文件出错: ${error.message}`);
        } finally {
            this.isProcessing = false;

            if (this.processingQueue.size > 0) {
                // 延迟处理下一个文件
                setTimeout(() => this.processQueue(), 50);
            }
        }
    }

    /**
     * 同步文件内容到数据库
     */
    async syncFile(filePath) {
        try {
            // 从文件路径提取日期（如果有完整日期YYYY/MM/DD）
            // 如果没有，excelParser会从"文件夹年月+Sheet表名"组合生成日期
            const date = this.extractDateFromPath(filePath);

            // 解析Excel文件（传null让excelParser自动从路径+Sheet名组合日期）
            const kpiData = excelParser.parseFile(filePath, date);

            if (kpiData.length === 0) {
                console.log(`文件 ${filePath} 没有有效的KPI数据`);
                return;
            }

            // 获取查询对象（动态获取，确保数据库已初始化）
            const kpiQueries = db.kpiQueries;
            const syncLogQueries = db.syncLogQueries;

            if (!kpiQueries || !syncLogQueries) {
                console.error('数据库查询对象未初始化');
                return;
            }

            // ⚠️ 先删除该文件的旧数据，防止重复
            console.log(`删除文件 ${filePath} 的旧数据...`);
            const deleteResult = kpiQueries.deleteByFilePath.run(filePath);
            console.log(`已删除 ${deleteResult.changes} 条旧数据`);

            // 使用事务批量插入，提高性能和可靠性
            const insertMany = db.db.transaction((kpis) => {
                let successCount = 0;
                kpis.forEach(kpi => {
                    try {
                        kpiQueries.insert.run(
                            kpi.id,
                            filePath,
                            kpi.date,
                            kpi.department,
                            kpi.position,
                            kpi.user_name,
                            kpi.kpi_name,
                            kpi.kpi_type,
                            kpi.kpi_direction || 'forward',
                            kpi.target_value,
                            kpi.actual_value,
                            kpi.completion_rate,
                            kpi.unit,
                            kpi.remark
                        );
                        successCount++;
                    } catch (error) {
                        console.error(`保存KPI数据失败: ${error.message}`);
                    }
                });
                return successCount;
            });

            // 执行批量插入
            const successCount = insertMany(kpiData);

            // 记录同步日志
            syncLogQueries.insert.run(filePath, 'success', `成功同步 ${successCount} 条KPI数据`);
            console.log(`✅ 成功同步 ${successCount} 条KPI数据`);

        } catch (error) {
            console.error(`❌ 同步文件失败: ${filePath}`, error.message);
            const syncLogQueries = db.syncLogQueries;
            if (syncLogQueries) {
                syncLogQueries.insert.run(filePath, 'error', error.message);
            }
        }
    }

    /**
     * 从文件路径提取日期
     */
    extractDateFromPath(filePath) {
        // 尝试从路径中提取日期格式：YYYY/MM/DD
        const dateMatch = filePath.match(/(\d{4})[\/\\](\d{1,2})[\/\\](\d{1,2})/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // 尝试提取日期格式：YYYY-MM-DD
        const dateMatch2 = filePath.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (dateMatch2) {
            const [, year, month, day] = dateMatch2;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // 没有找到完整日期路径，返回null让excelParser从路径+Sheet名组合日期
        return null;
    }

    /**
     * 检查是否是Excel文件
     */
    isExcelFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);

        // 忽略Excel临时文件（以~$开头）
        if (fileName.startsWith('~$')) {
            console.log(`⚠️ 忽略临时文件: ${fileName}`);
            return false;
        }

        return ['.xlsx', '.xls'].includes(ext);
    }

    /**
     * 停止服务（已禁用监控，此方法保留兼容性）
     */
    stop() {
        console.log('Excel扫描服务已停止');
    }
}

module.exports = new ExcelWatcher();
