/**
 * 敏感KPI配置
 * 包含这些关键词的KPI将不会在API中返回
 */
module.exports = {
    // 敏感KPI关键词列表（空数组表示不过滤任何数据）
    keywords: [],

    // 需要隐藏KPI的部门（可选，空数组表示不限制）
    departments: [],

    // 需要隐藏KPI的岗位（可选，空数组表示不限制）
    positions: []
};
