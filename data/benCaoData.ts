

import { BenCaoHerb } from '../types';

// 数据来源：2025年版《中华人民共和国药典》（一部）
// 本地数据库已退休，所有数据将优先从 Supabase 云数据库加载。
// 此文件仅保留基本结构定义。

export const RAW_PHARMACOPOEIA_DATA: string[] = [
  // 本地数据已清空，请使用“导入药典”功能将数据同步至云端数据库。
];

export const BEN_CAO_CATEGORIES = ['全部', '药材', '炮制品'];
export const BEN_CAO_NATURES = ['寒', '凉', '平', '温', '热'];
export const BEN_CAO_FLAVORS = ['酸', '苦', '甘', '辛', '咸', '淡', '涩'];
export const BEN_CAO_PROCESSING = ['全部', '生用', '蜜炙', '酒炙', '醋炙', '盐炙', '炒', '炒炭', '煨', '蒸', '煮', '烫', '煅', '制霜', '发酵', '制'];