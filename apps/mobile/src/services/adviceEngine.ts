import { aggregateMeals, calculateTDEE } from './calculators';
import { FoodItem, MealEntry, Profile, Vitals, WorkoutEntry } from '../types';

export interface AdviceItem { title: string; reason: string; actionSteps: string[]; cautionLevel: 'low'|'medium'|'high'; }
export interface PlanItem { type: 'diet'|'workout'; description: string; target: string; checklistKey: string; }

export const evaluate = (profile: Profile, days: { meals: MealEntry[]; workouts: WorkoutEntry[]; vitals: Vitals[]; foods: FoodItem[]; }[]) => {
  const tdee = calculateTDEE(profile).tdee;
  const advice: AdviceItem[] = [];
  const planItems: PlanItem[] = [];
  const last3 = days.slice(-3);
  const avgNet = last3.reduce((s, d) => {
    const intake = aggregateMeals(d.meals, d.foods).calories;
    const burn = d.workouts.reduce((x,w) => x + w.durationMin * 4, 0);
    return s + (intake - burn);
  }, 0) / Math.max(last3.length, 1);

  if (avgNet > tdee + 300) {
    advice.push({
      title: '净热量偏高，明日轻度减量',
      reason: `最近3天平均净热量 ${avgNet.toFixed(0)} > TDEE+300(${(tdee+300).toFixed(0)})。`,
      actionSteps: ['主食减少50g', '加餐从坚果改为水果150g', '晚饭后快走30分钟'],
      cautionLevel: 'medium'
    });
    planItems.push({ type: 'diet', description: '晚餐主食减量', target: '主食-50g', checklistKey: 'diet_reduce_carb' });
  }

  const today = days[days.length - 1];
  if (today) {
    const macros = aggregateMeals(today.meals, today.foods);
    const proteinTarget = profile.weightKg * 1.2;
    if (macros.protein < proteinTarget) {
      advice.push({
        title: '蛋白摄入不足',
        reason: `今日蛋白 ${macros.protein.toFixed(1)}g < 目标下限 ${proteinTarget.toFixed(1)}g(体重*1.2)。`,
        actionSteps: ['增加鸡胸肉100g', '早餐增加鸡蛋1个', '加一杯无糖酸奶'],
        cautionLevel: 'low'
      });
      planItems.push({ type: 'diet', description: '补足蛋白', target: `>=${proteinTarget.toFixed(0)}g`, checklistKey: 'diet_protein' });
    }
    const sleep = today.vitals.at(-1)?.sleepHours ?? 7;
    if (sleep < 6) {
      advice.push({
        title: '睡眠不足，降低训练强度',
        reason: `睡眠仅 ${sleep} 小时 < 6 小时。`,
        actionSteps: ['有氧强度从high降到medium', '睡前1小时不看屏幕', '明天23:00前入睡'],
        cautionLevel: 'medium'
      });
      planItems.push({ type: 'workout', description: '恢复日训练', target: '中低强度30分钟', checklistKey: 'workout_recovery' });
    }

    const bp = today.vitals.at(-1);
    if ((bp?.systolic ?? 0) >= 140 || (bp?.diastolic ?? 0) >= 90) {
      advice.push({
        title: '血压偏高区间提醒',
        reason: `记录值 ${bp?.systolic}/${bp?.diastolic}mmHg 偏高，仅做生活方式建议。`,
        actionSteps: ['减少高钠加工食品', '连续1周固定时间复测', '必要时咨询医生'],
        cautionLevel: 'high'
      });
    }
  }

  return { advice, planItems, explain: '规则引擎: JSON规则模板 + evaluate(profile, history)' };
};
