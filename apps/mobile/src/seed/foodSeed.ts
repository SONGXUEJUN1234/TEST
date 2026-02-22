import { SQLiteDatabase } from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

const FOODS = [
  { name: '米饭', caloriesPer100g: 116, proteinPer100g: 2.6, carbsPer100g: 25.9, fatPer100g: 0.3 },
  { name: '燕麦', caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9 },
  { name: '全麦面包', caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 4.2 },
  { name: '鸡胸肉', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { name: '鸡蛋', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  { name: '牛奶', caloriesPer100g: 62, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3 },
  { name: '酸奶', caloriesPer100g: 72, proteinPer100g: 3.5, carbsPer100g: 9.3, fatPer100g: 2.7 },
  { name: '三文鱼', caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
  { name: '金枪鱼', caloriesPer100g: 132, proteinPer100g: 28, carbsPer100g: 0, fatPer100g: 1.3 },
  { name: '牛肉瘦', caloriesPer100g: 170, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 6 },
  { name: '猪里脊', caloriesPer100g: 143, proteinPer100g: 21, carbsPer100g: 0, fatPer100g: 6.2 },
  { name: '豆腐', caloriesPer100g: 76, proteinPer100g: 8, carbsPer100g: 1.9, fatPer100g: 4.8 },
  { name: '豆浆', caloriesPer100g: 33, proteinPer100g: 3, carbsPer100g: 1.5, fatPer100g: 1.8 },
  { name: '黄豆', caloriesPer100g: 446, proteinPer100g: 36, carbsPer100g: 30, fatPer100g: 20 },
  { name: '西兰花', caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 6.6, fatPer100g: 0.4 },
  { name: '菠菜', caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { name: '胡萝卜', caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2 },
  { name: '番茄', caloriesPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2 },
  { name: '黄瓜', caloriesPer100g: 15, proteinPer100g: 0.7, carbsPer100g: 3.6, fatPer100g: 0.1 },
  { name: '苹果', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  { name: '香蕉', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  { name: '橙子', caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1 },
  { name: '蓝莓', caloriesPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14, fatPer100g: 0.3 },
  { name: '草莓', caloriesPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3 },
  { name: '牛油果', caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7 },
  { name: '核桃', caloriesPer100g: 654, proteinPer100g: 15.2, carbsPer100g: 13.7, fatPer100g: 65.2 },
  { name: '杏仁', caloriesPer100g: 579, proteinPer100g: 21.2, carbsPer100g: 21.6, fatPer100g: 49.9 },
  { name: '花生', caloriesPer100g: 567, proteinPer100g: 25.8, carbsPer100g: 16.1, fatPer100g: 49.2 },
  { name: '橄榄油', caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
  { name: '菜籽油', caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
  { name: '红薯', caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20.1, fatPer100g: 0.1 },
  { name: '土豆', caloriesPer100g: 77, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1 },
  { name: '玉米', caloriesPer100g: 96, proteinPer100g: 3.4, carbsPer100g: 21, fatPer100g: 1.5 },
  { name: '藜麦', caloriesPer100g: 120, proteinPer100g: 4.4, carbsPer100g: 21.3, fatPer100g: 1.9 },
  { name: '糙米', caloriesPer100g: 111, proteinPer100g: 2.6, carbsPer100g: 23, fatPer100g: 0.9 },
  { name: '意面', caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1 },
  { name: '虾', caloriesPer100g: 99, proteinPer100g: 24, carbsPer100g: 0.2, fatPer100g: 0.3 },
  { name: '鳕鱼', caloriesPer100g: 82, proteinPer100g: 18, carbsPer100g: 0, fatPer100g: 0.7 },
  { name: '蘑菇', caloriesPer100g: 22, proteinPer100g: 3.1, carbsPer100g: 3.3, fatPer100g: 0.3 },
  { name: '洋葱', caloriesPer100g: 40, proteinPer100g: 1.1, carbsPer100g: 9.3, fatPer100g: 0.1 },
  { name: '彩椒', caloriesPer100g: 31, proteinPer100g: 1, carbsPer100g: 6, fatPer100g: 0.3 },
  { name: '生菜', caloriesPer100g: 15, proteinPer100g: 1.4, carbsPer100g: 2.9, fatPer100g: 0.2 },
  { name: '卷心菜', caloriesPer100g: 25, proteinPer100g: 1.3, carbsPer100g: 5.8, fatPer100g: 0.1 },
  { name: '南瓜', caloriesPer100g: 26, proteinPer100g: 1, carbsPer100g: 6.5, fatPer100g: 0.1 },
  { name: '梨', caloriesPer100g: 57, proteinPer100g: 0.4, carbsPer100g: 15, fatPer100g: 0.1 },
  { name: '葡萄', caloriesPer100g: 69, proteinPer100g: 0.7, carbsPer100g: 18, fatPer100g: 0.2 },
  { name: '鸡腿肉', caloriesPer100g: 209, proteinPer100g: 18, carbsPer100g: 0, fatPer100g: 15 },
  { name: '低脂奶酪', caloriesPer100g: 173, proteinPer100g: 24, carbsPer100g: 3.1, fatPer100g: 7 },
  { name: '黑豆', caloriesPer100g: 341, proteinPer100g: 21.6, carbsPer100g: 62, fatPer100g: 1.4 },
  { name: '鹰嘴豆', caloriesPer100g: 364, proteinPer100g: 19, carbsPer100g: 61, fatPer100g: 6 },
  { name: '扁豆', caloriesPer100g: 353, proteinPer100g: 25, carbsPer100g: 60, fatPer100g: 1.1 },
  { name: '西柚', caloriesPer100g: 42, proteinPer100g: 0.8, carbsPer100g: 11, fatPer100g: 0.1 },
  { name: '木瓜', caloriesPer100g: 43, proteinPer100g: 0.5, carbsPer100g: 11, fatPer100g: 0.3 },
  { name: '奇亚籽', caloriesPer100g: 486, proteinPer100g: 16.5, carbsPer100g: 42.1, fatPer100g: 30.7 },
];


export const seedFoodItems = (db: SQLiteDatabase) => {
  const now = Date.now();
  FOODS.forEach((food) => {
    db.runSync(
      `INSERT INTO FoodItem(id, name, brand, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, isCustom, createdAt, updatedAt)
       VALUES(?, ?, '', ?, ?, ?, ?, 0, ?, ?)`,
      [uuidv4(), food.name, food.caloriesPer100g, food.proteinPer100g, food.carbsPer100g, food.fatPer100g, now, now]
    );
  });
};
