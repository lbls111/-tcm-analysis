

import { Flavor, Temperature, Constitution, QiDirection, AdministrationMode } from './types';

// ==========================================
// 0. 云端数据库默认配置 (Built-in Cloud Database)
// ==========================================
export const DEFAULT_SUPABASE_URL = "https://igmxhardaohooxoscczk.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_OMG8HrPZ45Y6GyDpogXeQg_pT3P_K5g";

// ==========================================
// 1. 药物寒热值 (HV_生品) 映射表
// 修正为用户指定等级: 平=0, 平偏温=0.5, 微温=1.0, 温=1.5, 大热=2.0
// ==========================================
export const HV_MAP: Record<Temperature, number> = {
  [Temperature.GREAT_HEAT]: 2.5,
  [Temperature.HEAT]: 2.0,
  [Temperature.WARM]: 1.5,
  [Temperature.SLIGHTLY_WARM]: 1.0,
  [Temperature.NEUTRAL]: 0.0, // 平
  [Temperature.SLIGHTLY_COLD]: -1.0,
  [Temperature.COOL]: -1.5,
  [Temperature.COLD]: -2.0,
  [Temperature.GREAT_COLD]: -2.5,
};

// ==========================================
// 2. 五味强度系数 (WF) 映射表
// ==========================================
export const WF_MAP: Record<Flavor, number> = {
  [Flavor.PUNGENT]: 1.3,   
  [Flavor.BITTER]: 1.2,    
  [Flavor.SALTY]: 1.0,     
  [Flavor.SOUR]: 0.9,      
  [Flavor.ASTRINGENT]: 0.9,
  [Flavor.SWEET]: 0.8,     
  [Flavor.BLAND]: 0.8,     
};

// ==========================================
// 3. 炮制修正值 (ΔHV) 表
// ==========================================
export const PROCESSING_DELTAS: Record<string, number> = {
  '炙': 0.5,   
  '炒': 0.5,   
  '煨': 0.5,
  '酒': 0.8,   
  '姜': 0.8,   
  '炮': 1.0,   
  '炭': -0.5,  
  '煅': 0.0,
  '焦': 0.3,
  '蜜': 0.5,   
  '醋': -0.2,
  '盐': -0.2,
  '盐炙': -0.2,
  '生': 0.0
};

// ==========================================
// 4. 三焦归经分类规则 (Fallback Only)
// ==========================================
export const BURNER_RULES = {
  UPPER: ['心', '肺', '心包'],
  MIDDLE: ['脾', '胃'],
  LOWER: ['肝', '肾', '膀胱', '大肠', '小肠', '胆', '三焦']
};

export const UNIT_CONVERSION = {
  '枚': 3, 
  '片': 3, 
  '钱': 3, 
  '两': 15, 
  '分': 0.3
};

// ==========================================
// 5. 体质调节系数 (Constitution Modifiers)
// ==========================================
export const CONSTITUTION_MODIFIERS: Record<Constitution, { heatMult: number, coldMult: number }> = {
  [Constitution.NEUTRAL]: { heatMult: 1.0, coldMult: 1.0 },
  [Constitution.YANG_DEFICIENCY]: { heatMult: 1.2, coldMult: 0.8 }, // 阳虚者对温热药反应更敏感(需求度高，生理反馈明显)
  [Constitution.YIN_DEFICIENCY]: { heatMult: 0.8, coldMult: 1.2 }, // 阴虚者对寒凉药反应敏感
  [Constitution.PHLEGM_DAMPNESS]: { heatMult: 1.0, coldMult: 1.0 },
  [Constitution.QI_STAGNATION]: { heatMult: 1.1, coldMult: 0.9 }, // 气郁易化火
};

// ==========================================
// 6. 服药模式动力学修正 (Administration Physics)
// ==========================================
export const ADMIN_PHYSICS: Record<AdministrationMode, { qzBoost: number, kRateMult: number, note: string }> = {
  [AdministrationMode.STANDARD]: { qzBoost: 0, kRateMult: 1.0, note: '常规吸收' },
  [AdministrationMode.HOT_PORRIDGE]: { qzBoost: 25, kRateMult: 1.2, note: '谷气充沛，助药力挥发' },
  [AdministrationMode.COLD_SERVE]: { qzBoost: -10, kRateMult: 0.8, note: '减缓吸收，折热势' },
  [AdministrationMode.EMPTY_STOMACH]: { qzBoost: 0, kRateMult: 1.5, note: '吸收极快，药力专宏' },
  [AdministrationMode.POST_MEAL]: { qzBoost: 10, kRateMult: 0.6, note: '吸收平缓，减毒护胃' },
  [AdministrationMode.FREQUENT]: { qzBoost: 0, kRateMult: 0.5, note: '持续低水平刺激' }
};

// ==========================================
// 7. 矢量场映射 (Vector Field Mapping)
// X轴：收 (-) / 散 (+) -> Opening / Closing
// Y轴：降 (-) / 升 (+) -> Descending / Ascending
// ==========================================
export const FLAVOR_VECTOR_X: Record<Flavor, number> = {
  [Flavor.PUNGENT]: 0.8,  // 辛散 -> Expand (Open)
  [Flavor.SWEET]: 0.3,    // 甘缓 -> Slight Expand
  [Flavor.BLAND]: 0.1,    // 淡渗 -> Neutral/Out
  [Flavor.SOUR]: -0.7,    // 酸收 -> Contract (Close)
  [Flavor.BITTER]: -0.4,  // 苦降 -> Slight Contract
  [Flavor.ASTRINGENT]: -0.8,// 涩 -> Contract (Close)
  [Flavor.SALTY]: -0.2,   // 咸软 -> Neutral
};

export const DIRECTION_VECTOR_Y: Record<QiDirection, number> = {
  [QiDirection.LIFTING]: 0.9, // 升
  [QiDirection.NEUTRAL]: 0.1,
  [QiDirection.SINKING]: -0.8 // 降
};