const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'kpi.db');
const db = new Database(dbPath);

// 启用 WAL 模式以支持更好的并发读写
db.pragma('journal_mode = WAL');

// 优化并发性能
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 10000');
db.pragma('temp_store = memory');

// 查询对象（延迟初始化）
let kpiQueries = null;
let alertQueries = null;
let syncLogQueries = null;
let userQueries = null;
let configQueries = null;
let hierarchyQueries = null;

// 初始化数据库
function initDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('数据库初始化完成');

    // 执行数据库迁移
    migrateDatabase();
    createPerformanceIndexes();

    initQueries();
}

// 数据库迁移：添加kpi_direction字段
function migrateDatabase() {
    try {
        // 检查kpi_direction字段是否存在
        const tableInfo = db.pragma('table_info(kpi_data)');
        const hasKpiDirection = tableInfo.some(col => col.name === 'kpi_direction');

        if (!hasKpiDirection) {
            console.log('执行数据库迁移：添加kpi_direction字段...');
            db.exec('ALTER TABLE kpi_data ADD COLUMN kpi_direction TEXT DEFAULT "forward"');
            console.log('迁移完成：kpi_direction字段已添加');

            // 为现有数据自动分类kpi_direction
            const existingData = db.prepare('SELECT id, kpi_name, kpi_type FROM kpi_data WHERE kpi_direction IS NULL').all();
            if (existingData.length > 0) {
                console.log(`正在为 ${existingData.length} 条现有数据自动分类KPI方向...`);

                const excelSyncService = require('../services/excelSyncService');
                const updateStmt = db.prepare('UPDATE kpi_data SET kpi_direction = ? WHERE id = ?');

                existingData.forEach(row => {
                    const direction = excelSyncService.classifyKpiDirection(row.kpi_name);
                    updateStmt.run(direction, row.id);
                });

                console.log('现有数据分类完成');
            }
        }
    } catch (error) {
        // 如果迁移失败（可能是字段已存在），忽略错误
        if (!error.message.includes('duplicate column')) {
            console.warn('数据库迁移警告:', error.message);
        }
    }
}

// 创建性能优化索引
function createPerformanceIndexes() {
    try {
        console.log('创建性能优化索引...');

        // 创建复合索引
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_kpi_date_dept ON kpi_data(date, department);
            CREATE INDEX IF NOT EXISTS idx_kpi_date_user ON kpi_data(date, user_name);
            CREATE INDEX IF NOT EXISTS idx_kpi_date_dept_user ON kpi_data(date, department, user_name);
        `);

        console.log('性能优化索引创建完成');
    } catch (error) {
        console.warn('创建索引警告:', error.message);
    }
}

// 初始化查询（在数据库表创建后调用）
function initQueries() {
    // KPI数据操作
    kpiQueries = {
        // 插入KPI数据
        insert: db.prepare(`
            INSERT OR REPLACE INTO kpi_data
            (id, file_path, date, department, position, user_name, kpi_name, kpi_type, kpi_direction,
             target_value, actual_value, completion_rate, unit, remark, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `),

        // 根据文件路径删除KPI数据（用于重新同步文件）
        deleteByFilePath: db.prepare(`
            DELETE FROM kpi_data WHERE file_path = ?
        `),

        // 获取所有KPI数据
        getAll: db.prepare(`
            SELECT * FROM kpi_data
            ORDER BY date DESC, department, user_name, kpi_name
        `),

        // 根据日期获取KPI数据
        getByDate: db.prepare(`
            SELECT * FROM kpi_data
            WHERE date = ?
            ORDER BY department, user_name, kpi_name
        `),

        // 根据部门获取KPI数据
        getByDepartment: db.prepare(`
            SELECT * FROM kpi_data
            WHERE department = ? AND date = ?
            ORDER BY user_name, kpi_name
        `),

        // 根据用户获取KPI数据
        getByUser: db.prepare(`
            SELECT * FROM kpi_data
            WHERE user_name = ? AND date = ?
            ORDER BY kpi_name
        `),

        // 获取所有日期
        getAllDates: db.prepare(`
            SELECT DISTINCT date FROM kpi_data
            ORDER BY date DESC
        `),

        // 获取所有部门
        getAllDepartments: db.prepare(`
            SELECT DISTINCT department FROM kpi_data
            ORDER BY department
        `),

        // 删除指定日期的数据
        deleteByDate: db.prepare(`
            DELETE FROM kpi_data WHERE date = ?
        `),

        // 获取KPI趋势数据
        getTrend: db.prepare(`
            SELECT date, kpi_name, kpi_type, kpi_direction, target_value, actual_value, completion_rate
            FROM kpi_data
            WHERE user_name = ? AND kpi_name = ?
            AND date >= ? AND date <= ?
            ORDER BY date
        `)
    };

    // 提醒操作
    alertQueries = {
        insert: db.prepare(`
            INSERT INTO alerts (type, user_name, department, date, message)
            VALUES (?, ?, ?, ?, ?)
        `),

        getPending: db.prepare(`
            SELECT * FROM alerts
            WHERE status = 'pending'
            ORDER BY created_at DESC
        `),

        updateStatus: db.prepare(`
            UPDATE alerts SET status = ? WHERE id = ?
        `)
    };

    // 文件同步日志
    syncLogQueries = {
        insert: db.prepare(`
            INSERT INTO file_sync_log (file_path, status, message)
            VALUES (?, ?, ?)
        `),

        getLatest: db.prepare(`
            SELECT * FROM file_sync_log
            ORDER BY sync_time DESC
            LIMIT 100
        `)
    };

    // 用户操作
    userQueries = {
        insert: db.prepare(`
            INSERT OR REPLACE INTO users (id, name, department, position, email, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `),

        getAll: db.prepare(`
            SELECT * FROM users ORDER BY department, position, name
        `),

        getByDepartment: db.prepare(`
            SELECT * FROM users WHERE department = ? ORDER BY position, name
        `)
    };

    // 系统配置
    configQueries = {
        get: db.prepare(`SELECT value FROM system_config WHERE key = ?`),
        set: db.prepare(`UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`)
    };

    // 层级关系操作
    hierarchyQueries = {
        // 插入层级关系
        insert: db.prepare(`
            INSERT OR REPLACE INTO kpi_hierarchy
            (kpi_name, user_name, department, position, parent_kpi_name, parent_user_name, hierarchy_level)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),

        // 获取所有层级关系
        getAll: db.prepare(`
            SELECT * FROM kpi_hierarchy
            ORDER BY hierarchy_level, department, user_name
        `),

        // 根据上级KPI获取下级
        getChildren: db.prepare(`
            SELECT * FROM kpi_hierarchy
            WHERE parent_kpi_name = ? AND parent_user_name = ?
            ORDER BY department, user_name
        `),

        // 根据本级KPI获取上级
        getParent: db.prepare(`
            SELECT * FROM kpi_hierarchy
            WHERE kpi_name = ? AND user_name = ?
        `),

        // 根据层级级别获取关系
        getByLevel: db.prepare(`
            SELECT * FROM kpi_hierarchy
            WHERE hierarchy_level = ?
            ORDER BY department, user_name
        `),

        // 删除所有层级关系（用于重新导入）
        deleteAll: db.prepare(`DELETE FROM kpi_hierarchy`)
    };
}

function getConfig(key, defaultValue = null) {
    if (!configQueries) return defaultValue;
    const result = configQueries.get.get(key);
    return result ? result.value : defaultValue;
}

function setConfig(key, value) {
    if (!configQueries) return;
    configQueries.set.run(value, key);
}

// 获取用户ID (通过用户名)
function getUserId(userName) {
    try {
        const result = db.prepare('SELECT id FROM users WHERE name = ?').get(userName);
        return result ? result.id : null;
    } catch (error) {
        console.error('获取用户ID失败:', error.message);
        return null;
    }
}

// 插入同步日志
function insertSyncLog(filePath, status, message) {
    try {
        if (syncLogQueries) {
            syncLogQueries.insert.run(filePath, status, message);
        }
    } catch (error) {
        console.error('插入同步日志失败:', error.message);
    }
}

// 创建或更新用户
function upsertUser(userInfo) {
    try {
        if (!userQueries) return;
        const { id, name, department, position, email, role } = userInfo;
        userQueries.insert.run(id, name, department, position, email || '', role || 'employee');
    } catch (error) {
        console.error('更新用户失败:', error.message);
    }
}

// 插入测试用户（用于初始化模拟数据）
function insertTestUsers() {
    if (!userQueries) return;

    const users = [
        { id: 'U001', name: '王总经理', department: '总经办', position: '总经理', role: 'manager' },
        { id: 'U002', name: '陈销售经理', department: '销售部', position: '部门经理', role: 'manager' },
        { id: 'U003', name: '李生产经理', department: '生产部', position: '部门经理', role: 'manager' },
        { id: 'U004', name: '何财务经理', department: '财务部', position: '部门经理', role: 'manager' },
        { id: 'U005', name: '冯质量经理', department: '质量部', position: '部门经理', role: 'manager' },
        { id: 'U006', name: '杨采购经理', department: '采购部', position: '部门经理', role: 'manager' },
        { id: 'U007', name: '尤人事经理', department: '人事部', position: '部门经理', role: 'manager' },
        { id: 'U008', name: '周销售代表1', department: '销售部', position: '销售代表' },
        { id: 'U009', name: '吴销售代表2', department: '销售部', position: '销售代表' },
        { id: 'U010', name: '郑销售代表3', department: '销售部', position: '销售代表' },
        { id: 'U011', name: '张班组长A', department: '生产部', position: '班组长' },
        { id: 'U012', name: '刘班组长B', department: '生产部', position: '班组长' },
        { id: 'U013', name: '赵操作工1', department: '生产部', position: '操作工' },
        { id: 'U014', name: '钱操作工2', department: '生产部', position: '操作工' },
        { id: 'U015', name: '孙操作工3', department: '生产部', position: '操作工' },
        { id: 'U016', name: '朱采购员1', department: '采购部', position: '采购员' },
        { id: 'U017', name: '秦采购员2', department: '采购部', position: '采购员' },
        { id: 'U018', name: '沈质检员1', department: '质量部', position: '质检员' },
        { id: 'U019', name: '韩质检员2', department: '质量部', position: '质检员' },
        { id: 'U020', name: '吕会计1', department: '财务部', position: '会计' },
        { id: 'U021', name: '施会计2', department: '财务部', position: '会计' },
        { id: 'U022', name: '许人事专员', department: '人事部', position: '人事专员' },
        { id: 'U023', name: '测试用户', department: '测试部', position: '测试工程师' }
    ];

    users.forEach(user => {
        userQueries.insert.run(
            user.id,
            user.name,
            user.department,
            user.position,
            user.email || '',
            user.role || 'employee'
        );
    });
}

// 获取所有用户 (用于提醒服务)
function getAllUsers() {
    try {
        if (!userQueries) return [];
        return userQueries.getAll.all();
    } catch (error) {
        console.error('获取用户列表失败:', error.message);
        return [];
    }
}

module.exports = {
    db,
    initDatabase,
    get kpiQueries() { return kpiQueries; },
    get alertQueries() { return alertQueries; },
    get syncLogQueries() { return syncLogQueries; },
    get userQueries() { return userQueries; },
    get configQueries() { return configQueries; },
    get hierarchyQueries() { return hierarchyQueries; },
    getConfig,
    setConfig,
    getUserId,
    insertSyncLog,
    upsertUser,
    insertTestUsers,
    getAllUsers
};
