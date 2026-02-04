const path = require('path');
const fs = require('fs');

function walkDirectory(dir, callback) {
    console.log(`检查目录: ${dir}`);
    console.log(`目录存在: ${fs.existsSync(dir)}`);

    if (!fs.existsSync(dir)) {
        console.warn(`目录不存在: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir);
    console.log(`目录内容:`, files);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        console.log(`  - ${file} (isDirectory: ${stat.isDirectory()}, isFile: ${stat.isFile()})`);

        if (stat.isDirectory()) {
            walkDirectory(filePath, callback);
        } else if (stat.isFile() && file.endsWith('.xlsx')) {
            console.log(`    找到Excel: ${filePath}`);
            callback(filePath);
        }
    });
}

const mockDataDir = path.join(__dirname, '..', 'mock_data');
console.log('mock_data路径:', mockDataDir);
console.log('');

walkDirectory(mockDataDir, (filePath) => {
    console.log(`回调: ${filePath}`);
});
