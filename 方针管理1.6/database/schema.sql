-- 方针管理KPI数据库结构

-- KPI数据表
CREATE TABLE IF NOT EXISTS kpi_data (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    date TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    user_name TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    kpi_type TEXT,
    kpi_direction TEXT DEFAULT 'forward',
    target_value REAL,
    actual_value REAL,
    completion_rate REAL,
    unit TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 提醒记录表
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    user_name TEXT NOT NULL,
    department TEXT,
    date TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文件同步记录表
CREATE TABLE IF NOT EXISTS file_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 指标层级关系表（类似多级BOM）
-- 每一行定义：某人在某部门的某个KPI，支撑上级某人的某个KPI
CREATE TABLE IF NOT EXISTS kpi_hierarchy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kpi_name TEXT NOT NULL,               -- 本级KPI名称
    user_name TEXT NOT NULL,              -- 本级人员姓名
    department TEXT NOT NULL,             -- 本级部门
    position TEXT NOT NULL,               -- 本级岗位
    parent_kpi_name TEXT,                 -- 上级KPI名称（支撑谁的指标）
    parent_user_name TEXT,                -- 上级人员姓名
    hierarchy_level INTEGER NOT NULL,     -- 层级级别（1=总经理级，2=部门经理级，3=员工级）
    kpi_nature TEXT,                      -- KPI性质（正向/反向），来自层级关系表
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建单列索引
CREATE INDEX IF NOT EXISTS idx_kpi_date ON kpi_data(date);
CREATE INDEX IF NOT EXISTS idx_kpi_department ON kpi_data(department);
CREATE INDEX IF NOT EXISTS idx_kpi_user ON kpi_data(user_name);
CREATE INDEX IF NOT EXISTS idx_alert_date ON alerts(date);
CREATE INDEX IF NOT EXISTS idx_alert_status ON alerts(status);

-- 创建复合索引优化常用查询
CREATE INDEX IF NOT EXISTS idx_kpi_date_dept ON kpi_data(date, department);
CREATE INDEX IF NOT EXISTS idx_kpi_date_user ON kpi_data(date, user_name);
CREATE INDEX IF NOT EXISTS idx_kpi_date_dept_user ON kpi_data(date, department, user_name);

-- 层级关系表索引
CREATE INDEX IF NOT EXISTS idx_hierarchy_kpi_user ON kpi_hierarchy(kpi_name, user_name);
CREATE INDEX IF NOT EXISTS idx_hierarchy_parent ON kpi_hierarchy(parent_kpi_name, parent_user_name);
CREATE INDEX IF NOT EXISTS idx_hierarchy_level ON kpi_hierarchy(hierarchy_level);

-- 插入默认配置
INSERT OR IGNORE INTO system_config (key, value) VALUES ('submit_deadline', '09:00');
INSERT OR IGNORE INTO system_config (key, value) VALUES ('alert_enabled', 'true');
INSERT OR IGNORE INTO system_config (key, value) VALUES ('completion_threshold', '80');
