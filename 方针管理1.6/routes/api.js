const express = require('express');
const router = express.Router();
const { kpiQueries, alertQueries, userQueries, db } = require('../database/db');
const alertService = require('../services/alertService');
const authService = require('../services/authService');
const hiddenKPIConfig = require('../config/hiddenKPI');

/**
 * 过滤敏感KPI数据
 * @param {Array} data - KPI数据数组
 * @returns {Array} 过滤后的数据
 */
function filterSensitiveKPI(data) {
    if (!hiddenKPIConfig.keywords || hiddenKPIConfig.keywords.length === 0) {
        return data;
    }

    return data.filter(kpi => {
        // 检查KPI名称是否包含敏感关键词
        const kpiName = kpi.kpi_name || '';
        const isSensitive = hiddenKPIConfig.keywords.some(keyword =>
            kpiName.includes(keyword)
        );

        // 如果是敏感KPI，检查部门或岗位是否在允许列表中
        if (isSensitive) {
            // 如果部门限制列表不为空，且当前部门在列表中，则显示
            if (hiddenKPIConfig.departments.length > 0) {
                return hiddenKPIConfig.departments.includes(kpi.department);
            }
            // 如果岗位限制列表不为空，且当前岗位在列表中，则显示
            if (hiddenKPIConfig.positions.length > 0) {
                return hiddenKPIConfig.positions.includes(kpi.position);
            }
            // 否则隐藏
            return false;
        }

        return true;
    });
}

/**
 * 判断KPI名称是否为反向指标（辅助函数）
 * @param {string} kpiName - KPI名称
 * @returns {boolean} 是否为反向指标
 */
function isReverseKpiByName(kpiName) {
    if (!kpiName) return false;

    // 特殊情况：成本控制类是正向指标
    if (kpiName.includes('成本控制') || kpiName.includes('费用控制')) {
        return false;
    }

    const reverseTypes = [
        '成本', '费用', '消耗', '损耗', '单耗',
        '不合格率', '缺陷率', '报废率', '不良率', '投诉率',
        '流失率', '离职率', '人员流失',
        '退货率', '拒收率', '差错率', '失误率',
        '库存天数', '周转天数', '停机时间'
    ];
    return reverseTypes.some(type => kpiName.includes(type));
}

/**
 * 获取完成率状态类（考虑KPI方向）
 * 与前端app.js中的getCompletionStatusClass逻辑保持一致
 * @param {number} rate - 完成率
 * @param {string} kpiDirection - KPI方向 ('forward' 或 'reverse')
 * @param {number} targetValue - 目标值（用于特殊判断）
 * @param {number} actualValue - 实际值（用于特殊判断）
 * @returns {string} 状态类 ('excellent', 'good', 'poor')
 */
function getCompletionStatusClass(rate, kpiDirection = 'forward', targetValue = null, actualValue = null) {
    // 特殊情况：当目标=0 且 实际=0 时，标识为达标
    if (targetValue === 0 && actualValue === 0) {
        return 'excellent';
    }

    if (rate === null || rate === undefined || isNaN(rate)) return 'poor';

    if (kpiDirection === 'reverse') {
        // 反向指标：越低越好
        // 完成率越低越好（低于目标值），超过100%表示超标（不好）
        if (rate <= 100) return 'excellent';  // 未超标，绿色
        if (rate <= 120) return 'good';       // 轻微超标，黄色
        return 'poor';                        // 严重超标，红色
    } else {
        // 正向指标：越高越好
        if (rate >= 100) return 'excellent';
        if (rate >= 80) return 'good';
        return 'poor';
    }
}

// 统计数据缓存（10分钟过期 - 优化后）
const statsCache = new Map();
const STATS_CACHE_TTL = 10 * 60 * 1000; // 10分钟

// KPI数据缓存（10分钟过期 - 优化后）
const kpiCache = new Map();
const KPI_CACHE_TTL = 10 * 60 * 1000; // 10分钟

/**
 * 生成缓存键
 */
function generateCacheKey(params) {
    return `kpi_${params.date || 'all'}_${params.department || 'all'}_${params.user || 'all'}_${params.page || 1}_${params.limit || 100}`;
}

/**
 * 获取所有KPI数据
 * GET /api/kpi
 */
router.get('/kpi', (req, res) => {
    try {
        // 动态获取查询对象
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;

        if (!kpiQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const { date, department, user, page = 1, limit = 100 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // 检查缓存
        const cacheKey = generateCacheKey({ date, department, user, page, limit });
        const cached = kpiCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < KPI_CACHE_TTL) {
            return res.json({
                success: true,
                data: cached.data,
                pagination: cached.pagination,
                cached: true
            });
        }

        let data;
        // 同时按部门和人员筛选（注意要排除 'all' 值）
        if (date && department && department !== 'all' && user && user !== 'all') {
            data = kpiQueries.getByDepartment.all(department, date);
            data = data.filter(kpi => kpi.user_name === user);
        } else if (date && department && department !== 'all') {
            data = kpiQueries.getByDepartment.all(department, date);
        } else if (date && user && user !== 'all') {
            data = kpiQueries.getByUser.all(user, date);
        } else if (date) {
            data = kpiQueries.getByDate.all(date);
        } else {
            data = kpiQueries.getAll.all();
        }

        // 不再过滤敏感KPI，直接使用原始数据
        const filteredData = data;

        // 分页处理
        const total = filteredData.length;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        // 存储到缓存
        kpiCache.set(cacheKey, {
            data: paginatedData,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: total,
                totalPages: Math.ceil(total / limitNum)
            },
            timestamp: Date.now()
        });

        res.json({
            success: true,
            data: paginatedData,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取KPI趋势数据
 * GET /api/kpi/trend
 */
router.get('/kpi/trend', (req, res) => {
    try {
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;

        if (!kpiQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const { user, kpi, startDate, endDate } = req.query;

        if (!user || !kpi || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数: user, kpi, startDate, endDate'
            });
        }

        const data = kpiQueries.getTrend.all(user, kpi, startDate, endDate);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取所有日期
 * GET /api/dates
 */
router.get('/dates', (req, res) => {
    try {
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;

        if (!kpiQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const dates = kpiQueries.getAllDates.all();
        res.json({
            success: true,
            data: dates.map(d => d.date)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取所有部门
 * GET /api/departments
 */
router.get('/departments', (req, res) => {
    try {
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;

        if (!kpiQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const departments = kpiQueries.getAllDepartments.all();
        res.json({
            success: true,
            data: departments.map(d => d.department)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取待处理的提醒
 * GET /api/alerts
 */
router.get('/alerts', (req, res) => {
    try {
        const alerts = alertService.getPendingAlerts();
        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 标记提醒为已读
 * PUT /api/alerts/:id/read
 */
router.put('/alerts/:id/read', (req, res) => {
    try {
        const { id } = req.params;
        const success = alertService.markAlertAsRead(id);

        res.json({
            success: success
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取统计概览
 * GET /api/stats
 */
router.get('/stats', (req, res) => {
    try {
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;

        if (!kpiQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const { date = new Date().toISOString().split('T')[0] } = req.query;

        // 检查缓存
        const cacheKey = `stats_${date}`;
        const cached = statsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
            console.log('使用缓存的统计数据:', date);
            return res.json({
                success: true,
                data: cached.data,
                cached: true
            });
        }

        const data = kpiQueries.getByDate.all(date);

        // 过滤敏感KPI
        const filteredData = filterSensitiveKPI(data);

        // 计算统计数据
        const stats = {
            total: filteredData.length,
            completed: 0,
            uncompleted: 0,
            excellent: 0,
            good: 0,
            poor: 0,
            departments: new Set(),
            users: new Set()
        };

        filteredData.forEach(kpi => {
            stats.departments.add(kpi.department);
            stats.users.add(kpi.user_name);

            // 获取KPI方向（与前端createKpiCard中的逻辑保持一致）
            let kpiDirection = 'forward';
            if (kpi.kpi_direction && kpi.kpi_direction !== '') {
                kpiDirection = kpi.kpi_direction;
            } else if (kpi.kpi_type && isReverseKpiByName(kpi.kpi_type)) {
                kpiDirection = 'reverse';
            }

            // 使用与明细卡片相同的判断逻辑
            const statusClass = getCompletionStatusClass(kpi.completion_rate, kpiDirection, kpi.target_value, kpi.actual_value);

            if (statusClass === 'excellent') {
                stats.excellent++;
                stats.completed++;
            } else if (statusClass === 'good') {
                stats.good++;
                stats.completed++;
            } else {
                stats.poor++;
                stats.uncompleted++;
            }
        });

        const resultData = {
            total: stats.total,
            completed: stats.completed,
            uncompleted: stats.uncompleted,
            excellent: stats.excellent,
            good: stats.good,
            poor: stats.poor,
            departmentCount: stats.departments.size,
            userCount: stats.users.size
        };

        // 更新缓存
        statsCache.set(cacheKey, {
            data: resultData,
            timestamp: Date.now()
        });

        res.json({
            success: true,
            data: resultData,
            cached: false
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取当前用户信息
 * GET /api/user/me
 */
router.get('/user/me', (req, res) => {
    try {
        const user = authService.authenticateUser(req);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: '未登录'
            });
        }

        res.json({
            success: true,
            data: {
                name: user.name,
                department: user.department,
                position: user.position,
                role: user.role,
                roleName: authService.getRoleName(user.role)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取所有用户列表
 * GET /api/users
 */
router.get('/users', (req, res) => {
    try {
        const db = require('../database/db');
        const userQueries = db.userQueries;

        if (!userQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const users = userQueries.getAll.all();
        res.json({
            success: true,
            data: users.map(u => ({
                id: u.id,
                name: u.name,
                department: u.department,
                position: u.position,
                role: u.role,
                roleName: authService.getRoleName(u.role)
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 更新KPI数据
 * PUT /api/kpi/:id
 */
router.put('/kpi/:id', authService.requireAuth, (req, res) => {
    try {
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;

        if (!kpiQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const { id } = req.params;
        const currentUser = req.user;

        // 获取现有KPI数据
        const existingKPI = kpiQueries.getAll.all().find(k => k.id === id);

        if (!existingKPI) {
            return res.status(404).json({
                success: false,
                message: 'KPI数据不存在'
            });
        }

        // 检查编辑权限
        if (!authService.canEditKPI(currentUser, existingKPI.user_name)) {
            return res.status(403).json({
                success: false,
                message: '无权限编辑此数据'
            });
        }

        // 允许更新的字段
        const { actual_value, completion_rate, remark } = req.body;

        // 更新数据库
        const updateFields = [];
        const updateValues = [];

        if (actual_value !== undefined) {
            updateFields.push('actual_value = ?');
            updateValues.push(actual_value);
        }

        if (completion_rate !== undefined) {
            updateFields.push('completion_rate = ?');
            updateValues.push(completion_rate);
        }

        if (remark !== undefined) {
            updateFields.push('remark = ?');
            updateValues.push(remark);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有要更新的字段'
            });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        const updateStmt = `UPDATE kpi_data SET ${updateFields.join(', ')} WHERE id = ?`;
        db.db.prepare(updateStmt).run(...updateValues);

        res.json({
            success: true,
            message: '更新成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 记录操作审计日志
 * POST /api/audit/log
 */
router.post('/audit/log', authService.requireAuth, (req, res) => {
    try {
        const { action, resource, details } = req.body;
        const user = req.user;

        // TODO: 实现审计日志记录到数据库
        console.log(`[审计] ${user.name} (${user.role}) - ${action} - ${resource}`);

        res.json({
            success: true,
            message: '日志已记录'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取层级结构的KPI数据
 * GET /api/kpi/hierarchy
 */
router.get('/kpi/hierarchy', (req, res) => {
    try {
        const db = require('../database/db');
        const kpiQueries = db.kpiQueries;
        const hierarchyQueries = db.hierarchyQueries;

        if (!kpiQueries || !hierarchyQueries) {
            return res.status(500).json({
                success: false,
                message: '数据库未初始化'
            });
        }

        const { date } = req.query;

        // 获取指定日期的所有KPI数据
        let allData;
        if (date) {
            allData = kpiQueries.getByDate.all(date);
        } else {
            allData = kpiQueries.getAll.all();
        }

        // 过滤敏感KPI
        const filteredData = filterSensitiveKPI(allData);

        // 获取层级关系
        const hierarchyRelations = hierarchyQueries.getAll.all();

        // 创建KPI数据索引 (kpi_name + user_name -> kpi_data)
        const kpiIndex = {};
        const normalizeKey = (value) => (value || '').toString().trim();
        filteredData.forEach(kpi => {
            const key = `${normalizeKey(kpi.kpi_name)}_${normalizeKey(kpi.user_name)}`;
            kpiIndex[key] = kpi;
        });

        /**
         * 构建层级结构
         * 新表结构：每行定义某人的KPI支撑上级某人的KPI
         */
        function buildHierarchy(relations, kpiData) {
            const rootNodes = [];
            const processedNodes = new Set();

            // 递归构建树
            function buildNode(kpiName, userName) {
                const normalizedKpiName = normalizeKey(kpiName);
                const normalizedUserName = normalizeKey(userName);
                const key = `${normalizedKpiName}_${normalizedUserName}`;

                // 避免循环引用
                if (processedNodes.has(key)) {
                    return null;
                }

                // 查找层级关系
                const relation = relations.find(r =>
                    normalizeKey(r.kpi_name) === normalizedKpiName &&
                    normalizeKey(r.user_name) === normalizedUserName
                );

                // 查找KPI数据
                const kpi = kpiIndex[key];

                // 既无KPI数据也无层级关系时，跳过
                if (!kpi && !relation) {
                    return null;
                }

                processedNodes.add(key);

                const node = {
                    ...(kpi || {}),
                    id: kpi?.id || (relation ? `hierarchy-${relation.id}` : key),
                    kpi_name: kpi?.kpi_name || relation.kpi_name,
                    user_name: kpi?.user_name || relation.user_name,
                    department: kpi?.department || relation.department || '',
                    position: kpi?.position || relation.position || '',
                    kpi_direction: kpi?.kpi_direction || relation?.kpi_nature || null,
                    date: kpi?.date || date || null,
                    level: relation ? relation.hierarchy_level : 1,
                    levelLabel: getLevelLabel(relation ? relation.hierarchy_level : 1),
                    children: []
                };

                // 查找子节点（谁的parent_kpi_name和parent_user_name指向当前节点）
                const childRelations = relations.filter(r =>
                    normalizeKey(r.parent_kpi_name) === normalizedKpiName &&
                    normalizeKey(r.parent_user_name) === normalizedUserName
                );

                childRelations.forEach(rel => {
                    const childNode = buildNode(rel.kpi_name, rel.user_name);
                    if (childNode) {
                        node.children.push(childNode);
                    }
                });

                return node;
            }

            // 找出根节点（parent_kpi_name为空或parent_kpi_name不存在的节点）
            relations.forEach(rel => {
                // parent为空的节点是根节点
                const parentKpiName = normalizeKey(rel.parent_kpi_name);
                const parentUserName = normalizeKey(rel.parent_user_name);
                if (!parentKpiName || !parentUserName) {
                    const key = `${normalizeKey(rel.kpi_name)}_${normalizeKey(rel.user_name)}`;
                    if (!processedNodes.has(key)) {
                        const node = buildNode(rel.kpi_name, rel.user_name);
                        if (node) {
                            rootNodes.push(node);
                        }
                    }
                }
            });

            // 如果没有根节点或没有层级关系数据，使用所有KPI作为根节点
            if (rootNodes.length === 0 || relations.length === 0) {
                Object.keys(kpiIndex).forEach(key => {
                    if (!processedNodes.has(key)) {
                        const kpi = kpiIndex[key];
                        const node = {
                            ...kpi,
                            level: 1,
                            levelLabel: '【岗】',
                            children: []
                        };
                        rootNodes.push(node);
                    }
                });
            }

            // 按KPI名称分组
            const hierarchy = {};
            rootNodes.forEach(node => {
                if (!hierarchy[node.kpi_name]) {
                    hierarchy[node.kpi_name] = [];
                }
                hierarchy[node.kpi_name].push(node);
            });

            return hierarchy;
        }

        // 获取层级级别标签
        function getLevelLabel(level) {
            switch (level) {
                case 1: return '【总】';
                case 2: return '【部】';
                case 3: return '【岗】';
                default: return '【级】';
            }
        }

        const hierarchyData = buildHierarchy(hierarchyRelations, kpiIndex);

        res.json({
            success: true,
            data: hierarchyData,
            summary: {
                totalKPIs: Object.keys(hierarchyData).length,
                totalRecords: filteredData.length,
                hierarchyRelations: hierarchyRelations.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
