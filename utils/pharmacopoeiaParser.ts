import { BenCaoHerb } from '../types';

const BLACKLIST_TITLES = ['前言', '目录', '凡例', '索引', '通则', '附录', '制法', '性状', '鉴别', '检查', '含量测定', '饮片', '备注', '图', '附', '总则', '沿革', '名单'];

// 提取性味归经
const parseNatureAndFlavors = (text: string): { nature: string, flavors: string[], meridians: string[] } => {
  let nature = '平';
  let flavors: string[] = [];
  let meridians: string[] = [];

  if (!text) return { nature, flavors, meridians };

  if (text.includes('大热')) nature = '大热';
  else if (text.includes('大寒')) nature = '大寒';
  else if (text.includes('微温')) nature = '微温'; 
  else if (text.includes('微寒')) nature = '微寒'; 
  else if (text.includes('热')) nature = '热';
  else if (text.includes('温')) nature = '温';
  else if (text.includes('凉')) nature = '凉';
  else if (text.includes('寒')) nature = '寒';
  
  const flavorKeywords = ['酸', '苦', '甘', '辛', '咸', '淡', '涩'];
  flavors = flavorKeywords.filter(k => text.includes(k));

  const meridianMatch = text.match(/归(.*?)经/);
  if (meridianMatch && meridianMatch[1]) {
     meridians = meridianMatch[1]
        .split(/[、，, ]+/)
        .filter(m => m.trim().length > 0 && m.trim() !== '及');
  }

  return { nature, flavors, meridians };
};


/**
 * New, more robust parser based on user feedback.
 * It uses a "fingerprint" (Name + Pinyin + Latin Name) to identify entries
 * and strictly requires essential sections to exist.
 */
export const parseRawPharmacopoeiaText = (fullText: string): BenCaoHerb[] => {
  const herbs: BenCaoHerb[] = [];
  
  // A pattern to identify the start of a potential herb entry.
  // It looks for: Chinese Chars \n Pinyin \n LATIN NAME
  // The positive lookahead `(?=...)` splits the text *before* the match, keeping the delimiter.
  const entryDelimiter = /(?=^[\u4e00-\u9fa5\s]+\n[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùü\s]+\n[A-Z\s\.'-]+$)/m;
  const blocks = fullText.split(entryDelimiter).filter(b => b.trim().length > 20);

  blocks.forEach((block, index) => {
    try {
      // *** CRITICAL VALIDATION: MUST CONTAIN BOTH ESSENTIAL SECTIONS ***
      if (!block.includes('【性味与归经】') || !block.includes('【功能与主治】')) {
        return; // Skip if it's not a valid medicinal herb entry.
      }

      const lines = block.split('\n').map(l => l.trim());
      
      // 1. Extract Name from the fingerprint
      const potentialName = lines[0].replace(/\s/g, '');
      if (
        !potentialName ||
        potentialName.length < 2 ||
        potentialName.length > 5 ||
        BLACKLIST_TITLES.some(t => potentialName.includes(t))
      ) {
        return; // Invalid name, skip this block.
      }
      const name = potentialName;

      // 2. Extract relevant sections using regex
      const propMatch = block.match(/【性味与归经】([\s\S]*?)(?=【|$)/);
      const funcMatch = block.match(/【功能与主治】([\s\S]*?)(?=【|$)/);
      const usageMatch = block.match(/【用法与用量】([\s\S]*?)(?=【|$)/);

      // 3. Parse extracted sections
      const propText = propMatch ? propMatch[1].trim() : '';
      const { nature, flavors, meridians } = parseNatureAndFlavors(propText);
      
      const efficacy = funcMatch ? funcMatch[1].replace(/[\r\n\s]+/g, ' ').trim() : '';
      const usage = usageMatch ? usageMatch[1].replace(/[\r\n\s]+/g, ' ').trim() : "";

      // Final sanity check
      if (!efficacy) {
        return;
      }

      const isProcessed = name.includes('炒') || name.includes('制') || name.includes('炭') || name.includes('炙');
      const categoryStr = isProcessed ? '炮制品' : '药材';
           
      herbs.push({
          id: `import-${Date.now()}-${index}`, 
          name: name,
          nature: nature,
          flavors: flavors,
          meridians: meridians,
          efficacy: efficacy,
          usage: usage,
          category: categoryStr,
          processing: isProcessed ? name : '生用',
          isRaw: false,
          source: 'cloud'
      });
      
    } catch (e) {
        console.warn(`Parsing error for block starting with "${block.substring(0, 50)}...":`, e);
    }
  });

  // Ensure uniqueness by name
  const uniqueHerbs = new Map<string, BenCaoHerb>();
  herbs.forEach(h => uniqueHerbs.set(h.name, h));

  return Array.from(uniqueHerbs.values());
};