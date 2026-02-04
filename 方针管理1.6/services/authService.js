/**
 * 权限管理服务
 * 实现基于角色的访问控制 (RBAC)
 */

// 用户角色定义
const ROLES = {
    EMPLOYEE: 'employee',       // 普通员工
    TEAM_LEADER: 'team_leader', // 班组长
    MANAGER: 'manager',         // 部门经理
    GM: 'gm',                   // 总经理
    ADMIN: 'admin'              // 系统管理员
};

// 权限定义
const PERMISSIONS = {
    VIEW_ALL: 'view_all',           // 查看所有数据
    VIEW_DEPARTMENT: 'view_dept',   // 查看部门数据
    VIEW_TEAM: 'view_team',         // 查看班组数据
    VIEW_SELF: 'view_self',         // 查看个人数据
    EDIT_SELF: 'edit_self',         // 编辑个人数据
    EDIT_ALL: 'edit_all',           // 编辑所有数据
    MANAGE_USERS: 'manage_users',   // 管理用户
    MANAGE_CONFIG: 'manage_config'  // 管理系统配置
};

// 角色权限映射
const ROLE_PERMISSIONS = {
    [ROLES.EMPLOYEE]: [
        PERMISSIONS.VIEW_ALL,
        PERMISSIONS.VIEW_SELF,
        PERMISSIONS.EDIT_SELF
    ],
    [ROLES.TEAM_LEADER]: [
        PERMISSIONS.VIEW_ALL,
        PERMISSIONS.VIEW_TEAM,
        PERMISSIONS.VIEW_SELF,
        PERMISSIONS.EDIT_SELF
    ],
    [ROLES.MANAGER]: [
        PERMISSIONS.VIEW_ALL,
        PERMISSIONS.VIEW_DEPARTMENT,
        PERMISSIONS.VIEW_SELF,
        PERMISSIONS.EDIT_SELF
    ],
    [ROLES.GM]: [
        PERMISSIONS.VIEW_ALL,
        PERMISSIONS.VIEW_DEPARTMENT,
        PERMISSIONS.VIEW_SELF
    ],
    [ROLES.ADMIN]: [
        PERMISSIONS.VIEW_ALL,
        PERMISSIONS.VIEW_DEPARTMENT,
        PERMISSIONS.VIEW_TEAM,
        PERMISSIONS.VIEW_SELF,
        PERMISSIONS.EDIT_ALL,
        PERMISSIONS.EDIT_SELF,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_CONFIG
    ]
};

/**
 * 检查用户是否有指定权限
 */
function hasPermission(userRole, permission) {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(permission);
}

/**
 * 检查用户是否可以编辑指定用户的KPI数据
 */
function canEditKPI(currentUser, targetUserName) {
    // 管理员可以编辑所有数据
    if (currentUser.role === ROLES.ADMIN) {
        return true;
    }

    // 用户只能编辑自己的数据
    return currentUser.name === targetUserName;
}

/**
 * 检查用户是否可以查看指定部门的数据
 */
function canViewDepartment(currentUser, department) {
    // 总经理和管理员可以查看所有部门
    if (currentUser.role === ROLES.GM || currentUser.role === ROLES.ADMIN) {
        return true;
    }

    // 部门经理可以查看本部门数据
    if (currentUser.role === ROLES.MANAGER && currentUser.department === department) {
        return true;
    }

    // 班组长可以查看本部门数据
    if (currentUser.role === ROLES.TEAM_LEADER && currentUser.department === department) {
        return true;
    }

    // 普通员工可以查看所有部门数据
    if (currentUser.role === ROLES.EMPLOYEE) {
        return true;
    }

    return false;
}

/**
 * 过滤用户可查看的KPI数据
 */
function filterKPIByPermission(user, kpiData) {
    if (!user || !kpiData) return kpiData;

    // 管理员和总经理可以看到所有数据
    if (user.role === ROLES.ADMIN || user.role === ROLES.GM) {
        return kpiData;
    }

    // 部门经理只能看到本部门数据
    if (user.role === ROLES.MANAGER) {
        return kpiData.filter(kpi => kpi.department === user.department);
    }

    // 班组长只能看到本部门数据
    if (user.role === ROLES.TEAM_LEADER) {
        return kpiData.filter(kpi => kpi.department === user.department);
    }

    // 普通员工可以看到所有数据（根据需求）
    return kpiData;
}

/**
 * 验证编辑KPI的权限中间件
 */
function validateEditPermission(req, res, next) {
    const currentUser = req.user;
    const targetUserName = req.body.user_name || req.params.userName;

    if (!currentUser) {
        return res.status(401).json({
            success: false,
            message: '未登录'
        });
    }

    if (!canEditKPI(currentUser, targetUserName)) {
        return res.status(403).json({
            success: false,
            message: '无权限编辑此数据'
        });
    }

    next();
}

/**
 * 模拟用户认证（实际项目中应使用JWT等）
 * 这里使用简单的请求头认证用于演示
 */
function authenticateUser(req) {
    // 从请求头获取用户信息（实际项目中应从JWT token解析）
    const userHeader = req.headers['x-user'];
    if (!userHeader) {
        return null;
    }

    try {
        return JSON.parse(Buffer.from(userHeader, 'base64').toString());
    } catch {
        return null;
    }
}

/**
 * 认证中间件
 */
function requireAuth(req, res, next) {
    const user = authenticateUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: '需要登录'
        });
    }

    req.user = user;
    next();
}

/**
 * 获取用户角色名称（中文）
 */
function getRoleName(role) {
    const roleNames = {
        [ROLES.EMPLOYEE]: '普通员工',
        [ROLES.TEAM_LEADER]: '班组长',
        [ROLES.MANAGER]: '部门经理',
        [ROLES.GM]: '总经理',
        [ROLES.ADMIN]: '系统管理员'
    };
    return roleNames[role] || '未知角色';
}

module.exports = {
    ROLES,
    PERMISSIONS,
    hasPermission,
    canEditKPI,
    canViewDepartment,
    filterKPIByPermission,
    validateEditPermission,
    requireAuth,
    authenticateUser,
    getRoleName
};
