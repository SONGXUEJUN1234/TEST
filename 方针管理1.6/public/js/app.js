// API 基础路径
const API_BASE = '/api';

// 全局状态
let state = {
    allData: [],
    currentDate: '',
    dates: [],
    departments: [],
    users: [],
    alerts: [],
    statusFilter: 'all',
    sortBy: 'default',
    compactMode: false,
    // 添加缓存避免重复请求
    lastRequestKey: '',
    cachedData: null,
    // 记录上次加载图表数据的日期
    lastChartDataDate: null,
    // 图表视图的独立数据（全量，不受卡片视图筛选影响）
    chartData: []
};

// 图表视图独立筛选状态
let chartState = {
    date: '',           // 图表数据的日期
    user: '',
    kpi: '',
    chartType: 'line'
};

// 层级视图独立状态
let hierarchyState = {
    date: '',
    department: 'all',
    user: 'all',
    dates: [],
    departments: [],
    users: []
};

// 报告视图独立状态
let reportState = {
    dateMode: 'day',    // 'day' | 'week'
    date: '',
    weekStart: '',
    user: '',
    dates: [],
    weeks: [],
    users: [],
    currentData: null
};

// 防抖函数：延迟执行，避免频繁触发
function debounce(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

function setStatusFilter(status) {
    state.statusFilter = status;
    document.querySelectorAll('#statusFilter .filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.status === status);
    });
    filterData();
}

function onSortChange() {
    const sortValue = document.getElementById('sortFilter').value;
    state.sortBy = sortValue;
    filterData();
}

function toggleCompactMode() {
    state.compactMode = !state.compactMode;
    const container = document.getElementById('cardsContainer');
    const toggleButton = document.getElementById('densityToggle');
    if (container) {
        container.classList.toggle('compact', state.compactMode);
    }
    if (toggleButton) {
        toggleButton.classList.toggle('active', state.compactMode);
        toggleButton.textContent = state.compactMode ? '🗂️ 标准模式' : '🗂️ 紧凑模式';
    }
    updateFilterSummary(state.filteredCount || 0, state.allData.length);
}

// 初始化应用 - 优化版：并行加载
async function init() {
    try {
        // 并行加载独立的资源：日期、部门、提醒
        const [datesResult, deptsResult, alertsResult] = await Promise.allSettled([
            loadDates(),
            loadDepartments(),
            loadAlerts()
        ]);

        // 检查加载结果
        if (datesResult.status === 'rejected') {
            console.error('加载日期失败:', datesResult.reason);
        }
        if (deptsResult.status === 'rejected') {
            console.error('加载部门失败:', deptsResult.reason);
        }
        if (alertsResult.status === 'rejected') {
            console.error('加载提醒失败:', alertsResult.reason);
        }

        // 初始化层级筛选器（依赖日期和部门）
        await initHierarchyFilters();

        // 加载KPI数据
        await filterData();

        // 数据加载完成后隐藏 loading
        hideLoading();
    } catch (error) {
        console.error('初始化失败:', error);
        hideLoading();
        showError('加载数据失败，请刷新页面重试');
    }
}

// 加载日期列表
async function loadDates() {
    try {
        const response = await fetch(`${API_BASE}/dates`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
            state.dates = result.data;
            const dateSelect = document.getElementById('dateFilter');
            dateSelect.innerHTML = state.dates.map(d =>
                `<option value="${d}">${d}</option>`
            ).join('');

            // 默认选择当前日期
            const today = new Date().toISOString().split('T')[0];
            if (state.dates.includes(today)) {
                state.currentDate = today;
                dateSelect.value = state.currentDate;
                console.log('📅 默认选择今天:', state.currentDate);
            } else if (state.dates.length > 0) {
                state.currentDate = state.dates[0];
                dateSelect.value = state.currentDate;
                console.log('📅 今天无数据，选择最新日期:', state.currentDate);
            }
        }
    } catch (error) {
        console.error('[loadDates] 加载失败:', error);
        showError('加载日期列表失败: ' + error.message);
    }
}

// 加载部门列表
async function loadDepartments() {
    try {
        const response = await fetch(`${API_BASE}/departments`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
            state.departments = result.data;
            const deptSelect = document.getElementById('departmentFilter');
            deptSelect.innerHTML = '<option value="all">全部部门</option>' +
                state.departments.map(d =>
                    `<option value="${d}">${d}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('[loadDepartments] 加载失败:', error);
        showError('加载部门列表失败: ' + error.message);
    }
}

// 部门变化处理函数（级联筛选：重置人员筛选并更新人员列表）
async function onDepartmentChange() {
    // 重置人员筛选为"全部人员"
    const userSelect = document.getElementById('userFilter');
    userSelect.value = 'all';

    // 执行筛选，这会触发人员列表的级联更新
    await filterData();
}

// 加载提醒
async function loadAlerts() {
    try {
        const response = await fetch(`${API_BASE}/alerts`);
        const result = await response.json();
        if (result.success) {
            state.alerts = result.data.filter(a => a.status === 'pending');
            updateAlertBadge();
        }
    } catch (error) {
        console.error('加载提醒失败:', error);
    }
}

// 筛选数据 - 原始函数
async function filterData() {
    showLoading();

    try {
        const date = document.getElementById('dateFilter').value;
        const department = document.getElementById('departmentFilter').value;

        // 如果日期改变且图表数据已存在，重新加载图表数据
        if (date && date !== state.lastChartDataDate) {
            await loadChartData();
            state.lastChartDataDate = date;
        }
        const user = document.getElementById('userFilter').value;
        const search = document.getElementById('searchInput').value.toLowerCase();

        if (date) state.currentDate = date;

        // 检查当前是否在层级展开视图，如果是则重新加载层级数据
        const hierarchyView = document.getElementById('hierarchyView');
        const isHierarchyViewActive = hierarchyView && hierarchyView.classList.contains('active');

        if (isHierarchyViewActive && date) {
            // 清除缓存，强制重新加载
            hierarchyData = null;
            expandedNodes.clear();
        }

        // 构建查询参数 - 使用手动URL编码以确保中文正确传输
        // 对于用户列表更新，使用更大的limit
        let url = `${API_BASE}/kpi?date=${encodeURIComponent(date)}`;
        if (department && department !== 'all') {
            url += `&department=${encodeURIComponent(department)}`;
        }
        if (user && user !== 'all') {
            url += `&user=${encodeURIComponent(user)}`;
        }
        // 增加limit以确保获取足够的数据用于更新用户列表（仅当未筛选用户时）
        if ((!user || user === 'all') && department !== 'all') {
            url += `&limit=1000`;
        }

        // 调试信息
        console.log('筛选参数:', { date, department, user, search });
        console.log('请求URL:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();

        if (result.success) {
            state.allData = result.data;
            console.log('后端返回数据条数:', result.data.length);

            // 🔍 调试：检查接收到的completion_rate值
            console.log('🔍 达成率调试 - 接收到的数据:');
            console.log('📅 当前日期:', date);
            result.data.slice(0, 3).forEach(d => {
                console.log(`  ${d.kpi_name}: completion_rate=${d.completion_rate} (类型:${typeof d.completion_rate}), 单位=${d.unit}, 目标=${d.target_value}, 实际=${d.actual_value}`);
            });

            // 应用搜索过滤
            let filteredData = state.allData;
            if (search) {
                filteredData = state.allData.filter(kpi =>
                    kpi.kpi_name.toLowerCase().includes(search) ||
                    kpi.user_name.toLowerCase().includes(search)
                );
            }

            filteredData = applyStatusFilter(filteredData);
            filteredData = applySort(filteredData);
            state.filteredCount = filteredData.length;
            console.log('筛选后数据条数:', filteredData.length);

            // 优化：直接从已获取的数据中更新用户列表，避免重复请求
            if (department === 'all') {
                // 选择全部部门时，需要获取该日期的所有用户
                // 如果当前数据不足以代表全部，则请求完整数据
                if (result.pagination && result.pagination.total > result.data.length) {
                    await loadAllUsersForDate();
                } else {
                    updateUserList(result.data);
                }
            } else {
                // 特定部门：直接从返回的数据更新用户列表
                updateUserList(result.data);
            }

            // 渲染视图
            renderCards(filteredData);
            renderStats(filteredData);
            updateFilterSummary(filteredData.length, state.allData.length);

            // 如果当前在图表视图，重新加载图表数据
            const chartView = document.getElementById('chartView');
            if (chartView && chartView.classList.contains('active')) {
                await loadChartData();
            }

            // 如果当前在日看板视图，重新渲染日看板
            const dailyView = document.getElementById('dailyView');
            if (dailyView && dailyView.classList.contains('active')) {
                await renderDailyBoard();
            }

            // 如果当前在层级展开视图，重新加载层级数据
            const hierarchyView = document.getElementById('hierarchyView');
            if (hierarchyView && hierarchyView.classList.contains('active')) {
                await renderHierarchyView();
            }
        } else {
            console.error('API返回失败:', result.message);
            showError('加载数据失败: ' + (result.message || '未知错误'));
        }
    } catch (error) {
        console.error('筛选数据失败:', error);
        showError('加载数据失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 防抖版本的筛选函数 - 用于搜索输入等频繁触发场景
const debouncedFilterData = debounce(filterData, 300);

// 加载当前日期的所有人员
async function loadAllUsersForDate() {
    try {
        const date = hierarchyState.date || state.currentDate;
        if (!date) return;

        const response = await fetch(`${API_BASE}/kpi?date=${encodeURIComponent(date)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();

        if (result.success) {
            updateUserList(result.data);
        }
    } catch (error) {
        console.error('[loadAllUsersForDate] 加载失败:', error);
    }
}

// 更新用户列表
function updateUserList(data) {
    const userSet = new Set();
    data.forEach(kpi => userSet.add(kpi.user_name));
    state.users = Array.from(userSet).sort();

    const userSelect = document.getElementById('userFilter');
    const currentValue = userSelect.value;
    userSelect.innerHTML = '<option value="all">全部人员</option>' +
        state.users.map(u =>
            `<option value="${u}">${u}</option>`
        ).join('');
    if (state.users.includes(currentValue)) {
        userSelect.value = currentValue;
    }
}

function getCompletionInfo(kpi) {
    const kpiDirection = getKpiDirection(kpi);
    const targetVal = parseFloat(kpi.target_value);
    const actualVal = parseFloat(kpi.actual_value);
    const isEmpty = Number.isNaN(targetVal) || Number.isNaN(actualVal);
    let completionRate = 0;

    if (!isEmpty && targetVal > 0 && actualVal > 0) {
        completionRate = actualVal / targetVal;
    }

    const statusClass = getCompletionStatusClass(completionRate, kpiDirection, targetVal, actualVal);

    return {
        completionRate,
        statusClass,
        isEmpty,
        targetVal,
        actualVal
    };
}

function applyStatusFilter(data) {
    if (state.statusFilter === 'all') {
        return data;
    }

    return data.filter(kpi => {
        const info = getCompletionInfo(kpi);
        if (state.statusFilter === 'empty') {
            return info.isEmpty;
        }
        return info.statusClass === state.statusFilter;
    });
}

function applySort(data) {
    if (state.sortBy === 'default') {
        return data;
    }

    const sorted = [...data];
    const sortKey = (kpi, key) => {
        const info = getCompletionInfo(kpi);
        if (key === 'completion') {
            return info.isEmpty ? -Infinity : info.completionRate;
        }
        if (key === 'target') {
            return Number.isNaN(info.targetVal) ? -Infinity : info.targetVal;
        }
        if (key === 'actual') {
            return Number.isNaN(info.actualVal) ? -Infinity : info.actualVal;
        }
        return 0;
    };

    const [key, direction] = state.sortBy.split('-');
    sorted.sort((a, b) => {
        const valA = sortKey(a, key);
        const valB = sortKey(b, key);
        if (valA === valB) return 0;
        return direction === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
}

function getStatusLabel() {
    const map = {
        all: '全部',
        excellent: '达标',
        good: '警告',
        poor: '未达标',
        empty: '空白'
    };
    return map[state.statusFilter] || '全部';
}

function getSortLabel() {
    const map = {
        default: '默认',
        'completion-desc': '达成率高→低',
        'completion-asc': '达成率低→高',
        'target-desc': '目标值高→低',
        'target-asc': '目标值低→高',
        'actual-desc': '实际值高→低',
        'actual-asc': '实际值低→高'
    };
    return map[state.sortBy] || '默认';
}

function updateFilterSummary(filteredCount, totalCount) {
    const date = document.getElementById('dateFilter')?.value || '';
    const department = document.getElementById('departmentFilter')?.value || '';
    const user = document.getElementById('userFilter')?.value || '';
    const search = document.getElementById('searchInput')?.value.trim() || '';
    const summary = document.getElementById('filterSummary');

    if (!summary) return;

    const chips = [];
    if (date) chips.push(`日期：${date}`);
    if (department && department !== 'all') chips.push(`部门：${department}`);
    if (user && user !== 'all') chips.push(`人员：${user}`);
    if (search) chips.push(`搜索：“${search}”`);
    if (state.statusFilter !== 'all') chips.push(`状态：${getStatusLabel()}`);
    if (state.sortBy !== 'default') chips.push(`排序：${getSortLabel()}`);
    if (state.compactMode) chips.push('模式：紧凑');

    summary.innerHTML = `
        <div class="summary-text">筛选结果 ${filteredCount} / ${totalCount} 条</div>
        <div class="summary-chips">
            ${chips.map(chip => `<span class="summary-chip">${chip}</span>`).join('')}
        </div>
    `;
}

// 渲染卡片视图
function renderCards(data) {
    const container = document.getElementById('cardsContainer');

    container.classList.toggle('compact', state.compactMode);
    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
    }

    container.innerHTML = data.map(kpi => createKpiCard(kpi)).join('');
}

// 创建KPI卡片
function createKpiCard(kpi) {
    const info = getCompletionInfo(kpi);
    const completionRate = info.completionRate * 100;
    const displayRate = info.isEmpty ? '—' : completionRate.toFixed(2);

    const statusClass = info.isEmpty ? 'empty' : info.statusClass;
    const statusIcon = info.isEmpty
        ? '⚪'
        : getCompletionStatusIcon(
            info.completionRate,
            getKpiDirection(kpi),
            info.targetVal,
            info.actualVal
        );
    // 进度条宽度
    const progressWidth = Math.min(completionRate || 0, 200);

    return `
        <div class="kpi-card ${statusClass}" onclick="showKpiDetail('${kpi.id}')">
            <div class="kpi-header">
                <div>
                    <div class="kpi-name">${kpi.kpi_name}</div>
                    <div class="kpi-user">${kpi.department} - ${kpi.user_name}</div>
                </div>
                <div class="kpi-status">${statusIcon}</div>
            </div>
            <div class="kpi-values">
                <div class="kpi-value-item">
                    <div class="kpi-value-label">目标值</div>
                    <div class="kpi-value">${formatValue(kpi.target_value, kpi.unit)}</div>
                </div>
                <div class="kpi-value-item">
                    <div class="kpi-value-label">实际值</div>
                    <div class="kpi-value">${formatValue(kpi.actual_value, kpi.unit)}</div>
                </div>
            </div>
            <div class="kpi-progress">
                <div class="progress-bar">
                    <div class="progress-fill ${statusClass}" style="width: ${progressWidth}%"></div>
                </div>
                <div class="progress-text">${displayRate}%</div>
            </div>
        </div>
    `;
}

// 渲染统计概览
function renderStats(data) {
    // 计算统计数据（与图标完全对应）
    const stats = {
        total: data.length,
        excellent: 0,  // ✅ 达标
        good: 0,       // ⚠️ 警告
        poor: 0,       // ❌ 未达标
        empty: 0,      // ⚪ 空白
        departments: new Set(),
        users: new Set()
    };

    data.forEach(kpi => {
        stats.departments.add(kpi.department);
        stats.users.add(kpi.user_name);

        const info = getCompletionInfo(kpi);

        if (info.isEmpty) {
            stats.empty++;
            return;
        }

        if (info.statusClass === 'excellent') {
            stats.excellent++;
        } else if (info.statusClass === 'good') {
            stats.good++;
        } else {
            stats.poor++;
        }
    });

    document.getElementById('statsOverview').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">总KPI数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: var(--success-color)">${stats.excellent}</div>
            <div class="stat-label">✅ 达标</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: var(--warning-color)">${stats.good}</div>
            <div class="stat-label">⚠️ 警告</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: var(--danger-color)">${stats.poor}</div>
            <div class="stat-label">❌ 未达标</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: #95a5a6">${stats.empty}</div>
            <div class="stat-label">⚪ 空白</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.departments.size}</div>
            <div class="stat-label">部门数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.users.size}</div>
            <div class="stat-label">人员数</div>
        </div>
    `;

    // 渲染统计视图
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">总KPI数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value excellent">${stats.excellent}</div>
            <div class="stat-label">✅ 达标</div>
        </div>
        <div class="stat-card">
            <div class="stat-value good">${stats.good}</div>
            <div class="stat-label">⚠️ 警告</div>
        </div>
        <div class="stat-card">
            <div class="stat-value poor">${stats.poor}</div>
            <div class="stat-label">❌ 未达标</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: #95a5a6">${stats.empty}</div>
            <div class="stat-label">⚪ 空白</div>
        </div>
    `;
}

// 判断KPI名称是否为反向指标（辅助函数）
function isReverseKpiByName(kpiName) {
    if (!kpiName) return false;

    // 特殊情况：成本控制类是正向指标
    if (kpiName.includes('成本控制') || kpiName.includes('费用控制')) {
        return false;
    }

    const reverseTypes = [
        '成本', '费用', '消耗',
        '不合格率', '缺陷率', '报废率', '不良率', '投诉率',
        '流失率', '离职率', '人员流失',
        '退货率', '拒收率', '差错率', '失误率',
        '库存天数', '周转天数', '停机时间'
    ];
    return reverseTypes.some(type => kpiName.includes(type));
}

// 获取KPI方向（优先使用后端字段，但在名称明显反向时纠正）
function getKpiDirection(kpi) {
    if (!kpi) return 'forward';

    const kpiName = kpi.kpi_name || '';
    const nameSuggestsReverse = kpiName ? isReverseKpiByName(kpiName) : false;
    const rawDirection = typeof kpi.kpi_direction === 'string' ? kpi.kpi_direction.trim() : '';

    if (rawDirection === 'reverse') return 'reverse';
    if (rawDirection === 'forward') {
        return nameSuggestsReverse ? 'reverse' : 'forward';
    }

    return nameSuggestsReverse ? 'reverse' : 'forward';
}

// 获取完成率状态类（考虑KPI方向）
// rate 参数是原始值（如 1.11 表示 111%），需先乘以100转换为百分比再判断
function getCompletionStatusClass(rate, kpiDirection = 'forward', targetValue = null, actualValue = null) {
    // 特殊情况：当目标=0 且 实际=0 时，标识为达标
    if (targetValue === 0 && actualValue === 0) {
        return 'excellent';
    }

    if (rate === null || rate === undefined) return 'poor';

    // 🔧 统一转换为百分比形式（如 1.11 → 111）
    const percentRate = rate * 100;

    if (kpiDirection === 'reverse') {
        // 反向指标：越低越好（成本类）
        // 达成率计算公式：实际/目标 × 100%（与正向指标相同）
        // 实际<=目标 → 达成率<=100%（好事，excellent）
        // 实际>目标 → 达成率>100%（坏事，poor）
        if (percentRate <= 100) return 'excellent';  // 实际低于或等于目标，绿色
        if (percentRate <= 120) return 'good';       // 轻微超过目标，黄色
        return 'poor';                              // 严重超过目标，红色
    } else {
        // 正向指标：越高越好
        if (percentRate >= 100) return 'excellent';
        if (percentRate >= 80) return 'good';
        return 'poor';
    }
}

// 获取完成率状态图标（考虑KPI方向）
// rate 参数是原始值（如 1.11 表示 111%），需先乘以100转换为百分比再判断
function getCompletionStatusIcon(rate, kpiDirection = 'forward', targetValue = null, actualValue = null) {
    // 特殊情况：当目标=0 且 实际=0 时，标识为达标
    if (targetValue === 0 && actualValue === 0) {
        return '✅';
    }

    if (rate === null || rate === undefined) return '⚪';

    // 🔧 统一转换为百分比形式（如 1.11 → 111）
    const percentRate = rate * 100;

    if (kpiDirection === 'reverse') {
        // 反向指标：越低越好（成本类）
        // 达成率计算公式：实际/目标 × 100%（与正向指标相同）
        // 实际<=目标 → 达成率<=100%（好事，✅）
        // 实际>目标 → 达成率>100%（坏事，❌）
        if (percentRate <= 100) return '✅';  // 实际低于或等于目标，绿色勾
        if (percentRate <= 120) return '⚠️';  // 轻微超过目标，黄色警告
        return '❌';                          // 严重超过目标，红色叉
    } else {
        // 正向指标：越高越好
        if (percentRate >= 100) return '✅';
        if (percentRate >= 80) return '⚠️';
        return '❌';
    }
}

// 格式化数值（最多保留2位小数，保留千位分隔符）
function formatValue(value, unit) {
    if (value === null || value === undefined) return '-';
    // 转换为数字，最多保留2位小数
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    // 先四舍五入到2位小数
    const rounded = Math.round(num * 100) / 100;
    // 使用toLocaleString添加千位分隔符，同时设置最大小数位数为2
    const formatted = rounded.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    return `${formatted} ${unit || ''}`;
}

// 显示/隐藏加载中
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// 切换视图
async function switchView(viewName) {
    console.log('===== switchView called with:', viewName, '=====');

    // 更新标签状态
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.view === viewName) {
            tab.classList.add('active');
        }
    });

    // 更新视图内容
    document.querySelectorAll('.view-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetView = document.getElementById(`${viewName}View`);
    if (targetView) {
        targetView.classList.add('active');
    } else {
        console.error('View not found:', `${viewName}View`);
    }

    // 如果切换到图表视图，加载完整数据并更新图表选项
    if (viewName === 'chart') {
        await loadChartData();
    }

    // 如果切换到日看板视图，直接渲染（复用卡片视图数据）
    if (viewName === 'daily') {
        await renderDailyBoard();
    }

    // 如果切换到层级展开视图，初始化筛选器并渲染层级数据
    if (viewName === 'hierarchy') {
        console.log('Loading hierarchy view...');
        await initHierarchyFilters();
    }

    // 如果切换到报告视图，初始化筛选器
    if (viewName === 'report') {
        console.log('Loading report view...');
        await initReportFilters();
    }
}

// 加载图表数据（当前日期的完整数据）
async function loadChartData() {
    // 始终更新图表数据，无论当前在哪个视图
    await updateChartOptions();
}

// 更新图表视图的选项（人员列表和KPI列表）
// 这个函数会重新从API获取数据，确保数据是最新且完整的
async function updateChartOptions() {
    const userSelect = document.getElementById('chartUser');
    const kpiSelect = document.getElementById('chartKpi');

    // 获取当前日期，加载该日期的完整数据（不受部门筛选影响）
    const date = state.currentDate || document.getElementById('dateFilter')?.value;
    if (!date) return;

    console.log(`[updateChartOptions] ========== 开始加载图表数据 ==========`);
    console.log(`[updateChartOptions] 日期: ${date}`);
    console.log(`[updateChartOptions] API_BASE: ${API_BASE}`);

    try {
        // 请求当前日期的完整数据，不应用部门筛选
        // 增加 limit=5000 确保获取所有数据
        const url = `${API_BASE}/kpi?date=${encodeURIComponent(date)}&limit=5000`;
        console.log(`[updateChartOptions] 请求URL: ${url}`);

        const response = await fetch(url);
        console.log(`[updateChartOptions] 响应状态: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error(`[updateChartOptions] HTTP ${response.status}`);
            return;
        }

        const result = await response.json();
        console.log(`[updateChartOptions] API返回结果:`, result);

        if (result.success) {
            // 保存数据日期到 chartState
            chartState.date = date;

            // 更新图表数据缓存
            state.chartData = result.data;

            const data = result.data;
            const users = [...new Set(data.map(k => k.user_name))].sort();
            const kpis = [...new Set(data.map(k => k.kpi_name))].sort();
            const depts = [...new Set(data.map(k => k.department))].sort();

            console.log(`[updateChartOptions] ✅ result.success = true`);
            console.log(`[updateChartOptions] 图表数据日期: ${chartState.date}`);
            console.log(`[updateChartOptions] result.data.length = ${data.length}`);
            console.log(`[updateChartOptions] result.pagination.total = ${result.pagination?.total}`);
            console.log(`[updateChartOptions] state.chartData.length = ${state.chartData.length}`);
            console.log(`[updateChartOptions] 部门 (${depts.length}): ${depts.join(', ')}`);
            console.log(`[updateChartOptions] 人员 (${users.length}): ${users.join(', ')}`);
            console.log(`[updateChartOptions] KPI (${kpis.length}): ${kpis.join(', ')}`);

            if (depts.includes('财务部')) {
                console.log('[updateChartOptions] ✅ 包含财务部');
            } else {
                console.warn('[updateChartOptions] ⚠️ 不包含财务部');
            }

            if (users.includes('王盼')) {
                console.log('[updateChartOptions] ✅ 包含王盼');
            } else {
                console.warn('[updateChartOptions] ⚠️ 不包含王盼');
            }

            // 获取筛选栏中已选择的人员
            const selectedUser = document.getElementById('userFilter')?.value;

            userSelect.innerHTML = '<option value="">选择人员...</option>' +
                users.map(u => `<option value="${u}">${u}</option>`).join('');

            // 初始KPI列表（显示所有KPI）
            updateKpiListBasedOnUser(data, kpis, kpiSelect);

            // 同步筛选栏中已选择的人员
            // 如果选择的是特定人员（不是"全部人员"），则在图表视图也默认选中该人员
            if (selectedUser && selectedUser !== 'all' && userSelect) {
                userSelect.value = selectedUser;
                // 更新KPI列表为该人员的KPI
                updateKpiListBasedOnUser(data, kpis, kpiSelect, selectedUser);
                console.log(`[updateChartOptions] 已同步人员选择: ${selectedUser}`);
            }

            console.log(`[updateChartOptions] ✅ 已更新选项`);
            console.log(`[updateChartOptions] ========== 完成 ==========`);
        } else {
            console.error(`[updateChartOptions] ❌ API返回失败: ${result.message}`);
            console.error(`[updateChartOptions] result.success = ${result.success}`);
        }
    } catch (error) {
        console.error('[updateChartOptions] ❌ 更新失败:', error);
        console.error(`[updateChartOptions] 错误堆栈:`, error.stack);
    }
}

// 根据选择的人员更新KPI列表
function updateKpiListBasedOnUser(data, allKpis, kpiSelect, selectedUser = null) {
    const userValue = selectedUser || document.getElementById('chartUser')?.value;

    if (userValue) {
        // 如果选择了人员，只显示该人员的KPI
        const userKpis = [...new Set(data.filter(k => k.user_name === userValue).map(k => k.kpi_name))].sort();
        kpiSelect.innerHTML = '<option value="">选择KPI...</option>' +
            userKpis.map(k => `<option value="${k}">${k}</option>`).join('');
        console.log(`[updateKpiListBasedOnUser] 人员 ${userValue} 的KPI: ${userKpis.join(', ')}`);
    } else {
        // 如果未选择人员，显示所有KPI
        kpiSelect.innerHTML = '<option value="">选择KPI...</option>' +
            allKpis.map(k => `<option value="${k}">${k}</option>`).join('');
        console.log(`[updateKpiListBasedOnUser] 显示所有KPI: ${allKpis.join(', ')}`);
    }
}

// 图表人员变更时触发
function onChartUserChange() {
    const data = state.chartData || [];
    const kpis = [...new Set(data.map(k => k.kpi_name))].sort();
    const kpiSelect = document.getElementById('chartKpi');

    // 更新KPI列表
    updateKpiListBasedOnUser(data, kpis, kpiSelect);

    // 更新图表
    updateChart();
}

// 渲染日看板（HTML表格，使用卡片视图的数据）
async function renderDailyBoard() {
    const container = document.getElementById('dailyContainer');

    // 直接使用 state.allData（与卡片视图共享数据）
    const data = state.allData || [];

    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
    }

    // 按人员分组数据
    const userData = {};
    data.forEach(kpi => {
        if (!userData[kpi.user_name]) {
            userData[kpi.user_name] = [];
        }
        userData[kpi.user_name].push(kpi);
    });

    const users = Object.keys(userData).sort();
    const dataDate = state.currentDate || data[0]?.date || '';

    console.log(`[renderDailyBoard] 渲染日看板，共 ${users.length} 个人员`);
    console.log(`[renderDailyBoard] 数据日期: ${dataDate}`);

    // 清空容器
    container.innerHTML = '';

    // 为每个人员创建一个表格
    users.forEach(userName => {
        const userKpis = userData[userName];

        // 创建人员标题
        const title = document.createElement('h3');
        title.className = 'dashboard-title';
        title.textContent = `${userName} (${dataDate})`;
        title.style.cssText = 'text-align: left; margin: 30px 0 15px 0; color: #2c3e50;';

        // 创建表格
        const table = document.createElement('table');
        table.className = 'dashboard-table';
        table.style.cssText = 'width: 50%; max-width: 800px; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin: 0 0 20px 0;';

        // 创建表头
        const thead = document.createElement('thead');
        thead.style.cssText = 'background: #34495e; color: white;';
        thead.innerHTML = `
            <tr>
                <th style="padding: 12px; text-align: left;">KPI名称</th>
                <th style="padding: 12px; text-align: center; width: 80px;">状态</th>
                <th style="padding: 12px; text-align: center; width: 100px;">完成率</th>
            </tr>
        `;

        // 创建表体
        const tbody = document.createElement('tbody');

        userKpis.forEach(kpi => {
            // ===== 与卡片视图完全相同的逻辑 =====
            // 获取KPI方向（与卡片视图一致）
            const kpiDirection = getKpiDirection(kpi);

            // 根据正反向指标，用原始数据计算达成率（与卡片视图一致）
            // 统一公式：达成率 = 实际值 / 目标值 × 100%
            let completionRate = 0;
            const targetVal = parseFloat(kpi.target_value) || 0;
            const actualVal = parseFloat(kpi.actual_value) || 0;

            if (targetVal > 0 && actualVal > 0) {
                // 统一使用 实际/目标 × 100%，正反向指标只在状态判断时有区别
                completionRate = (actualVal / targetVal) * 100;
            }

            const displayRate = completionRate.toFixed(1);

            // 状态判断使用原始比率（completionRate / 100），与卡片视图完全一致
            const statusIcon = getCompletionStatusIcon(completionRate / 100, kpiDirection, targetVal, actualVal);

            // 根据图标确定样式类
            let statusClass = '';
            if (statusIcon === '✅') {
                statusClass = 'status-excellent';
            } else if (statusIcon === '⚠️') {
                statusClass = 'status-warning';
            } else if (statusIcon === '❌') {
                statusClass = 'status-poor';
            } else {
                statusClass = 'status-empty';
            }

            // 调试日志
            console.log(`[日看板] ${kpi.kpi_name}: target=${targetVal}, actual=${actualVal}, direction=${kpiDirection}, rate=${completionRate}%`);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 12px; border-bottom: 1px solid #ecf0f1;">${kpi.kpi_name}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ecf0f1;">
                    <span class="status-icon ${statusClass}">${statusIcon}</span>
                </td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ecf0f1;">
                    ${completionRate > 0 ? displayRate + '%' : '-'}
                </td>
            `;

            // 隔行变色
            if (userKpis.indexOf(kpi) % 2 === 0) {
                row.style.background = '#f8f9fa';
            }

            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        // 添加样式（只添加一次）
        if (users.indexOf(userName) === 0) {
            const style = document.createElement('style');
            style.textContent = `
                .status-icon {
                    font-size: 20px;
                    font-weight: bold;
                }
                .status-excellent {
                    color: #27ae60;
                }
                .status-warning {
                    color: #f39c12;
                }
                .status-poor {
                    color: #e74c3c;
                }
                .status-empty {
                    color: #95a5a6;
                }
                .dashboard-table tbody tr:hover {
                    background: #e8f8f5 !important;
                }
            `;
            container.appendChild(style);
        }

        container.appendChild(title);
        container.appendChild(table);
    });
}

// 刷新数据
async function refreshData() {
    await loadAlerts();
    await filterData();
}

// 显示提醒
function showAlerts() {
    const modal = document.getElementById('alertModal');
    const list = document.getElementById('alertList');

    if (state.alerts.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无提醒</div>';
    } else {
        list.innerHTML = state.alerts.map(alert => `
            <div class="alert-item ${alert.type}">
                <div class="alert-header">
                    <span class="alert-user">${alert.user_name} (${alert.department})</span>
                    <span class="alert-date">${alert.date}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-actions">
                    <button class="btn-small" onclick="markAlertRead(${alert.id})">标记已读</button>
                </div>
            </div>
        `).join('');
    }

    modal.classList.add('active');
}

// 关闭提醒弹窗
function closeAlertModal() {
    document.getElementById('alertModal').classList.remove('active');
}

// 标记提醒已读
async function markAlertRead(alertId) {
    const response = await fetch(`${API_BASE}/alerts/${alertId}/read`, {
        method: 'PUT'
    });
    if (response.ok) {
        state.alerts = state.alerts.filter(a => a.id !== alertId);
        updateAlertBadge();
        showAlerts();
    }
}

// 更新提醒角标
function updateAlertBadge() {
    document.getElementById('alertCount').textContent = state.alerts.length;
}

// 显示KPI详情
function showKpiDetail(kpiId) {
    const kpi = state.allData.find(k => k.id === kpiId);
    if (!kpi) return;

    // 获取KPI方向
    let kpiDirection = 'forward';
    if (kpi.kpi_direction && kpi.kpi_direction !== '') {
        kpiDirection = kpi.kpi_direction;
    } else if (kpi.kpi_type && isReverseKpiByName(kpi.kpi_type)) {
        kpiDirection = 'reverse';
    }

    // 根据正反向指标计算达成率
    // 统一公式：达成率 = 实际值 / 目标值 × 100%
    let completionRate = 0;
    const targetVal = parseFloat(kpi.target_value) || 0;
    const actualVal = parseFloat(kpi.actual_value) || 0;

    if (targetVal > 0 && actualVal > 0) {
        // 统一使用 实际/目标 × 100%，正反向指标只在状态判断时有区别
        completionRate = (actualVal / targetVal) * 100;
    }

    document.getElementById('kpiModalTitle').textContent = kpi.kpi_name;
    document.getElementById('kpiModalBody').innerHTML = `
        <div class="kpi-detail">
            <p><strong>部门:</strong> ${kpi.department}</p>
            <p><strong>岗位:</strong> ${kpi.position}</p>
            <p><strong>姓名:</strong> ${kpi.user_name}</p>
            <p><strong>KPI类型:</strong> ${kpi.kpi_type || '-'}</p>
            <hr>
            <p><strong>目标值:</strong> ${formatValue(kpi.target_value, kpi.unit)}</p>
            <p><strong>实际值:</strong> ${formatValue(kpi.actual_value, kpi.unit)}</p>
            <p><strong>完成率:</strong> ${completionRate.toFixed(2)}%</p>
            <p><strong>数据日期:</strong> ${kpi.date}</p>
            <p><strong>更新时间:</strong> ${kpi.updated_at || '-'}</p>
            ${kpi.remark ? `<p><strong>备注:</strong> ${kpi.remark}</p>` : ''}
        </div>
    `;
    document.getElementById('kpiModal').classList.add('active');
}

// 关闭KPI详情弹窗
function closeKpiModal() {
    document.getElementById('kpiModal').classList.remove('active');
}

// 显示错误
function showError(message) {
    alert(message);
}

// 导出移动端独立HTML文件（支持筛选）
async function exportMobileHTML() {
    if (!state.currentDate) {
        showError('请先选择日期');
        return;
    }

        const date = hierarchyState.date || state.currentDate;
        const timestamp = new Date().toISOString().slice(0, 10);

        const activeTab = document.querySelector('.view-tab.active');
        const isHierarchyTabActive = activeTab && activeTab.dataset && activeTab.dataset.view === 'hierarchy';
        const hasHierarchyContext = hierarchyState && (hierarchyState.department !== 'all' || hierarchyState.user !== 'all' || hierarchyState.date);
        const shouldExportHierarchy = isHierarchyTabActive || (!!hierarchyData && hasHierarchyContext);
        const initialDepartment = shouldExportHierarchy ? (hierarchyState.department || 'all') : 'all';
        const initialUser = shouldExportHierarchy ? (hierarchyState.user || 'all') : 'all';

    // 获取当前日期的完整数据（不受筛选影响）
    showLoading();
    try {
        const response = await fetch(`${API_BASE}/kpi?date=${encodeURIComponent(date)}&limit=10000`);
        const result = await response.json();

        if (!result.success || result.data.length === 0) {
            showError(`日期 ${date} 暂无数据可导出`);
            hideLoading();
            return;
        }

        const fullData = result.data;

        let exportHierarchyData = shouldExportHierarchy ? hierarchyData : null;
        if (shouldExportHierarchy) {
            try {
                const hierarchyResponse = await fetch(`${API_BASE}/kpi/hierarchy?date=${encodeURIComponent(date)}`);
                if (!hierarchyResponse.ok) {
                    throw new Error(`HTTP ${hierarchyResponse.status}: ${hierarchyResponse.statusText}`);
                }
                const hierarchyResult = await hierarchyResponse.json();
                if (hierarchyResult.success) {
                    exportHierarchyData = hierarchyResult.data;
                }
            } catch (error) {
                console.warn('导出层级数据失败:', error);
            }
        }

        // 提取所有部门和人员列表
        const departments = [...new Set(fullData.map(k => k.department))].sort();
        const users = [...new Set(fullData.map(k => k.user_name))].sort();
        const dates = [...new Set(fullData.map(k => k.date))].sort().reverse();

        const dataStr = JSON.stringify({
            allData: fullData,
            departments: departments,
            users: users,
            dates: dates,
            hierarchyData: exportHierarchyData,
            isHierarchyExport: shouldExportHierarchy,
            initialDepartment: initialDepartment,
            initialUser: initialUser
        });

    // 构建独立的HTML文件
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>方针管理KPI看板 - ${date}</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--primary:#2c3e50;--accent:#3498db;--success:#27ae60;--warning:#f39c12;--danger:#e74c3c;--light:#ecf0f1;--card:#ffffff}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--light);color:var(--primary);line-height:1.6;padding:10px}
        .header{background:linear-gradient(135deg,#2c3e50,#34495e);color:white;padding:12px 15px;border-radius:8px;margin-bottom:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
        .header h1{font-size:16px;font-weight:600;margin-bottom:4px}
        .header p{font-size:12px;opacity:0.8}
        .filter-info{background:white;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:13px;display:flex;flex-wrap:wrap;gap:8px;box-shadow:0 2px 6px rgba(0,0,0,0.05)}
        .filter-item{background:var(--light);padding:4px 10px;border-radius:12px;font-size:12px}
        .kpi-card{background:white;border-radius:12px;padding:12px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
        .kpi-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:10px}
        .kpi-name{font-size:14px;font-weight:600;color:var(--primary);margin-bottom:4px}
        .kpi-user{font-size:11px;color:#7f8c8d}
        .kpi-status{font-size:18px}
        .kpi-values{display:flex;gap:15px;margin-bottom:10px}
        .kpi-value-item{flex:1}
        .kpi-value-label{font-size:11px;color:#7f8c8d;margin-bottom:2px}
        .kpi-value{font-size:16px;font-weight:600;color:var(--primary)}
        .kpi-progress{margin-top:8px}
        .progress-bar{width:100%;height:8px;background:var(--light);border-radius:4px;overflow:hidden}
        .progress-fill{height:100%;border-radius:4px;transition:width 0.3s}
        .progress-text{text-align:center;font-size:12px;margin-top:4px;font-weight:600}
        .excellent .progress-fill{background:var(--success)}
        .good .progress-fill{background:var(--warning)}
        .poor .progress-fill{background:var(--danger)}
        .excellent .progress-text{color:var(--success)}
        .good .progress-text{color:var(--warning)}
        .poor .progress-text{color:var(--danger)}
        .filter-bar{background:white;padding:12px;border-radius:8px;margin-bottom:12px;box-shadow:0 2px 6px rgba(0,0,0,0.05)}
        .filter-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
        .filter-group{flex:1;min-width:120px}
        .filter-group label{display:block;font-size:11px;color:#7f8c8d;margin-bottom:4px}
        .filter-select{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:white}
        .filter-select:focus{outline:none;border-color:var(--accent)}
        .search-box{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
        .stat-card{background:white;padding:10px;border-radius:8px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.05)}
        .stat-value{font-size:18px;font-weight:600;margin-bottom:2px}
        .stat-label{font-size:11px;color:#7f8c8d}
        .hierarchy-tree{margin-bottom:16px}
        .hierarchy-tree-title{font-size:14px;font-weight:600;color:var(--primary);margin-bottom:8px;padding:6px 10px;background:linear-gradient(to right, rgba(52,152,219,0.12), transparent);border-left:3px solid var(--accent)}
        .hierarchy-node{margin-bottom:8px}
        .hierarchy-node-children{margin-left:12px;padding-left:12px;border-left:2px dashed #ddd;overflow:hidden;max-height:0;opacity:0;transition:max-height 0.3s ease-out, opacity 0.3s ease-out}
        .hierarchy-node-children.expanded{max-height:10000px;opacity:1;transition:max-height 0.4s ease-in, opacity 0.3s ease-in}
        .hierarchy-card{background:white;border-radius:10px;padding:10px 12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);display:flex;align-items:center;gap:10px}
        .hierarchy-card.level-1{border-left:4px solid #667eea;background:linear-gradient(to right, rgba(102,126,234,0.06), transparent)}
        .hierarchy-card.level-2{border-left:4px solid #f5576c;background:linear-gradient(to right, rgba(245,87,108,0.06), transparent)}
        .hierarchy-card.level-3{border-left:4px solid #00f2fe;background:linear-gradient(to right, rgba(0,242,254,0.06), transparent)}
        .hierarchy-level-badge{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap}
        .hierarchy-card.level-1 .hierarchy-level-badge{background:linear-gradient(135deg,#667eea,#764ba2);color:white}
        .hierarchy-card.level-2 .hierarchy-level-badge{background:linear-gradient(135deg,#f093fb,#f5576c);color:white}
        .hierarchy-card.level-3 .hierarchy-level-badge{background:linear-gradient(135deg,#4facfe,#00f2fe);color:white}
        .hierarchy-card-content{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center}
        .hierarchy-card-header{display:flex;flex-direction:column;gap:2px}
        .hierarchy-card-kpi-name{font-weight:600;color:var(--primary);font-size:13px}
        .hierarchy-card-user-info{font-size:11px;color:#7f8c8d}
        .hierarchy-card-value{display:flex;flex-direction:column}
        .hierarchy-card-value-label{font-size:10px;color:#7f8c8d}
        .hierarchy-card-value-number{font-size:12px;font-weight:600;color:var(--primary)}
        .hierarchy-card-completion-rate{font-size:12px;font-weight:600}
        .hierarchy-card-completion-rate.excellent{color:var(--success)}
        .hierarchy-card-completion-rate.good{color:var(--warning)}
        .hierarchy-card-completion-rate.poor{color:var(--danger)}
        .hierarchy-expand-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--light);border-radius:50%;cursor:pointer;transition:all 0.2s;flex-shrink:0}
        .hierarchy-expand-btn.expanded{transform:rotate(180deg);background:var(--accent);color:white}
        .hierarchy-expand-btn svg{width:14px;height:14px}
        @media(max-width:480px){.stats{grid-template-columns:repeat(2,1fr)}.kpi-values{flex-wrap:wrap;gap:10px}.filter-group{min-width:100px}.hierarchy-card-content{grid-template-columns:1fr}.hierarchy-node-children{margin-left:8px;padding-left:8px}}
    </style>
</head>
<body>
    <div class="header">
        <h1>方针管理KPI日经营看板</h1>
        <p>导出时间：${timestamp}</p>
    </div>
    <div class="filter-bar">
        <div class="filter-row">
            <div class="filter-group">
                <label>📅 日期</label>
                <select id="dateFilter" class="filter-select" onchange="filterData()">
                    <option value="all">全部日期</option>
                </select>
            </div>
            <div class="filter-group">
                <label>🏢 部门</label>
                <select id="deptFilter" class="filter-select" onchange="onDeptChange()">
                    <option value="all">全部部门</option>
                </select>
            </div>
            <div class="filter-group">
                <label>👤 人员</label>
                <select id="userFilter" class="filter-select" onchange="filterData()">
                    <option value="all">全部人员</option>
                </select>
            </div>
        </div>
        <div class="filter-row">
            <div class="filter-group" style="flex:2">
                <input type="text" id="searchInput" class="search-box" placeholder="🔍 搜索KPI名称..." oninput="filterData()">
            </div>
        </div>
    </div>
    <div id="app"></div>
    <script>
        const dataBundle = ${dataStr};
        const state = {
            allData: dataBundle.allData,
            departments: dataBundle.departments,
            users: dataBundle.users,
            dates: dataBundle.dates,
            hierarchyData: dataBundle.hierarchyData,
            isHierarchyExport: dataBundle.isHierarchyExport,
            initialDepartment: dataBundle.initialDepartment,
            initialUser: dataBundle.initialUser,
            filteredData: dataBundle.allData
        };

        if (state.isHierarchyExport && (!state.hierarchyData || Object.keys(state.hierarchyData).length === 0)) {
            state.isHierarchyExport = false;
        }

        function isReverseKpiByName(kpiName) {
            if (!kpiName) return false;

            if (kpiName.includes('成本控制') || kpiName.includes('费用控制')) {
                return false;
            }

            const reverseTypes = [
                '成本', '费用', '消耗',
                '不合格率', '缺陷率', '报废率', '不良率', '投诉率',
                '流失率', '离职率', '人员流失',
                '退货率', '拒收率', '差错率', '失误率',
                '库存天数', '周转天数', '停机时间'
            ];
            return reverseTypes.some(type => kpiName.includes(type));
        }

        function getKpiDirection(kpi) {
            if (!kpi) return 'forward';

            const kpiName = kpi.kpi_name || '';
            const nameSuggestsReverse = kpiName ? isReverseKpiByName(kpiName) : false;
            const rawDirection = typeof kpi.kpi_direction === 'string' ? kpi.kpi_direction.trim() : '';

            if (rawDirection === 'reverse') return 'reverse';
            if (rawDirection === 'forward') {
                return nameSuggestsReverse ? 'reverse' : 'forward';
            }

            return nameSuggestsReverse ? 'reverse' : 'forward';
        }

        // 初始化筛选选项
        function initFilters() {
            // 日期筛选
            const dateSelect = document.getElementById('dateFilter');
            state.dates.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                dateSelect.appendChild(opt);
            });
            dateSelect.value = '${date}';

            // 部门筛选
            const deptSelect = document.getElementById('deptFilter');
            state.departments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                deptSelect.appendChild(opt);
            });

            if (state.initialDepartment && state.initialDepartment !== 'all') {
                deptSelect.value = state.initialDepartment;
            }

            // 人员筛选
            updateUserList();

            if (state.initialUser && state.initialUser !== 'all') {
                const userSelect = document.getElementById('userFilter');
                if (userSelect && Array.from(userSelect.options).some(opt => opt.value === state.initialUser)) {
                    userSelect.value = state.initialUser;
                }
            }
        }

        // 部门变化时更新人员列表
        function onDeptChange() {
            document.getElementById('userFilter').value = 'all';
            filterData();
        }

        // 更新人员列表
        function updateUserList() {
            const dept = document.getElementById('deptFilter').value;
            const userSelect = document.getElementById('userFilter');
            const currentValue = userSelect.value;

            let filteredUsers = state.users;
            if (dept !== 'all') {
                const deptUsers = new Set(
                    state.allData
                        .filter(k => k.department === dept)
                        .map(k => k.user_name)
                );
                filteredUsers = state.users.filter(u => deptUsers.has(u));
            }

            userSelect.innerHTML = '<option value="all">全部人员</option>';
            filteredUsers.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u;
                opt.textContent = u;
                userSelect.appendChild(opt);
            });

            if (filteredUsers.includes(currentValue)) {
                userSelect.value = currentValue;
            }
        }

        const expandedNodes = new Set();

        function filterHierarchyDataBySelection(data, department, user, search) {
            if (!data) return data;

            const hasDepartment = department && department !== 'all';
            const hasUser = user && user !== 'all';
            const hasSearch = search && search.trim() !== '';

            const result = {};

            Object.keys(data).forEach(kpiName => {
                if (hasSearch && !kpiName.toLowerCase().includes(search)) {
                    return;
                }

                const tree = data[kpiName] || [];
                const matchedRoots = [];

                tree.forEach(node => {
                    collectMatchingRoots(node, null, matchedRoots, department, user, hasDepartment, hasUser);
                });

                if (matchedRoots.length > 0) {
                    result[kpiName] = matchedRoots;
                }
            });

            return result;
        }

        function collectMatchingRoots(node, parentNode, matchedRoots, department, user, hasDepartment, hasUser) {
            const matchDepartment = !hasDepartment || node.department === department;
            const matchUser = !hasUser || node.user_name === user;

            let isMatch = matchDepartment && matchUser;
            if (hasDepartment && !hasUser) {
                const parentSameDepartment = parentNode && parentNode.department === department;
                isMatch = matchDepartment && !parentSameDepartment;
            }

            if (isMatch) {
                matchedRoots.push(node);
                return;
            }

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    collectMatchingRoots(child, node, matchedRoots, department, user, hasDepartment, hasUser);
                });
            }
        }

        function renderHierarchyView(data) {
            const container = document.getElementById('app');
            if (!data || Object.keys(data).length === 0) {
                container.innerHTML = '<div class="empty-state">暂无层级数据</div>';
                return;
            }

            let html = '';
            Object.keys(data).forEach(kpiName => {
                const tree = data[kpiName];
                html += renderHierarchyTree(tree, kpiName);
            });
            container.innerHTML = html;
        }

        function renderHierarchyTree(tree, kpiName) {
            if (!tree || tree.length === 0) return '';

            let html = '<div class="hierarchy-tree">';
            html += '<h3 class="hierarchy-tree-title">' + kpiName + '</h3>';

            tree.forEach(node => {
                html += renderHierarchyNode(node);
            });

            html += '</div>';
            return html;
        }

        function renderHierarchyNode(node, depth = 0) {
            const hasChildren = node.children && node.children.length > 0;
            const nodeId = 'node-' + node.id + '-' + depth;
            const isExpanded = expandedNodes.has(nodeId);

            const kpiDirection = getKpiDirection(node);
            let completionRate = 0;
            const targetVal = parseFloat(node.target_value) || 0;
            const actualVal = parseFloat(node.actual_value) || 0;

            if (targetVal > 0 && actualVal > 0) {
                completionRate = (actualVal / targetVal) * 100;
            }

            const displayRate = completionRate.toFixed(2);
            const completionClass = getStatusClass(completionRate / 100, kpiDirection);

            let html = '';
            html += '<div class="hierarchy-node" data-node-id="' + nodeId + '">';
            html += '<div class="hierarchy-card level-' + node.level + '" onclick="handleHierarchyCardClick(event, this.closest(\'.hierarchy-node\').getAttribute(\'data-node-id\'))">';
            html += '<span class="hierarchy-level-badge">' + node.levelLabel + '</span>';
            html += '<div class="hierarchy-card-content">';
            html += '<div class="hierarchy-card-header">';
            html += '<div class="hierarchy-card-kpi-name">' + node.kpi_name + '</div>';
            html += '<div class="hierarchy-card-user-info">' + node.department + ' - ' + node.user_name + ' (' + node.position + ')</div>';
            html += '</div>';
            html += '<div class="hierarchy-card-value">';
            html += '<div class="hierarchy-card-value-label">目标值</div>';
            html += '<div class="hierarchy-card-value-number">' + formatValue(node.target_value, node.unit) + '</div>';
            html += '</div>';
            html += '<div class="hierarchy-card-value">';
            html += '<div class="hierarchy-card-value-label">实际值</div>';
            html += '<div class="hierarchy-card-value-number">' + formatValue(node.actual_value, node.unit) + '</div>';
            html += '</div>';
            html += '<div class="hierarchy-card-value">';
            html += '<div class="hierarchy-card-value-label">达成率</div>';
            html += '<div class="hierarchy-card-completion-rate ' + completionClass + '">' + displayRate + '%</div>';
            html += '</div>';
            if (hasChildren) {
                html += '<div class="hierarchy-expand-btn ' + (isExpanded ? 'expanded' : '') + '" onclick="toggleNodeExpand(event, this.closest(\'.hierarchy-node\').getAttribute(\'data-node-id\'))">';
                html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
                html += '<polyline points="6 9 12 15 18 9"></polyline>';
                html += '</svg>';
                html += '</div>';
            } else {
                html += '<div style="width:28px"></div>';
            }
            html += '</div>';
            html += '</div>';
            if (hasChildren) {
                html += '<div class="hierarchy-node-children ' + (isExpanded ? 'expanded' : '') + '" id="' + nodeId + '-children">';
                html += node.children.map(child => renderHierarchyNode(child, depth + 1)).join('');
                html += '</div>';
            }
            html += '</div>';

            return html;
        }

        function toggleNodeExpand(event, nodeId) {
            event.stopPropagation();

            const childrenEl = document.getElementById(nodeId + '-children');
            const expandBtn = document.querySelector('[data-node-id="' + nodeId + '"] .hierarchy-expand-btn');

            if (!childrenEl || !expandBtn) return;

            if (expandedNodes.has(nodeId)) {
                expandedNodes.delete(nodeId);
                childrenEl.classList.remove('expanded');
                expandBtn.classList.remove('expanded');
            } else {
                expandedNodes.add(nodeId);
                childrenEl.classList.add('expanded');
                expandBtn.classList.add('expanded');
            }
        }

        function handleHierarchyCardClick(event, nodeId) {
            if (event.target.closest('.hierarchy-expand-btn')) {
                return;
            }
            console.log('Clicked node:', nodeId);
        }

        // 筛选数据
        function filterData() {
            const date = document.getElementById('dateFilter').value;
            const dept = document.getElementById('deptFilter').value;
            const user = document.getElementById('userFilter').value;
            const search = document.getElementById('searchInput').value.toLowerCase();

            // 先更新人员列表
            updateUserList();

            if (state.isHierarchyExport) {
                const filteredHierarchy = filterHierarchyDataBySelection(
                    state.hierarchyData,
                    dept,
                    user,
                    search
                );
                renderHierarchyView(filteredHierarchy);
                return;
            }

            state.filteredData = state.allData.filter(k => {
                if (date !== 'all' && k.date !== date) return false;
                if (dept !== 'all' && k.department !== dept) return false;
                if (user !== 'all' && k.user_name !== user) return false;
                if (search && !k.kpi_name.toLowerCase().includes(search)) return false;
                return true;
            });

            render();
        }

        function getStatusClass(rate, direction) {
            if (rate === null || rate === undefined) return 'poor';

            const percentRate = rate * 100;

            if (direction === 'reverse') {
                if (percentRate <= 100) return 'excellent';
                if (percentRate <= 120) return 'good';
                return 'poor';
            }
            if (percentRate >= 100) return 'excellent';
            if (percentRate >= 80) return 'good';
            return 'poor';
        }

        function getStatusIcon(rate, direction) {
            if (rate === null || rate === undefined) return '⚪';

            const percentRate = rate * 100;

            if (direction === 'reverse') {
                if (percentRate <= 100) return '✅';
                if (percentRate <= 120) return '⚠️';
                return '❌';
            }
            if (percentRate >= 100) return '✅';
            if (percentRate >= 80) return '⚠️';
            return '❌';
        }

        function formatValue(value, unit) {
            if (value === null || value === undefined) return '-';
            // 转换为数字，最多保留2位小数
            const num = parseFloat(value);
            if (isNaN(num)) return '-';
            // 先四舍五入到2位小数
            const rounded = Math.round(num * 100) / 100;
            // 使用toLocaleString添加千位分隔符，同时设置最大小数位数为2
            const formatted = rounded.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
            return formatted + ' ' + (unit || '');
        }

        function render() {
            const displayData = state.filteredData;
            const stats = { total: displayData.length, excellent: 0, good: 0, poor: 0, empty: 0 };
            displayData.forEach(k => {
                // 检查是否为空值（⚪）
                if (k.target_value === null || k.target_value === undefined ||
                    k.actual_value === null || k.actual_value === undefined) {
                    stats.empty++;
                    return;
                }

                // 获取KPI方向（与网页版逻辑一致）
                const direction = getKpiDirection(k);

                // 统一公式：达成率 = 实际值 / 目标值 × 100%
                const targetVal = parseFloat(k.target_value) || 0;
                const actualVal = parseFloat(k.actual_value) || 0;
                let percentRate = 0;

                if (targetVal > 0 && actualVal > 0) {
                    percentRate = (actualVal / targetVal) * 100;
                }

                // 使用与网页版相同的判断逻辑
                if (direction === 'reverse') {
                    // 反向指标：越低越好
                    if (percentRate <= 100) stats.excellent++;
                    else if (percentRate <= 120) stats.good++;
                    else stats.poor++;
                } else {
                    // 正向指标：越高越好
                    if (percentRate >= 100) stats.excellent++;
                    else if (percentRate >= 80) stats.good++;
                    else stats.poor++;
                }
            });

            const cardsHtml = displayData.map(k => {
                // 获取KPI方向（处理空值情况）
                const direction = getKpiDirection(k);

                // 统一公式：达成率 = 实际值 / 目标值 × 100%
                let completionRate = 0;
                const targetVal = parseFloat(k.target_value) || 0;
                const actualVal = parseFloat(k.actual_value) || 0;

                if (targetVal > 0 && actualVal > 0) {
                    completionRate = (actualVal / targetVal) * 100;
                }

                const displayRate = completionRate.toFixed(2);
                const statusClass = getStatusClass(completionRate / 100, direction);
                const statusIcon = getStatusIcon(completionRate / 100, direction);
                const progressWidth = Math.min(completionRate || 0, 200);

                return \`
                    <div class="kpi-card \${statusClass}">
                        <div class="kpi-header">
                            <div>
                                <div class="kpi-name">\${k.kpi_name}</div>
                                <div class="kpi-user">\${k.department} - \${k.user_name}</div>
                            </div>
                            <div class="kpi-status">\${statusIcon}</div>
                        </div>
                        <div class="kpi-values">
                            <div class="kpi-value-item">
                                <div class="kpi-value-label">目标值</div>
                                <div class="kpi-value">\${formatValue(k.target_value, k.unit)}</div>
                            </div>
                            <div class="kpi-value-item">
                                <div class="kpi-value-label">实际值</div>
                                <div class="kpi-value">\${formatValue(k.actual_value, k.unit)}</div>
                            </div>
                        </div>
                        <div class="kpi-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width:\${progressWidth}%"></div>
                            </div>
                            <div class="progress-text">\${displayRate}%</div>
                        </div>
                    </div>
                \`;
            }).join('');

            document.getElementById('app').innerHTML = \`
                <div class="stats">
                    <div class="stat-card"><div class="stat-value">\${stats.total}</div><div class="stat-label">总KPI</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:#27ae60">\${stats.excellent}</div><div class="stat-label">✅ 达标</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:#f39c12">\${stats.good}</div><div class="stat-label">⚠️ 警告</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:#e74c3c">\${stats.poor}</div><div class="stat-label">❌ 未达标</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:#95a5a6">\${stats.empty}</div><div class="stat-label">⚪ 空白</div></div>
                </div>
                \${cardsHtml}
            \`;
        }

        // 初始化并渲染
        initFilters();
        filterData();
    <\/script>
</body>
</html>`;

        // 创建下载链接
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `KPI看板_${date}_${timestamp}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('导出失败:', error);
        showError('导出失败: ' + error.message);
    } finally {
        hideLoading();
    }
}


// ==================== 层级视图独立筛选函数 ====================

async function initHierarchyFilters() {
    console.log('[initHierarchyFilters] 开始初始化层级筛选器');

    try {
        // 加载日期列表
        const response = await fetch(API_BASE + "/dates");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
            hierarchyState.dates = result.data;
            const dateSelect = document.getElementById("hierarchyDateFilter");
            if (dateSelect) {
                dateSelect.innerHTML = hierarchyState.dates.map(d =>
                    "<option value=\"" + d + "\">" + d + "</option>"
                ).join("");
                if (hierarchyState.dates.length > 0) {
                    const preferredDate = state.currentDate && hierarchyState.dates.includes(state.currentDate)
                        ? state.currentDate
                        : hierarchyState.dates[0];
                    hierarchyState.date = preferredDate;
                    dateSelect.value = hierarchyState.date;
                    console.log('[initHierarchyFilters] 设置日期为:', hierarchyState.date);
                }
            } else {
                console.error('[initHierarchyFilters] hierarchyDateFilter 元素未找到');
            }
        }

        // 加载部门列表
        const deptResponse = await fetch(API_BASE + "/departments");
        if (!deptResponse.ok) {
            throw new Error(`HTTP ${deptResponse.status}: ${deptResponse.statusText}`);
        }
        const deptResult = await deptResponse.json();
        if (deptResult.success) {
            hierarchyState.departments = deptResult.data;
            const deptSelect = document.getElementById("hierarchyDeptFilter");
            if (deptSelect) {
                deptSelect.innerHTML = "<option value=\"all\">全部部门</option>" +
                    hierarchyState.departments.map(d =>
                        "<option value=\"" + d + "\">" + d + "</option>"
                    ).join("");
                console.log('[initHierarchyFilters] 加载了', hierarchyState.departments.length, '个部门');
            } else {
                console.error('[initHierarchyFilters] hierarchyDeptFilter 元素未找到');
            }
        }

        // 初始化后自动加载用户列表和层级数据
        console.log('[initHierarchyFilters] 调用 hierarchyFilterData, date=', hierarchyState.date);
        await hierarchyFilterData();
    } catch (error) {
        console.error('[initHierarchyFilters] 错误:', error);
        showError('初始化层级筛选器失败: ' + error.message);
    }
}

async function hierarchyFilterData() {
    try {
        // 从DOM读取筛选值（如果是从UI触发）或使用当前状态
        const dateEl = document.getElementById("hierarchyDateFilter");
        const deptEl = document.getElementById("hierarchyDeptFilter");
        const userEl = document.getElementById("hierarchyUserFilter");

        let date = dateEl ? dateEl.value : hierarchyState.date;
        const department = deptEl ? deptEl.value : hierarchyState.department;
        let user = userEl ? userEl.value : hierarchyState.user;

        if (!date) {
            date = state.currentDate || '';
            if (dateEl && date) {
                dateEl.value = date;
            }
        }

        if (department !== hierarchyState.department && userEl) {
            userEl.value = 'all';
            user = 'all';
        }

        hierarchyState.date = date;
        hierarchyState.department = department;
        hierarchyState.user = user;

        if (!date) {
            console.warn('[hierarchyFilterData] 日期为空，跳过层级数据加载');
            return;
        }

        let response;
        if (department !== "all") {
            response = await fetch(API_BASE + "/kpi?date=" + encodeURIComponent(date) + "&department=" + encodeURIComponent(department) + "&limit=1000");
        } else {
            response = await fetch(API_BASE + "/kpi?date=" + encodeURIComponent(date) + "&limit=1000");
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            updateHierarchyUserList(result.data);
        } else {
            console.error('[hierarchyFilterData] API返回失败:', result.message);
        }

        hierarchyData = null;
        await renderHierarchyView();
    } catch (error) {
        console.error('[hierarchyFilterData] 筛选失败:', error);
        showError('加载层级数据失败: ' + error.message);
    }
}

function updateHierarchyUserList(data) {
    const userSet = new Set();
    data.forEach(kpi => userSet.add(kpi.user_name));
    hierarchyState.users = Array.from(userSet).sort();

    const userSelect = document.getElementById("hierarchyUserFilter");
    if (!userSelect) {
        console.error('[updateHierarchyUserList] hierarchyUserFilter 元素未找到');
        return;
    }
    const currentValue = userSelect.value;
    userSelect.innerHTML = "<option value=\"all\">全部人员</option>" +
        hierarchyState.users.map(u =>
            "<option value=\"" + u + "\">" + u + "</option>"
        ).join("");
    if (hierarchyState.users.includes(currentValue)) {
        userSelect.value = currentValue;
    }
}

// ==================== 层级展开视图相关函数 ====================

// 层级数据缓存
let hierarchyData = null;
let expandedNodes = new Set(); // 存储已展开的节点ID

/**
 * 加载层级数据
 */
async function loadHierarchyData() {
    const date = hierarchyState.date || state.currentDate;
    console.log('loadHierarchyData - date:', date);
    if (!date) return null;

    const url = `${API_BASE}/kpi/hierarchy?date=${encodeURIComponent(date)}`;
    console.log('loadHierarchyData - fetching:', url);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('loadHierarchyData - 请求失败:', response.status, response.statusText);
            return null;
        }
        const result = await response.json();

        console.log('loadHierarchyData - result:', result);
        if (result.success) {
            hierarchyData = result.data;
            return result.data;
        }
    } catch (error) {
        console.error('loadHierarchyData - 异常:', error);
    }
    return null;
}

/**
 * 渲染层级视图
 */
async function renderHierarchyView() {
    console.log('renderHierarchyView - state.currentDate:', state.currentDate);
    console.log('renderHierarchyView - state.dates:', state.dates);

    const container = document.getElementById('hierarchyContainer');
    if (!container) {
        console.error('renderHierarchyView - hierarchyContainer 元素未找到');
        return;
    }
    container.innerHTML = '<div class="empty-state">加载中...</div>';

    if (!hierarchyState.date && state.currentDate) {
        hierarchyState.date = state.currentDate;
        const dateSelect = document.getElementById('hierarchyDateFilter');
        if (dateSelect && hierarchyState.date) {
            dateSelect.value = hierarchyState.date;
        }
    }

    // 使用当前选择的日期加载数据
    const data = await loadHierarchyData();
    const filteredData = filterHierarchyDataBySelection(
        data,
        hierarchyState.department,
        hierarchyState.user
    );

    console.log('层级数据:', data);
    console.log('层级筛选后数据:', filteredData);

    if (!filteredData || Object.keys(filteredData).length === 0) {
        container.innerHTML = '<div class="empty-state">暂无层级数据<br><small>请选择有数据的日期，或配置"层级关系表"Excel文件</small></div>';
        return;
    }

    // 按KPI名称渲染每个层级树
    let html = '';
    Object.keys(filteredData).forEach(kpiName => {
        const tree = filteredData[kpiName];
        html += renderHierarchyTree(tree, kpiName);
    });

    container.innerHTML = html;
}

// 根据筛选条件过滤层级数据，将匹配节点作为顶层展示
function filterHierarchyDataBySelection(data, department, user) {
    if (!data) return data;

    const hasDepartment = department && department !== 'all';
    const hasUser = user && user !== 'all';
    if (!hasDepartment && !hasUser) {
        return data;
    }

    const result = {};

    Object.keys(data).forEach(kpiName => {
        const tree = data[kpiName] || [];
        const matchedRoots = [];

        tree.forEach(node => {
            collectMatchingRoots(node, null, matchedRoots, department, user, hasDepartment, hasUser);
        });

        if (matchedRoots.length > 0) {
            result[kpiName] = matchedRoots;
        }
    });

    return result;
}

function collectMatchingRoots(node, parentNode, matchedRoots, department, user, hasDepartment, hasUser) {
    const matchDepartment = !hasDepartment || node.department === department;
    const matchUser = !hasUser || node.user_name === user;

    let isMatch = matchDepartment && matchUser;
    if (hasDepartment && !hasUser) {
        const parentSameDepartment = parentNode && parentNode.department === department;
        isMatch = matchDepartment && !parentSameDepartment;
    }

    if (isMatch) {
        matchedRoots.push(node);
        return;
    }

    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            collectMatchingRoots(child, node, matchedRoots, department, user, hasDepartment, hasUser);
        });
    }
}

/**
 * 渲染单个层级树
 */
function renderHierarchyTree(tree, kpiName) {
    if (!tree || tree.length === 0) return '';

    let html = `<div class="hierarchy-tree">`;
    html += `<h3 class="hierarchy-tree-title">${kpiName}</h3>`;

    tree.forEach(node => {
        html += renderHierarchyNode(node);
    });

    html += `</div>`;
    return html;
}

/**
 * 渲染层级节点
 */
function renderHierarchyNode(node, depth = 0) {
    const hasChildren = node.children && node.children.length > 0;
    const nodeId = `node-${node.id}-${depth}`;
    const isExpanded = expandedNodes.has(nodeId);

    // 获取KPI方向（兼容历史数据方向错误的问题）
    const kpiDirection = getKpiDirection(node);

    // 根据正反向指标，用原始数据计算达成率
    // 统一公式：达成率 = 实际值 / 目标值 × 100%
    let completionRate = 0;
    const targetVal = parseFloat(node.target_value) || 0;
    const actualVal = parseFloat(node.actual_value) || 0;

    if (targetVal > 0 && actualVal > 0) {
        // 统一使用 实际/目标 × 100%，正反向指标只在状态判断时有区别
        completionRate = (actualVal / targetVal) * 100;
    }

    const displayRate = completionRate.toFixed(2);

    const statusClass = getCompletionStatusClass(completionRate / 100, kpiDirection, targetVal, actualVal);
    const completionClass = getCompletionStatusClass(completionRate / 100, kpiDirection, targetVal, actualVal);

    let html = `
        <div class="hierarchy-node" data-node-id="${nodeId}">
            <div class="hierarchy-card level-${node.level}" onclick="handleHierarchyCardClick(event, '${nodeId}')">
                <span class="hierarchy-level-badge">${node.levelLabel}</span>
                <div class="hierarchy-card-content">
                    <div class="hierarchy-card-header">
                        <div class="hierarchy-card-kpi-name">${node.kpi_name}</div>
                        <div class="hierarchy-card-user-info">${node.department} - ${node.user_name} (${node.position})</div>
                    </div>
                    <div class="hierarchy-card-value">
                        <div class="hierarchy-card-value-label">目标值</div>
                        <div class="hierarchy-card-value-number">${formatValue(node.target_value, node.unit)}</div>
                    </div>
                    <div class="hierarchy-card-value">
                        <div class="hierarchy-card-value-label">实际值</div>
                        <div class="hierarchy-card-value-number">${formatValue(node.actual_value, node.unit)}</div>
                    </div>
                    <div class="hierarchy-card-completion">
                        <div class="hierarchy-card-value-label">达成率</div>
                        <div class="hierarchy-card-completion-rate ${completionClass}">${displayRate}%</div>
                    </div>
                    ${hasChildren ? `
                    <div class="hierarchy-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleNodeExpand(event, '${nodeId}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    ` : '<div style="width:32px"></div>'}
                </div>
            </div>
            ${hasChildren ? `
            <div class="hierarchy-node-children ${isExpanded ? 'expanded' : ''}" id="${nodeId}-children">
                ${node.children.map(child => renderHierarchyNode(child, depth + 1)).join('')}
            </div>
            ` : ''}
        </div>
    `;

    return html;
}

/**
 * 切换节点展开/收起
 */
function toggleNodeExpand(event, nodeId) {
    event.stopPropagation(); // 阻止冒泡

    const childrenEl = document.getElementById(`${nodeId}-children`);
    const expandBtn = document.querySelector(`[data-node-id="${nodeId}"] .hierarchy-expand-btn`);

    if (expandedNodes.has(nodeId)) {
        // 收起
        expandedNodes.delete(nodeId);
        childrenEl.classList.remove('expanded');
        expandBtn.classList.remove('expanded');
    } else {
        // 展开
        expandedNodes.add(nodeId);
        childrenEl.classList.add('expanded');
        expandBtn.classList.add('expanded');
    }
}

/**
 * 点击卡片处理（可扩展用于显示详情）
 */
function handleHierarchyCardClick(event, nodeId) {
    // 阻止点击箭头时触发
    if (event.target.closest('.hierarchy-expand-btn')) {
        return;
    }
    // 可以在这里添加显示详情的逻辑
    console.log('Clicked node:', nodeId);
}

/**
 * 全部收起
 */
function collapseAllHierarchy() {
    expandedNodes.clear();

    // 收起所有展开的子节点
    document.querySelectorAll('.hierarchy-node-children.expanded').forEach(el => {
        el.classList.remove('expanded');
    });

    // 重置所有展开按钮
    document.querySelectorAll('.hierarchy-expand-btn.expanded').forEach(el => {
        el.classList.remove('expanded');
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// ==================== 报告视图相关函数 ====================

/**
 * 初始化报告筛选器
 */
async function initReportFilters() {
    console.log('[initReportFilters] 开始初始化报告筛选器');

    try {
        // 加载日期列表
        const response = await fetch(API_BASE + "/dates");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
            reportState.dates = result.data;
            const dateSelect = document.getElementById("reportDateFilter");
            if (dateSelect) {
                dateSelect.innerHTML = reportState.dates.map(d =>
                    `<option value="${d}">${d}</option>`
                ).join('');
                if (reportState.dates.length > 0) {
                    reportState.date = reportState.dates[0];
                    dateSelect.value = reportState.date;
                }
            }
        }

        // 生成周列表
        generateWeeksList();

        // 加载用户列表
        const date = reportState.date || state.currentDate;
        if (date) {
            await loadReportUsers(date);
        }

        console.log('[initReportFilters] 初始化完成');
    } catch (error) {
        console.error('[initReportFilters] 错误:', error);
        showError('初始化报告筛选器失败: ' + error.message);
    }
}

/**
 * 生成周列表（从可用日期中按周分组）
 */
function generateWeeksList() {
    if (reportState.dates.length === 0) return;

    const weeks = [];
    const sortedDates = [...reportState.dates].sort();

    // 找到每个周一作为一周的开始
    for (let i = 0; i < sortedDates.length; i++) {
        const date = new Date(sortedDates[i]);
        const dayOfWeek = date.getDay(); // 0=周日, 1=周一, ...

        // 如果是周一或者是第一天的前一天是周日
        if (dayOfWeek === 1 || i === 0) {
            const weekStart = sortedDates[i];
            const weekDates = [weekStart];

            // 添加后续6天（如果存在）
            for (let j = 1; j < 7; j++) {
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + j);
                const nextDateStr = nextDate.toISOString().split('T')[0];
                if (sortedDates.includes(nextDateStr)) {
                    weekDates.push(nextDateStr);
                } else {
                    break;
                }
            }

            weeks.push({
                start: weekStart,
                end: weekDates[weekDates.length - 1],
                dates: weekDates,
                label: `${weekStart} ~ ${weekDates[weekDates.length - 1]}`
            });
        }
    }

    reportState.weeks = weeks;

    // 填充周筛选器
    const weekSelect = document.getElementById("reportWeekFilter");
    if (weekSelect) {
        weekSelect.innerHTML = weeks.map((w, index) =>
            `<option value="${index}">第${index + 1}周 (${w.label})</option>`
        ).join('');
        if (weeks.length > 0) {
            reportState.weekStart = weeks[0].start;
            weekSelect.value = 0;
        }
    }

    console.log('[generateWeeksList] 生成了', weeks.length, '周数据');
}

/**
 * 加载报告视图的用户列表
 */
async function loadReportUsers(date) {
    try {
        const response = await fetch(`${API_BASE}/kpi?date=${encodeURIComponent(date)}&limit=1000`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
            const userSet = new Set();
            result.data.forEach(kpi => userSet.add(kpi.user_name));
            // 按中文拼音排序
            reportState.users = Array.from(userSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));

            const userSelect = document.getElementById("reportUserFilter");
            if (userSelect) {
                userSelect.innerHTML = '<option value="">选择人员...</option>' +
                    reportState.users.map(u =>
                        `<option value="${u}">${u}</option>`
                    ).join('');
            }

            console.log('[loadReportUsers] 加载了', reportState.users.length, '个用户');
        }
    } catch (error) {
        console.error('[loadReportUsers] 错误:', error);
    }
}

/**
 * 报告筛选数据入口
 */
async function reportFilterData() {
    const container = document.getElementById('reportContainer');
    if (!container) return;

    // 获取筛选条件
    const dateMode = document.getElementById('reportDateMode')?.value || 'day';
    const user = document.getElementById('reportUserFilter')?.value || '';

    // 更新日期/周显示
    const dateGroup = document.getElementById('reportDateGroup');
    const weekGroup = document.getElementById('reportWeekGroup');

    if (dateMode === 'day') {
        dateGroup.style.display = 'flex';
        weekGroup.style.display = 'none';
        reportState.dateMode = 'day';
        reportState.date = document.getElementById('reportDateFilter')?.value || '';
    } else {
        dateGroup.style.display = 'none';
        weekGroup.style.display = 'flex';
        reportState.dateMode = 'week';
        const weekIndex = parseInt(document.getElementById('reportWeekFilter')?.value || 0);
        if (reportState.weeks[weekIndex]) {
            reportState.weekStart = reportState.weeks[weekIndex].start;
        }
    }

    reportState.user = user;

    // 如果没有选择用户，显示提示
    if (!user) {
        container.innerHTML = '<div class="empty-state">请选择人员查看报告</div>';
        return;
    }

    // 根据模式渲染
    if (dateMode === 'day') {
        await renderDailyReport();
    } else {
        await renderWeeklyReport();
    }
}

/**
 * 渲染日报告（横向树状图）
 */
async function renderDailyReport() {
    const container = document.getElementById('reportContainer');
    if (!container) return;

    const date = reportState.date;
    const user = reportState.user;

    if (!date || !user) {
        container.innerHTML = '<div class="empty-state">请选择日期和人员</div>';
        return;
    }

    container.innerHTML = '<div class="empty-state">加载中...</div>';

    try {
        // 获取层级数据
        const response = await fetch(`${API_BASE}/kpi/hierarchy?date=${encodeURIComponent(date)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();

        if (!result.success || !result.data) {
            container.innerHTML = '<div class="empty-state">暂无数据</div>';
            return;
        }

        const hierarchyData = result.data;

        // 从选定人员开始过滤并限制深度为3层
        const filteredHierarchy = filterHierarchyByUser(hierarchyData, user, 3);

        if (Object.keys(filteredHierarchy).length === 0) {
            container.innerHTML = '<div class="empty-state">该人员暂无KPI数据</div>';
            return;
        }

        // 渲染横向树状图
        let html = `<div class="report-daily-tree">`;
        html += `<h2 style="text-align:center;margin-bottom:20px;color:#333;">${user} - KPI层级报告 (${date})</h2>`;

        Object.keys(filteredHierarchy).forEach(kpiName => {
            const tree = filteredHierarchy[kpiName];
            tree.forEach(node => {
                html += renderHorizontalTreeNode(node, 0);
            });
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('[renderDailyReport] 错误:', error);
        container.innerHTML = '<div class="empty-state">加载失败: ' + error.message + '</div>';
    }
}

/**
 * 渲染周报告（垂直条形图）
 */
async function renderWeeklyReport() {
    const container = document.getElementById('reportContainer');
    if (!container) return;

    const weekIndex = parseInt(document.getElementById('reportWeekFilter')?.value || 0);
    const weekData = reportState.weeks[weekIndex];
    const user = reportState.user;

    if (!weekData || !user) {
        container.innerHTML = '<div class="empty-state">请选择周和人员</div>';
        return;
    }

    container.innerHTML = '<div class="empty-state">加载中...</div>';

    try {
        // 并行获取一周的数据
        const dates = weekData.dates;
        const dataPromises = dates.map(date =>
            fetch(`${API_BASE}/kpi/hierarchy?date=${encodeURIComponent(date)}`)
                .then(res => res.json())
                .then(result => result.success ? result.data : null)
        );

        const weekHierarchyData = await Promise.all(dataPromises);

        // 获取该人员的KPI及其一周数据
        const kpiWeeklyData = {};

        weekHierarchyData.forEach((hierarchyData, dayIndex) => {
            if (!hierarchyData) return;

            const date = dates[dayIndex];
            const filteredHierarchy = filterHierarchyByUser(hierarchyData, user, 1);

            Object.keys(filteredHierarchy).forEach(kpiName => {
                if (!kpiWeeklyData[kpiName]) {
                    kpiWeeklyData[kpiName] = {
                        name: kpiName,
                        unit: '',
                        kpiDirection: 'forward',
                        dailyData: {}
                    };
                }

                filteredHierarchy[kpiName].forEach(node => {
                    if (node.unit) {
                        kpiWeeklyData[kpiName].unit = node.unit;
                    }
                    if (node.kpi_direction) {
                        kpiWeeklyData[kpiName].kpiDirection = node.kpi_direction;
                    }

                    // 计算达成率
                    const targetVal = parseFloat(node.target_value) || 0;
                    const actualVal = parseFloat(node.actual_value) || 0;
                    let completionRate = 0;

                    if (targetVal > 0 && actualVal > 0) {
                        completionRate = (actualVal / targetVal) * 100;
                    }

                    kpiWeeklyData[kpiName].dailyData[date] = {
                        target: targetVal,
                        actual: actualVal,
                        rate: completionRate,
                        kpiDirection: kpiWeeklyData[kpiName].kpiDirection
                    };
                });
            });
        });

        if (Object.keys(kpiWeeklyData).length === 0) {
            container.innerHTML = '<div class="empty-state">该人员本周暂无KPI数据</div>';
            return;
        }

        // 渲染周报告
        let html = `<div class="report-week-container">`;
        html += `<h2 style="text-align:center;margin-bottom:20px;color:#333;">${user} - KPI周报告 (${weekData.label})</h2>`;

        Object.keys(kpiWeeklyData).forEach(kpiName => {
            html += renderWeeklyKpiSection(kpiName, kpiWeeklyData[kpiName], dates);
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (error) {
        console.error('[renderWeeklyReport] 错误:', error);
        container.innerHTML = '<div class="empty-state">加载失败: ' + error.message + '</div>';
    }
}

/**
 * 从选定人员开始过滤层级数据
 */
function filterHierarchyByUser(hierarchyData, userName, maxDepth = 3) {
    const result = {};

    Object.keys(hierarchyData).forEach(kpiName => {
        const tree = hierarchyData[kpiName] || [];
        const matchedRoots = [];

        tree.forEach(node => {
            const filteredNode = findAndFilterByUser(node, userName, 0, maxDepth);
            if (filteredNode) {
                matchedRoots.push(filteredNode);
            }
        });

        if (matchedRoots.length > 0) {
            result[kpiName] = matchedRoots;
        }
    });

    return result;
}

/**
 * 递归查找并过滤用户节点
 */
function findAndFilterByUser(node, userName, currentDepth, maxDepth) {
    // 如果当前节点是目标用户
    if (node.user_name === userName) {
        return limitDepth(node, maxDepth);
    }

    // 递归搜索子节点
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findAndFilterByUser(child, userName, currentDepth + 1, maxDepth);
            if (result) {
                return result;
            }
        }
    }

    return null;
}

/**
 * 限制树的深度
 */
function limitDepth(node, maxDepth, currentDepth = 0) {
    const newNode = { ...node };

    if (currentDepth >= maxDepth) {
        newNode.children = [];
        return newNode;
    }

    if (node.children && node.children.length > 0) {
        newNode.children = node.children
            .map(child => limitDepth(child, maxDepth, currentDepth + 1))
            .filter(child => child !== null);
    } else {
        newNode.children = [];
    }

    return newNode;
}

/**
 * 渲染横向树节点
 */
function renderHorizontalTreeNode(node, depth) {
    if (!node) return '';

    const hasChildren = node.children && node.children.length > 0;

    // 计算达成率
    const kpiDirection = getKpiDirection(node);
    const targetVal = parseFloat(node.target_value) || 0;
    const actualVal = parseFloat(node.actual_value) || 0;
    let completionRate = 0;

    if (targetVal > 0 && actualVal > 0) {
        completionRate = (actualVal / targetVal) * 100;
    }

    const displayRate = completionRate.toFixed(1);
    const completionClass = getCompletionStatusClass(completionRate / 100, kpiDirection, targetVal, actualVal);
    const directionIcon = kpiDirection === 'reverse' ? '▼' : '▲';

    let levelLabel = '【岗】';
    if (node.level === 1) levelLabel = '【总】';
    else if (node.level === 2) levelLabel = '【部】';

    let html = `
        <div class="report-tree-node">
            <div class="report-tree-node-card level-${Math.min(depth, 2)}">
                <div class="report-tree-header">
                    <div class="report-tree-node-title">
                        <span class="report-tree-level-badge">${levelLabel}</span>
                        <span>${node.kpi_name}</span>
                        <span style="color:#666;font-size:12px;">(${node.user_name})</span>
                    </div>
                    <div class="report-tree-node-info">
                        <span>目标: ${formatValue(node.target_value, node.unit)}</span>
                        <span>实际: ${formatValue(node.actual_value, node.unit)}</span>
                    </div>
                    <div class="report-tree-node-completion ${completionClass}">
                        ${displayRate}% ${directionIcon}
                    </div>
                </div>
            </div>
    `;

    // 递归渲染子节点
    if (hasChildren && depth < 2) {
        node.children.forEach(child => {
            html += renderHorizontalTreeNode(child, depth + 1);
        });
    }

    html += '</div>';

    return html;
}

/**
 * 渲染周KPI部分
 */
function renderWeeklyKpiSection(kpiName, kpiData, dates) {
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    let html = `
        <div class="report-week-kpi-section">
            <h3 class="report-week-kpi-title">${kpiName}</h3>
            <div class="report-week-bars">
    `;

    dates.forEach((date, index) => {
        if (index >= 7) return;

        const dayData = kpiData.dailyData[date];
        const dayLabel = weekDays[index] || `第${index + 1}天`;

        if (dayData) {
            const rate = dayData.rate || 0;
            const displayRate = rate.toFixed(1);
            const statusClass = getCompletionStatusClass(rate / 100, dayData.kpiDirection, dayData.target, dayData.actual);
            const directionIcon = dayData.kpiDirection === 'reverse' ? '▼' : '▲';
            const barWidth = Math.min(rate, 150);
            const unit = kpiData.unit || '';

            html += `
                <div class="report-week-bar-row ${statusClass}">
                    <div class="report-week-bar-header">
                        <span class="report-week-bar-label">${dayLabel}</span>
                        <span class="report-week-bar-value ${statusClass}">${displayRate}% ${directionIcon}</span>
                    </div>
                    <div class="report-week-bar-track">
                        <div class="report-week-bar-fill ${statusClass}" style="width: ${barWidth}%"></div>
                    </div>
                    <div class="report-week-bar-stats">
                        <span class="report-week-bar-stat">目标: ${formatValue(dayData.target, unit)}</span>
                        <span class="report-week-bar-stat">实际: ${formatValue(dayData.actual, unit)}</span>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="report-week-bar-row">
                    <div class="report-week-bar-header">
                        <span class="report-week-bar-label">${dayLabel}</span>
                        <span class="report-week-bar-value" style="color:#999;">无数据</span>
                    </div>
                    <div class="report-week-bar-track">
                        <div class="report-week-bar-fill" style="width: 0%;background:#eee;"></div>
                    </div>
                    <div class="report-week-bar-stats">
                        <span class="report-week-bar-stat" style="color:#999;">暂无数据</span>
                    </div>
                </div>
            `;
        }
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * 导出报告为PDF（使用浏览器原生打印功能）
 */
function exportReportPDF() {
    const container = document.getElementById('reportContainer');
    if (!container) return;

    // 临时添加打印类，优化打印样式
    document.body.classList.add('printing-report');

    // 调用浏览器打印对话框
    // 用户可以选择"另存为PDF"或直接打印
    window.print();

    // 延迟移除打印类（确保打印对话框打开）
    setTimeout(() => {
        document.body.classList.remove('printing-report');
    }, 1000);

    console.log('[exportReportPDF] 已打开打印对话框，请选择"另存为PDF"');
}
