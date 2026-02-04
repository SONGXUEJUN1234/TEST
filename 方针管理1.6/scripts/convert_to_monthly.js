const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * 将单日Excel文件转换为月度多Sheet文件
 */
function convertToMonthly() {
    const mockDataDir = path.join(__dirname, '..', 'mock_data');
    const outputDir = path.join(mockDataDir, '2026', '01');

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 收集所有现有文件
    const existingFiles = [];
    function walkDir(dir) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walkDir(fullPath);
            } else if (item.endsWith('.xlsx') && !item.includes('~$')) {
                existingFiles.push(fullPath);
            }
        });
    }
    walkDir(mockDataDir);

    console.log('========================================');
    console.log('开始转换为月度多Sheet格式');
    console.log('========================================\n');

    // 按人员分组
    const byPerson = {};

    existingFiles.forEach(filePath => {
        try {
            const workbook = XLSX.readFile(filePath);
            const fileName = path.basename(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(sheet, {header: 1});

            // 提取基本信息
            let department = '未知部门';
            let position = '未知岗位';
            let userName = '未知';

            for (let i = 0; i < Math.min(10, rawData.length); i++) {
                const row = rawData[i];
                if (row && row.length >= 2) {
                    const key = String(row[0] || '').trim();
                    const value = row[1];
                    if (key === '部门') department = value;
                    if (key === '岗位') position = value;
                    if (key === '姓名') userName = value;
                }
            }

            const key = `${department}-${position}-${userName}`;
            if (!byPerson[key]) {
                byPerson[key] = {
                    department,
                    position,
                    userName,
                    templateData: rawData,
                    sourceFile: filePath
                };
            }
        } catch (error) {
            console.error(`读取文件失败: ${filePath}`, error.message);
        }
    });

    console.log(`找到 ${Object.keys(byPerson).length} 个人员\n`);

    // 为每个人创建月度文件
    const days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
    let successCount = 0;

    for (const [key, person] of Object.entries(byPerson)) {
        try {
            const newWorkbook = XLSX.utils.book_new();

            // 为每一天创建一个Sheet
            days.forEach(day => {
                // 复制模板数据并修改日期
                const sheetData = JSON.parse(JSON.stringify(person.templateData));

                // 更新日期
                for (let i = 0; i < sheetData.length; i++) {
                    const row = sheetData[i];
                    if (row && row.length >= 2) {
                        const key = String(row[0] || '').trim();
                        if (key === '日期') {
                            row[1] = `2026-01-${day}`;
                        }
                    }
                }

                // 为实际值添加一些随机变化（模拟真实数据）
                for (let i = 0; i < sheetData.length; i++) {
                    const row = sheetData[i];
                    if (row && row.length >= 5) {
                        const kpiName = String(row[0] || '').trim();
                        // 跳过标题行
                        if (kpiName && kpiName !== '日期' && kpiName !== '部门' &&
                            kpiName !== '岗位' && kpiName !== '姓名' && kpiName !== 'KPI名称') {

                            const targetValue = parseFloat(row[2]) || 0;
                            const actualValue = parseFloat(row[3]) || 0;

                            if (targetValue > 0 && actualValue > 0) {
                                // 实际值在目标值的80%-120%之间波动
                                const variation = 0.8 + Math.random() * 0.4;
                                const newActual = Math.round(targetValue * variation);

                                // 更新实际值
                                row[3] = newActual;

                                // 更新完成率
                                if (row.length >= 5) {
                                    row[4] = Math.round((newActual / targetValue) * 100 * 100) / 100;
                                }
                            }
                        }
                    }
                }

                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                XLSX.utils.book_append_sheet(newWorkbook, worksheet, day);
            });

            // 保存新文件
            const outputFileName = `${person.department}-${person.position}-${person.userName}.xlsx`;
            const outputPath = path.join(outputDir, outputFileName);
            XLSX.writeFile(newWorkbook, outputPath);

            successCount++;
            console.log(`✓ ${outputFileName} - ${days.length}天数据`);
        } catch (error) {
            console.error(`创建文件失败: ${key}`, error.message);
        }
    }

    console.log('\n========================================');
    console.log(`转换完成！`);
    console.log(`========================================`);
    console.log(`成功创建: ${successCount} 个月度文件`);
    console.log(`输出目录: ${outputDir}`);
    console.log(`每天数据: ${days.join(', ')}`);

    // 删除旧文件（备份到old目录）
    console.log('\n备份旧文件...');

    const oldFiles = existingFiles.filter(f =>
        !f.includes(outputDir) && !f.includes('old')
    );

    if (oldFiles.length > 0) {
        const backupDir = path.join(mockDataDir, 'old');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        oldFiles.forEach(oldFile => {
            try {
                const fileName = path.basename(oldFile);
                const destPath = path.join(backupDir, fileName);

                // 如果目标文件已存在，添加时间戳
                let finalDest = destPath;
                if (fs.existsSync(destPath)) {
                    const timestamp = Date.now();
                    finalDest = path.join(backupDir, `${path.basename(fileName, '.xlsx')}_${timestamp}.xlsx`);
                }

                fs.renameSync(oldFile, finalDest);
                console.log(`  已备份: ${fileName}`);
            } catch (error) {
                console.error(`备份失败: ${oldFile}`, error.message);
            }
        });
    }

    console.log('\n========================================');
    console.log('完成！');
    console.log('========================================');
}

// 运行
convertToMonthly();
