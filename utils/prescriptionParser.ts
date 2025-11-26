
import { getHerbInfo } from '../data/herbDatabase';
import { HerbRawData } from '../types';
import { UNIT_CONVERSION } from '../constants';

const HERB_REGEX = /([\u4e00-\u9fa5]+)\s*(\d*\.?\d+)?\s*([a-zA-Z\u4e00-\u9fa5]*)?/g;

// Fix: Removed '药', '汤', '酒', '蜜', '糖' as they are common in herb names (e.g. 芍药, 桂枝汤(rare but poss), 酒大黄).
// Kept only structural/instructional keywords that are unlikely to be part of a valid herb name in a list context.
const IGNORE_KEYWORDS = ['方', '剂', '煎', '服', '后', '碗', '升', '文火', '武火', '大火', '小火', '滚', '沸'];

export const parsePrescription = (text: string): HerbRawData[] => {
  const matches = [...text.matchAll(HERB_REGEX)];
  const results: HerbRawData[] = [];

  matches.forEach(match => {
    const rawFullName = match[1];
    const rawDosage = match[2];
    const rawUnit = match[3] || 'g'; 

    // Skip instructions like "水三碗", "煎至一碗"
    if (IGNORE_KEYWORDS.some(k => rawFullName.includes(k))) return;
    if (['黄酒', '米酒', '蜂蜜', '冰糖', '水', '清酒', '甘澜水'].includes(rawFullName)) return;

    let dosageVal = rawDosage ? parseFloat(rawDosage) : 0;
    
    if (rawUnit) {
      if (rawUnit.includes('两')) dosageVal *= UNIT_CONVERSION['两'];
      if (rawUnit.includes('钱')) dosageVal *= UNIT_CONVERSION['钱'];
      if (rawUnit.includes('分')) dosageVal *= UNIT_CONVERSION['分'];
      if (rawUnit.includes('枚') || rawUnit.includes('个')) dosageVal *= UNIT_CONVERSION['枚']; 
      if (rawUnit.includes('片')) dosageVal *= UNIT_CONVERSION['片']; 
    }

    // Call updated getHerbInfo
    const { coreName, processing, data, mappedFrom } = getHerbInfo(rawFullName);

    if (data) {
      results.push({
        name: coreName,
        fullName: rawFullName,
        dosageRaw: match[0],
        dosageGrams: dosageVal || data.defaultDosage || 9,
        processingMethod: processing,
        staticData: data,
        isCustom: false,
        mappedFrom // Pass this through to UI for "alias detected" warning
      });
    } else {
      results.push({
        name: rawFullName,
        fullName: rawFullName,
        dosageRaw: match[0],
        dosageGrams: dosageVal || 9,
        processingMethod: '',
        isCustom: true
      });
    }
  });

  return results;
};
