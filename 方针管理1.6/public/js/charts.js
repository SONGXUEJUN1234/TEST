// 图表实例
let mainChart = null;

// 判断KPI是否为反向指标（越低越好）
// 优先使用后端自动分类的kpi_direction字段，但在名称明显反向时纠正
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

function isReverseKpi(kpiName, kpiType, kpiDirection) {
    const nameForCheck = kpiName || kpiType || '';
    const nameSuggestsReverse = nameForCheck ? isReverseKpiByName(nameForCheck) : false;
    const rawDirection = typeof kpiDirection === 'string' ? kpiDirection.trim() : '';

    if (rawDirection === 'reverse') return true;
    if (rawDirection === 'forward') return nameSuggestsReverse;

    return nameSuggestsReverse;
}

// 根据选择的期间计算开始和结束日期
function getDateRange(period) {
    const endDate = new Date(state.currentDate);
    let startDate = new Date(endDate);

    // 固定天数
    if (!isNaN(period)) {
        startDate.setDate(startDate.getDate() - parseInt(period));
        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate)
        };
    }

    // 自然周期
    switch (period) {
        case 'week':
            // 本周（从周一到当前）
            const dayOfWeek = endDate.getDay();
            const diff = endDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            startDate = new Date(endDate.setDate(diff));
            break;
        case 'month':
            // 本月（从1号到当前）
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            break;
        case 'quarter':
            // 本季度（从季度初到当前）
            const quarter = Math.floor(endDate.getMonth() / 3);
            startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
            break;
        case 'year':
            // 本年度（从1月1日到当前）
            startDate = new Date(endDate.getFullYear(), 0, 1);
            break;
    }

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}

// 格式化日期为 YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 图表类型切换处理
// 不同图表类型禁用不同的选择器
async function onChartTypeChange() {
    const chartType = document.getElementById('chartType').value;
    const userSelect = document.getElementById('chartUser');
    const periodSelect = document.getElementById('chartPeriod');
    const kpiSelect = document.getElementById('chartKpi');

    if (chartType === 'bar') {
        // 对比图：禁用人员选择器和周期选择器
        userSelect.disabled = true;
        userSelect.title = '对比图显示所有人员，人员选择已禁用';
        periodSelect.disabled = true;
        periodSelect.title = '对比图只显示单日数据，周期选择已禁用';
        kpiSelect.disabled = false;
        kpiSelect.title = '请选择KPI';
        console.log('[onChartTypeChange] 对比图模式 - 人员选择器和周期选择器已禁用');
    } else {
        // 趋势图：启用所有选择器
        userSelect.disabled = false;
        userSelect.title = '请选择人员';
        periodSelect.disabled = false;
        periodSelect.title = '请选择时间周期';
        kpiSelect.disabled = false;
        kpiSelect.title = '请选择KPI';
        console.log('[onChartTypeChange] 趋势图模式 - 所有选择器已启用');
    }

    // 切换图表类型时清空图表
    if (mainChart) {
        mainChart.destroy();
        mainChart = null;
    }

    // 切换图表类型后，自动渲染图表（如果条件满足）
    await updateChart();
}

// 更新图表（根据选择的筛选条件渲染图表）
async function updateChart() {
    const chartType = document.getElementById('chartType').value;
    const user = document.getElementById('chartUser').value;
    const kpi = document.getElementById('chartKpi').value;

    console.log(`[updateChart] ========== 开始渲染图表 ==========`);
    console.log(`[updateChart] 图表类型: ${chartType}`);
    console.log(`[updateChart] 选择的人员: ${user || '(未选择)'}`);
    console.log(`[updateChart] 选择的KPI: ${kpi || '(未选择)'}`);
    console.log(`[updateChart] state.chartData.length: ${state.chartData?.length || 0}`);

    // 对比图只需要KPI，不需要人员
    if (chartType === 'bar') {
        if (!kpi) {
            console.log('[updateChart] 对比图 - 未选择KPI，显示空图表');
            showEmptyChart();
            return;
        }
        console.log(`[updateChart] 对比图 - 渲染 ${kpi} 的数据`);
        await renderComparisonChart(kpi);
    }
    // 趋势图需要人员和KPI
    else {
        if (!user || !kpi) {
            console.log('[updateChart] 趋势图 - 缺少人员或KPI，显示空图表');
            showEmptyChart();
            return;
        }
        console.log(`[updateChart] 趋势图 - 渲染 ${user} - ${kpi} 的数据`);
        await renderTrendChart(user, kpi);
    }
}

// 渲染趋势图（带红黄绿背景区域）
async function renderTrendChart(user, kpi) {
    const period = document.getElementById('chartPeriod').value;
    const dateRange = getDateRange(period);

    console.log(`[renderTrendChart] 渲染 ${user} - ${kpi} 的趋势图 (${dateRange.startDate} ~ ${dateRange.endDate})`);

    const response = await fetch(
        `${API_BASE}/kpi/trend?user=${encodeURIComponent(user)}&kpi=${encodeURIComponent(kpi)}&startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`
    );
    const result = await response.json();

    if (!result.success || result.data.length === 0) {
        showEmptyChart();
        return;
    }

    const data = result.data;
    const kpiName = data[0]?.kpi_name || '';
    const kpiType = data[0]?.kpi_type || '';
    const kpiDirection = data[0]?.kpi_direction || 'forward';
    const reverse = isReverseKpi(kpiName, kpiType, kpiDirection);

    const labels = data.map(d => d.date);
    const targetValues = data.map(d => d.target_value);
    const actualValues = data.map(d => d.actual_value);

    // 计算Y轴范围和背景区域
    const allValues = [...targetValues, ...actualValues].filter(v => v != null);
    const maxValue = Math.max(...allValues) * 1.1;
    const minValue = Math.min(...allValues) * 0.9;

    const ctx = document.getElementById('mainChart').getContext('2d');

    if (mainChart) {
        mainChart.destroy();
    }

    // 创建背景插件（红黄绿区域）
    const backgroundPlugin = {
        id: 'backgroundZones',
        beforeDraw: (chart) => {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const yAxis = chart.scales.y;
            const targetValue = targetValues[0]; // 使用第一个目标值作为参考

            if (!targetValue || !chartArea) return;

            const target80 = targetValue * 0.8;
            const target90 = targetValue * 0.9;

            // 计算Y轴像素位置
            const y100 = yAxis.getPixelForValue(targetValue);
            const y90 = yAxis.getPixelForValue(target90);
            const y80 = yAxis.getPixelForValue(target80);
            const yMax = yAxis.top;
            const yMin = yAxis.bottom;

            ctx.save();

            if (reverse) {
                // 反向指标（越低越好）：红色区间是 >目标值，绿色区间是 <80%
                // 红色区域（>目标值）
                ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
                ctx.fillRect(chartArea.left, yMax, chartArea.right - chartArea.left, y100 - yMax);

                // 黄色区域（90%-100%）
                ctx.fillStyle = 'rgba(243, 156, 18, 0.15)';
                ctx.fillRect(chartArea.left, y100, chartArea.right - chartArea.left, y90 - y100);

                // 黄色区域（80%-90%）
                ctx.fillStyle = 'rgba(243, 156, 18, 0.15)';
                ctx.fillRect(chartArea.left, y90, chartArea.right - chartArea.left, y80 - y90);

                // 绿色区域（<80%）
                ctx.fillStyle = 'rgba(39, 174, 96, 0.15)';
                ctx.fillRect(chartArea.left, y80, chartArea.right - chartArea.left, yMin - y80);
            } else {
                // 正向指标（越高越好）：红色区间是 <80%，绿色区间是 >=目标值
                // 红色区域（<80%）
                ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
                ctx.fillRect(chartArea.left, y80, chartArea.right - chartArea.left, yMin - y80);

                // 黄色区域（80%-90%）
                ctx.fillStyle = 'rgba(243, 156, 18, 0.15)';
                ctx.fillRect(chartArea.left, y90, chartArea.right - chartArea.left, y80 - y90);

                // 黄色区域（90%-100%）
                ctx.fillStyle = 'rgba(243, 156, 18, 0.15)';
                ctx.fillRect(chartArea.left, y100, chartArea.right - chartArea.left, y90 - y100);

                // 绿色区域（>=目标值）
                ctx.fillStyle = 'rgba(39, 174, 96, 0.15)';
                ctx.fillRect(chartArea.left, yMax, chartArea.right - chartArea.left, y100 - yMax);
            }

            ctx.restore();
        }
    };

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '目标值',
                    data: targetValues,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.3,
                    fill: false,
                    borderDash: [5, 5]
                },
                {
                    label: '实际值',
                    data: actualValues,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${user} - ${kpi} 趋势图 (${kpiType || '通用型'})${reverse ? ' [反向指标:越低越好]' : ' [正向指标:越高越好]'}`
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        footer: (tooltipItems) => {
                            const actual = tooltipItems[0].raw;
                            const target = targetValues[tooltipItems[0].dataIndex];
                            const rate = target && target !== 0 ? ((actual / target) * 100).toFixed(1) : 0;
                            return `完成率: ${rate}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxValue,
                    min: minValue
                }
            }
        },
        plugins: [backgroundPlugin]
    });
}

// 渲染对比图（使用 state.chartData 中的全量数据）
async function renderComparisonChart(kpi) {
    // 使用 state.chartData 中已加载的全量数据
    const data = state.chartData || [];

    if (data.length === 0) {
        console.warn('[renderComparisonChart] 没有图表数据');
        showEmptyChart();
        return;
    }

    // 筛选相同的KPI数据（显示所有人员）
    const kpiData = data.filter(d => d.kpi_name === kpi);

    if (kpiData.length === 0) {
        console.warn(`[renderComparisonChart] 没有找到KPI: ${kpi}`);
        showEmptyChart();
        return;
    }

    const labels = kpiData.map(d => d.user_name);
    const targetValues = kpiData.map(d => d.target_value);
    const actualValues = kpiData.map(d => d.actual_value);

    // 获取数据日期
    const dataDate = chartState.date || data[0]?.date || '';

    console.log(`[renderComparisonChart] 渲染 ${kpi} 的对比图，共 ${kpiData.length} 个人员`);
    console.log(`[renderComparisonChart] 数据日期: ${dataDate}`);

    const ctx = document.getElementById('mainChart').getContext('2d');

    if (mainChart) {
        mainChart.destroy();
    }

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '目标值',
                    data: targetValues,
                    backgroundColor: 'rgba(52, 152, 219, 0.7)'
                },
                {
                    label: '实际值',
                    data: actualValues,
                    backgroundColor: 'rgba(39, 174, 96, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${kpi} - 人员对比 (${dataDate})`
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 显示空图表
function showEmptyChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');

    if (mainChart) {
        mainChart.destroy();
        mainChart = null;
    }

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['请选择日期和KPI'],
            datasets: [{
                data: [0],
                backgroundColor: 'rgba(189, 195, 199, 0.5)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    display: false
                }
            }
        }
    });
}
