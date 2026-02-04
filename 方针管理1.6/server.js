const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./database/db');
const excelWatcher = require('./services/excelWatcher');
const alertService = require('./services/alertService');
const hierarchySyncService = require('./services/hierarchySyncService');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Excel文件监控目录
// 支持通过环境变量配置，或使用默认路径
const EXCEL_DIR = process.env.EXCEL_DIR || path.join(__dirname, 'mock_data');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api', apiRoutes);

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        console.log('初始化数据库...');
        initDatabase();

        // 启动Excel文件监控
        console.log('启动Excel文件监控...');
        excelWatcher.start(EXCEL_DIR);

        // 启动提醒服务
        console.log('启动提醒服务...');
        alertService.start();

        // 启动层级关系同步服务
        console.log('启动层级关系同步服务...');
        hierarchySyncService.init(EXCEL_DIR);

        // 启动HTTP服务器
        app.listen(PORT, () => {
            console.log('\n=================================');
            console.log('方针管理KPI日经营看板系统');
            console.log('=================================');
            console.log(`服务器运行在: http://localhost:${PORT}`);
            console.log(`Excel监控目录: ${EXCEL_DIR}`);
            console.log('=================================\n');
        });

    } catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    excelWatcher.stop();
    alertService.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    excelWatcher.stop();
    alertService.stop();
    process.exit(0);
});

// 全局错误处理 - 防止进程因未捕获异常而退出
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error.message);
    console.error('错误堆栈:', error.stack);
    // 不退出进程，记录错误后继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
    // 不退出进程，记录错误后继续运行
});

// 启动
startServer();
