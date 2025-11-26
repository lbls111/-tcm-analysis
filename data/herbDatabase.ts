
import { HerbStaticData, Temperature, Flavor, QiDirection, BenCaoHerb, BurnerWeights, AISettings } from '../types';
import { PROCESSING_DELTAS, BURNER_RULES, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from '../constants';
import { fetchCloudHerbs, insertCloudHerb } from '../services/supabaseService';

// ==========================================
// 1. 同义词映射表 (Alias Map)
// ==========================================
export const HERB_ALIASES: Record<string, string> = {
  // 芍药系列
  '芍药': '白芍', 
  '白芍药': '白芍',
  '杭芍': '白芍',
  '赤芍药': '赤芍',
  
  // 黄芪系列
  '黄耆': '黄芪',
  '北芪': '黄芪',
  '北黄芪': '黄芪',
  
  // 龙骨牡蛎
  '生龙骨': '龙骨',
  '煅龙骨': '龙骨',
  '花龙骨': '龙骨',
  '生牡蛎': '牡蛎',
  '咸牡蛎': '牡蛎',
  
  // 茯苓系列
  '云苓': '茯苓',
  '白茯苓': '茯苓',
  '赤茯苓': '茯苓', 
  '朱茯苓': '茯苓',
  '茯神木': '茯神', 
  
  // 附子干姜
  '制附子': '黑顺片', 
  '淡附片': '附子', 
  '炮姜': '炮姜', 
  '炮干姜': '炮姜',
  '老姜': '生姜',
  '鲜姜': '生姜',

  // 半夏系列
  '法夏': '法半夏',
  '姜夏': '姜半夏',
  
  // 地黄
  '大生地': '地黄',
  '生地': '地黄',
  '鲜地黄': '地黄',
  '熟地': '熟地黄',
  
  // 甘草
  '炙草': '炙甘草', 
  '粉甘草': '甘草',
  '国老': '甘草',

  // 枳壳枳实
  '江枳壳': '枳壳',

  // 焦三仙
  '焦山楂': '焦山楂', 
  '焦神曲': '六神曲', 
  '焦麦芽': '焦麦芽', 
  '神曲': '六神曲', 

  // 葛根系列
  '野葛': '葛根',
  '干葛': '葛根',

  // 红曲系列
  '红曲米': '红曲',
  '赤曲': '红曲',
  
  // 新增常用别名
  '莲子肉': '莲子',
  '湘莲': '莲子',
  '炒薏苡仁': '薏苡仁', 
  '炒薏米': '薏苡仁',
  '薏米': '薏苡仁',
  '生薏米': '薏苡仁',
  '旱莲草': '墨旱莲',
  '橘皮': '陈皮',
  '广陈皮': '陈皮',
  '新会皮': '陈皮',
  '菊花': '菊花', 
  '杭菊': '菊花',
  '怀菊': '菊花',
  '首乌藤': '夜交藤', 
  '夜交藤': '首乌藤',
  '菟丝饼': '菟丝子',
  '元胡': '延胡索',
  '延胡': '延胡索',
  '枣皮': '山茱萸',
  '山萸肉': '山茱萸',
  '大白': '石膏', 
  '生石膏': '石膏',
  '全当归': '当归',
  '归身': '当归',
  '归尾': '当归',
  '秦归': '当归',
  '瓜蒌': '瓜蒌', 
  '全瓜蒌': '瓜蒌',
  '瓜萎': '瓜蒌', 
  '红枣': '大枣',
  '川穹': '川芎', 
  '双花': '金银花',
  '茅苍术': '苍术',
  '北苍术': '苍术',
  '仙灵脾': '淫羊藿',
  '官桂': '肉桂',
  '桂心': '肉桂',
  '牛夕': '牛膝',
  '怀牛膝': '牛膝',
  '杜仲': '杜仲',
  '川断': '续断',
  '丹皮': '牡丹皮',
  '粉丹皮': '牡丹皮',
  '云母': '云母石',
  '川贝': '川贝母',
  '浙贝': '浙贝母',
  '豆豉': '淡豆豉',
  '益智仁': '益智'
};

// ==========================================
// 2. Helper: Map Raw Strings to Enums
// ==========================================
const mapNatureToEnum = (nature: string): Temperature => {
  if (nature.includes('大热')) return Temperature.GREAT_HEAT;
  if (nature.includes('大寒')) return Temperature.GREAT_COLD;
  
  if (nature.includes('微温')) return Temperature.SLIGHTLY_WARM; 
  if (nature.includes('微寒')) return Temperature.SLIGHTLY_COLD; 
  
  if (nature.includes('热')) return Temperature.HEAT;
  if (nature.includes('凉')) return Temperature.COOL;
  if (nature.includes('寒')) return Temperature.COLD;
  if (nature.includes('温')) return Temperature.WARM;
  
  return Temperature.NEUTRAL;
};

const mapFlavorToEnum = (flavors: string[]): Flavor[] => {
  const mapped: Flavor[] = [];
  flavors.forEach(f => {
    if (f.includes('辛')) mapped.push(Flavor.PUNGENT);
    if (f.includes('苦')) mapped.push(Flavor.BITTER);
    if (f.includes('咸')) mapped.push(Flavor.SALTY);
    if (f.includes('酸')) mapped.push(Flavor.SOUR);
    if (f.includes('涩')) mapped.push(Flavor.ASTRINGENT);
    if (f.includes('甘')) mapped.push(Flavor.SWEET);
    if (f.includes('淡')) mapped.push(Flavor.BLAND);
  });
  return mapped.length > 0 ? mapped : [Flavor.BLAND];
};

// ==========================================
// 3. Helper: Estimate TWFC and Direction
// ==========================================
const estimateAttributes = (channels: string[], flavors: Flavor[], nature: Temperature): { twfc: {upper:number, middle:number, lower:number}, direction: QiDirection } => {
  let u = 0, m = 0, l = 0;
  
  channels.forEach(c => {
    if (BURNER_RULES.UPPER.some(k => c.includes(k))) u++;
    else if (BURNER_RULES.MIDDLE.some(k => c.includes(k))) m++;
    else if (BURNER_RULES.LOWER.some(k => c.includes(k))) l++;
  });

  const total = u + m + l || 1;
  const twfc = { upper: u/total, middle: m/total, lower: l/total };

  let score = 0;
  if ([Temperature.HEAT, Temperature.GREAT_HEAT, Temperature.WARM, Temperature.SLIGHTLY_WARM].includes(nature)) score += 1;
  if ([Temperature.COLD, Temperature.GREAT_COLD, Temperature.COOL, Temperature.SLIGHTLY_COLD].includes(nature)) score -= 1;
  
  if (flavors.includes(Flavor.PUNGENT)) score += 1;
  if (flavors.includes(Flavor.SWEET)) score += 0.5;
  if (flavors.includes(Flavor.BITTER)) score -= 1;
  if (flavors.includes(Flavor.SALTY)) score -= 1;
  if (flavors.includes(Flavor.SOUR)) score -= 0.5;

  let direction = QiDirection.NEUTRAL;
  if (score > 0.5) direction = QiDirection.LIFTING;
  if (score < -0.5) direction = QiDirection.SINKING;

  return { twfc, direction };
};

// ==========================================
// 4. Global State (Populated from Cloud)
// ==========================================
export let FULL_HERB_LIST: BenCaoHerb[] = [];

// Global Catalog (Fast Lookup)
const HERB_CATALOG: Record<string, HerbStaticData> = {};

// Build Catalog Logic (reusable)
const createCatalogEntry = (herb: BenCaoHerb): HerbStaticData => {
    const tempEnum = mapNatureToEnum(herb.nature);
    const flavEnums = mapFlavorToEnum(herb.flavors);
    const { twfc, direction } = estimateAttributes(herb.meridians, flavEnums, tempEnum);
    
    return {
      name: herb.name,
      temperature: tempEnum,
      flavors: flavEnums,
      channels: herb.meridians,
      efficacy: herb.efficacy || '暂无详细功效',
      usage: herb.usage,
      direction: direction,
      twfc: twfc,
      defaultDosage: 9 
    };
};

// ==========================================
// 5. Dynamic Registration (Cloud Sync Priority)
// ==========================================
const LS_AI_SETTINGS_KEY = "logicmaster_ai_settings";

// 注册新药材 (支持 云端自动同步)
export const registerDynamicHerb = async (herb: BenCaoHerb, persistToCloud: boolean = true) => {
    // 1. Update In-Memory List
    const existingIndex = FULL_HERB_LIST.findIndex(h => h.name === herb.name);
    if (existingIndex < 0) {
        FULL_HERB_LIST.push(herb);
    } else {
        FULL_HERB_LIST[existingIndex] = herb; 
    }
    
    // 2. Update In-Memory Catalog
    HERB_CATALOG[herb.name] = createCatalogEntry(herb);

    // 3. Sync to Cloud (Primary Persistence)
    if (persistToCloud && herb.source !== 'cloud') {
        try {
            const savedSettings = localStorage.getItem(LS_AI_SETTINGS_KEY);
            let settings: AISettings = savedSettings ? JSON.parse(savedSettings) : {};
            
            // Fallback to built-in defaults if not configured
            if (!settings.supabaseUrl) settings.supabaseUrl = DEFAULT_SUPABASE_URL;
            if (!settings.supabaseKey) settings.supabaseKey = DEFAULT_SUPABASE_KEY;

            if (settings.supabaseUrl && settings.supabaseKey) {
                const success = await insertCloudHerb(herb, settings);
                if (success) {
                    herb.source = 'cloud'; 
                    console.log(`[HerbDB] Synced ${herb.name} to Cloud.`);
                }
            }
        } catch (e) {
            console.error("[HerbDB] Sync failed:", e);
        }
    }
};

// 加载药材 (Supabase Priority)
export const loadCustomHerbs = async () => {
    console.log("[HerbDB] Loading herbs from Cloud...");
    try {
        const savedSettings = localStorage.getItem(LS_AI_SETTINGS_KEY);
        let settings: AISettings = savedSettings ? JSON.parse(savedSettings) : {};
        
        if (!settings.supabaseUrl) settings.supabaseUrl = DEFAULT_SUPABASE_URL;
        if (!settings.supabaseKey) settings.supabaseKey = DEFAULT_SUPABASE_KEY;

        if (settings.supabaseUrl && settings.supabaseKey) {
            const cloudHerbs = await fetchCloudHerbs(settings as AISettings);
            if (cloudHerbs.length > 0) {
                console.log(`[HerbDB] Loaded ${cloudHerbs.length} herbs from Cloud.`);
                
                // Clear list and rebuild to avoid duplicates from local remnants
                FULL_HERB_LIST = []; 
                Object.keys(HERB_CATALOG).forEach(k => delete HERB_CATALOG[k]);

                cloudHerbs.forEach(h => registerDynamicHerb(h, false));
            } else {
                console.warn("[HerbDB] No herbs found in Cloud. Database might be empty.");
            }
        }
    } catch (e) {
        console.error("[HerbDB] Cloud load failed:", e);
    }
};

// Trigger load on module import
loadCustomHerbs();

// ==========================================
// 6. Herb Lookup Logic
// ==========================================

export const getHerbInfo = (inputName: string): { 
  coreName: string; 
  processing: string; 
  data: HerbStaticData | null;
  mappedFrom?: string;
} => {
  let cleanName = inputName.trim();
  let mappedFrom: string | undefined = undefined;

  // 1. Exact Match
  if (HERB_CATALOG[cleanName]) {
    return { coreName: cleanName, processing: '', data: HERB_CATALOG[cleanName], mappedFrom };
  }

  // 2. Alias Match
  if (HERB_ALIASES[cleanName]) {
    mappedFrom = cleanName;
    const aliasName = HERB_ALIASES[cleanName];
    if (HERB_CATALOG[aliasName]) {
       return { coreName: aliasName, processing: '', data: HERB_CATALOG[aliasName], mappedFrom };
    }
  }

  // 3. Strip Processing Suffix/Prefix
  // Logic: Try to find the longest possible herb name within the string
  // e.g. "炒酸枣仁" -> "酸枣仁" (found) + "炒"
  
  // Sort prefixes by length descending to match "蜜炙" before "蜜"
  const prefixes = Object.keys(PROCESSING_DELTAS).sort((a,b) => b.length - a.length);
  
  for (const p of prefixes) {
    if (cleanName.startsWith(p)) {
      const core = cleanName.substring(p.length);
      
      // Check core directly
      if (HERB_CATALOG[core]) {
         return { coreName: core, processing: p, data: HERB_CATALOG[core], mappedFrom: inputName };
      }
      
      // Check core alias
      if (HERB_ALIASES[core]) {
        const finalCore = HERB_ALIASES[core];
        if (HERB_CATALOG[finalCore]) {
           return { coreName: finalCore, processing: p, data: HERB_CATALOG[finalCore], mappedFrom: inputName };
        }
      }
    }
    
    if (cleanName.endsWith(p)) {
       const core = cleanName.substring(0, cleanName.length - p.length);
        if (HERB_CATALOG[core]) {
         return { coreName: core, processing: p, data: HERB_CATALOG[core], mappedFrom: inputName };
      }
    }
  }

  return { coreName: inputName, processing: '', data: null, mappedFrom };
};

// ==========================================
// 7. AI Search Helper
// ==========================================
export const searchHerbsForAI = (query: string): string => {
    const term = query.trim();
    if (!term) return "请提供有效的查询关键词。";

    // Filter herbs that match query in name, alias, efficacy, or nature/flavor
    const matches = FULL_HERB_LIST.filter(h => {
        const aliasMatch = Object.entries(HERB_ALIASES).some(([alias, core]) => 
            (alias.includes(term) && core === h.name)
        );
        return h.name.includes(term) || 
               (h.efficacy && h.efficacy.includes(term)) ||
               (h.nature && h.nature.includes(term)) ||
               (h.category && h.category.includes(term)) || // Support searching by category
               aliasMatch;
    }).slice(0, 8); // Limit to top 8

    if (matches.length === 0) {
        return `未在当前数据库中找到与 "${term}" 匹配的药材。请尝试更通用的关键词，或检查是否有别名。`;
    }

    // Format as lightweight JSON
    const results = matches.map(h => ({
        name: h.name,
        nature: h.nature,
        flavors: h.flavors,
        meridians: h.meridians,
        efficacy: h.efficacy ? h.efficacy.substring(0, 150) + (h.efficacy.length > 150 ? '...' : '') : '暂无',
        usage: h.usage
    }));

    return JSON.stringify(results, null, 2);
};
