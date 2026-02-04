const cron = require('node-cron');
const { getConfig } = require('../database/db');

// 辅助函数：延迟获取 queries
function getKPIQueries() {
    const db = require('../database/db');
    return db.kpiQueries;
}

function getAlertQueries() {
    const db = require('../database/db');
    return db.alertQueries;
}

/**
 * 提醒服务
 * 负责检查KPI数据并发送提醒
 */
class AlertService {
    constructor() {
        this.alertTasks = [];
        this.isRunning = false;
    }

    /**
     * 启动提醒服务
     */
    start() {
        if (this.isRunning) {
            console.log('提醒服务已在运行');
            return;
        }

        console.log('启动提醒服务...');

        // 每天早上8:30检查未提交数据
        this.alertTasks.push(
            cron.schedule('30 8 * * 1-5', () => {
                this.checkUnsubmittedData();
            }, {
                scheduled: true,
                timezone: 'Asia/Shanghai'
            })
        );

        // 每小时检查KPI未达标 - 已取消（因加密系统限制，改为手工检查）
        // this.alertTasks.push(
        //     cron.schedule('0 * * * 1-5', () => {
        //         this.checkUnmetKPI();
        //     })
        // );

        // 每2小时检查数据异常 - 已取消（因加密系统限制，改为手工检查）
        // this.alertTasks.push(
        //     cron.schedule('0 */2 * * 1-5', () => {
        //         this.checkDataAnomalies();
        //     })
        // );

        this.isRunning = true;
        console.log('提醒服务已启动');
    }

    /**
     * 检查未提交数据
     */
    checkUnsubmittedData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const submitDeadline = getConfig('submit_deadline', '09:00');
            const kpiQueries = getKPIQueries();

            // 获取所有应该提交数据的用户
            const allUsers = this.getExpectedUsers();

            // 获取今天已提交的用户
            const submittedUsers = new Set();
            const todayData = kpiQueries.getByDate.all(today);
            todayData.forEach(kpi => {
                submittedUsers.add(kpi.user_name);
            });

            // 找出未提交的用户
            const unsubmittedUsers = allUsers.filter(user => !submittedUsers.has(user.name));

            // 创建提醒
            unsubmittedUsers.forEach(user => {
                this.createAlert(
                    'unsubmitted',
                    user.name,
                    user.department,
                    today,
                    `您今日的KPI数据尚未提交，请在${submitDeadline}前完成`
                );
            });

            console.log(`检查未提交数据: ${unsubmittedUsers.length}人未提交`);

        } catch (error) {
            console.error('检查未提交数据失败:', error.message);
        }
    }

    /**
     * 检查KPI未达标
     */
    checkUnmetKPI() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const threshold = parseInt(getConfig('completion_threshold', '80'));
            const kpiQueries = getKPIQueries();

            const todayData = kpiQueries.getByDate.all(today);

            let alertCount = 0;
            todayData.forEach(kpi => {
                // 检查完成率
                if (kpi.completion_rate !== null && kpi.completion_rate < threshold) {
                    this.createAlert(
                        'unmet',
                        kpi.user_name,
                        kpi.department,
                        today,
                        `${kpi.kpi_name} 完成率为 ${kpi.completion_rate}%，低于${threshold}%`
                    );
                    alertCount++;
                }

                // 检查实际值是否低于目标值
                if (kpi.actual_value !== null && kpi.target_value !== null) {
                    if (kpi.actual_value < kpi.target_value) {
                        this.createAlert(
                            'unmet',
                            kpi.user_name,
                            kpi.department,
                            today,
                            `${kpi.kpi_name} 实际值(${kpi.actual_value})低于目标值(${kpi.target_value})`
                        );
                    }
                }
            });

            console.log(`检查KPI未达标: 发现 ${alertCount} 个未达标项`);

        } catch (error) {
            console.error('检查KPI未达标失败:', error.message);
        }
    }

    /**
     * 检查数据异常
     */
    checkDataAnomalies() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const kpiQueries = getKPIQueries();

            const todayData = kpiQueries.getByDate.all(today);
            const yesterdayData = kpiQueries.getByDate.all(yesterday);

            // 构建昨天的数据映射
            const yesterdayMap = new Map();
            yesterdayData.forEach(kpi => {
                const key = `${kpi.user_name}_${kpi.kpi_name}`;
                yesterdayMap.set(key, kpi);
            });

            let anomalyCount = 0;
            todayData.forEach(kpi => {
                const key = `${kpi.user_name}_${kpi.kpi_name}`;
                const yesterdayKpi = yesterdayMap.get(key);

                if (yesterdayKpi && kpi.actual_value !== null && yesterdayKpi.actual_value !== null) {
                    // 检查数据突变（增长或下降超过50%）
                    const changeRate = Math.abs((kpi.actual_value - yesterdayKpi.actual_value) / yesterdayKpi.actual_value);
                    if (changeRate > 0.5 && yesterdayKpi.actual_value !== 0) {
                        this.createAlert(
                            'anomaly',
                            kpi.user_name,
                            kpi.department,
                            today,
                            `${kpi.kpi_name} 数据异常波动：昨日${yesterdayKpi.actual_value} → 今日${kpi.actual_value}`
                        );
                        anomalyCount++;
                    }
                }

                // 检查空值
                if (kpi.actual_value === null && kpi.target_value !== null) {
                    this.createAlert(
                        'anomaly',
                        kpi.user_name,
                        kpi.department,
                        today,
                        `${kpi.kpi_name} 缺少实际值数据`
                    );
                    anomalyCount++;
                }
            });

            console.log(`检查数据异常: 发现 ${anomalyCount} 个异常`);

        } catch (error) {
            console.error('检查数据异常失败:', error.message);
        }
    }

    /**
     * 创建提醒
     */
    createAlert(type, userName, department, date, message) {
        try {
            const alertQueries = getAlertQueries();
            if (!alertQueries) {
                console.warn('alertQueries 未初始化，跳过创建提醒');
                return;
            }
            alertQueries.insert.run(type, userName, department, date, message);
        } catch (error) {
            console.error('创建提醒失败:', error.message);
        }
    }

    /**
     * 获取待处理的提醒
     */
    getPendingAlerts() {
        try {
            const alertQueries = getAlertQueries();
            if (!alertQueries) {
                console.warn('alertQueries 未初始化，返回空数组');
                return [];
            }
            return alertQueries.getPending.all();
        } catch (error) {
            console.error('获取提醒失败:', error.message);
            return [];
        }
    }

    /**
     * 标记提醒为已处理
     */
    markAlertAsRead(alertId) {
        try {
            const alertQueries = getAlertQueries();
            if (!alertQueries) {
                console.warn('alertQueries 未初始化，无法标记提醒');
                return false;
            }
            alertQueries.updateStatus.run('read', alertId);
            return true;
        } catch (error) {
            console.error('更新提醒状态失败:', error.message);
            return false;
        }
    }

    /**
     * 获取期望的用户列表（从历史数据中获取）
     */
    getExpectedUsers() {
        const kpiQueries = getKPIQueries();
        // 这里简化处理，从数据库中获取唯一的用户
        const allData = kpiQueries.getAll.all();
        const userMap = new Map();

        allData.forEach(kpi => {
            if (!userMap.has(kpi.user_name)) {
                userMap.set(kpi.user_name, {
                    name: kpi.user_name,
                    department: kpi.department
                });
            }
        });

        return Array.from(userMap.values());
    }

    /**
     * 停止提醒服务
     */
    stop() {
        this.alertTasks.forEach(task => task.stop());
        this.alertTasks = [];
        this.isRunning = false;
        console.log('提醒服务已停止');
    }
}

module.exports = new AlertService();
