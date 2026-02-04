const XLSX = require('xlsx');
const path = require('path');

const testFile = path.join(__dirname, '..', 'mock_data', '2026', '01', '测试部-测试工程师-测试用户.xlsx');
const workbook = XLSX.readFile(testFile);

console.log('测试文件Sheet列表:');
console.log('========================================');
workbook.SheetNames.forEach(name => {
    console.log(`  - "${name}"`);
});
console.log('========================================');
