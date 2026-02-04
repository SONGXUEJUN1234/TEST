# -*- coding: utf-8 -*-
"""
清理数据库中错误的用户数据
使用Python自带的sqlite3模块
"""

import sqlite3
import os
from pathlib import Path

# 数据库路径
db_path = Path(__file__).parent.parent / 'database' / 'kpi.db'

# 需要清理的错误用户名模式
INVALID_PATTERNS = [
    '1号机工艺员', '2号机工艺员', '3号机工艺员', '4号机工艺员', '5号机工艺员',
    '1机', '2机', '3机', '4机', '5机',
    '1-5机', '1-4机', '号机', '机工艺员'
]

def is_invalid_user_name(name):
    """检查是否是无效用户名"""
    if not name:
        return False
    return any(p in name for p in INVALID_PATTERNS)

def cleanup_database():
    """清理数据库"""
    print('=' * 50)
    print('  清理数据库中的错误用户数据')
    print('=' * 50)
    print()

    if not db_path.exists():
        print(f'错误: 数据库文件不存在: {db_path}')
        return

    # 连接数据库
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # 查询所有数据
    cursor.execute('SELECT id, user_name, department, position, date FROM kpi_data')
    all_data = cursor.fetchall()

    print(f'数据库中共有 {len(all_data)} 条KPI记录')

    # 找出无效记录
    invalid_records = [r for r in all_data if is_invalid_user_name(r[1])]

    if not invalid_records:
        print('\n未发现包含错误用户名的记录')
        conn.close()
        return

    print(f'\n发现 {len(invalid_records)} 条包含错误用户名的记录:\n')

    # 按用户名分组
    from collections import defaultdict
    by_user = defaultdict(list)
    for r in invalid_records:
        by_user[r[1]].append(r)

    # 显示每个错误用户名
    for user_name, records in by_user.items():
        print(f'  用户名: "{user_name}" ({len(records)}条)')
        print(f'    部门: {records[0][2]}, 岗位: {records[0][3]}')
        print(f'    日期范围: {records[0][4]} ~ {records[-1][4]}')
        print()

    # 确认删除
    confirm = input('是否删除这些记录? (输入 yes 确认): ')

    if confirm.lower() == 'yes':
        # 删除
        deleted_count = 0
        for user_name in by_user.keys():
            cursor.execute('DELETE FROM kpi_data WHERE user_name = ?', (user_name,))
            deleted_count += cursor.rowcount
            print(f'已删除用户 "{user_name}" 的 {cursor.rowcount} 条记录')

        conn.commit()
        print(f'\n总共删除了 {deleted_count} 条记录')
        print('数据库清理完成!')
    else:
        print('\n取消删除操作')

    conn.close()

if __name__ == '__main__':
    cleanup_database()
