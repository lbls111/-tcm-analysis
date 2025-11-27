




export enum Flavor {
  PUNGENT = '辛',
  BITTER = '苦',
  SALTY = '咸',
  SOUR = '酸',
  ASTRINGENT = '涩',
  SWEET = '甘',
  BLAND = '淡'
}

export enum Temperature {
  GREAT_HEAT = '大热',
  HEAT = '热',
  WARM = '温',
  SLIGHTLY_WARM = '微温',
  NEUTRAL = '平',
  SLIGHTLY_COLD = '微寒',
  COOL = '凉',
  COLD = '寒',
  GREAT_COLD = '大寒'
}

export enum QiDirection {
  LIFTING = '升浮',
  SINKING = '沉降',
  NEUTRAL = '中转'
}

export enum ViewMode {
  INPUT = 'INPUT',
  WORKSHOP = 'WORKSHOP',
  VISUAL = 'VISUAL',
  REPORT = 'REPORT',
  AI_CHAT = 'AI_CHAT',
  DATABASE = 'DATABASE'
}

export enum Constitution {
  NEUTRAL = '平和质',
  YANG_DEFICIENCY = '阳虚质',
  YIN_DEFICIENCY = '阴虚质',
  PHLEGM_DAMPNESS = '痰湿质',
  QI_STAGNATION = '气郁质'
}

export enum AdministrationMode {
  STANDARD = '常规温服',
  HOT_PORRIDGE = '啜热粥助汗', 
  COLD_SERVE = '凉服', 
  EMPTY_STOMACH = '空腹顿服', 
  POST_MEAL = '饭后服', 
  FREQUENT = '少量频服' 
}

export interface ConstitutionSurvey {
  coldHeat: string;
  sweat: string;
  digestion: string;
  sleep: string;
  emotion: string;
  openText: string;
}

export interface BurnerWeights {
  upper: number;
  middle: number;
  lower: number;
}

export interface HerbStaticData {
  name: string;
  temperature: Temperature;
  flavors: Flavor[]; 
  channels: string[]; 
  efficacy: string;
  direction: QiDirection;
  defaultDosage?: number;
  twfc?: BurnerWeights; 
  usage?: string; // 新增：用法用量
}

export interface HerbRawData {
  name: string; 
  fullName: string; 
  dosageRaw: string; 
  dosageGrams: number;
  processingMethod?: string; 
  isCustom?: boolean; 
  staticData?: HerbStaticData;
  mappedFrom?: string; 
}

export interface CalculatedHerb extends HerbRawData {
  id: string;
  temperature: Temperature;
  displayTemperature: string; 
  primaryFlavor: Flavor;
  channels: string[];
  qiDirection: QiDirection;
  hvBase: number;
  deltaHV: number;
  hvCorrected: number;
  wf: number;
  dr: number;
  ptiContribution: number;
  burnerWeights: BurnerWeights; 
  vector: { x: number, y: number }; 
}

export interface BurnerAnalysis {
  pti: number; 
  percentage: number; 
}

export interface SanJiaoAnalysis {
  upper: BurnerAnalysis;
  middle: BurnerAnalysis;
  lower: BurnerAnalysis;
  overallVector: number; 
}

export interface HerbPair {
  herbs: string[];
  name: string;
  effect: string;
  type: 'synergy' | 'antagonism' | 'modifier';
  description: string; 
}

export interface Vector2D {
  x: number;
  y: number;
  magnitude: number;
  angle: number;
}

export interface SimulationSeriesPoint {
  time: number; // minutes
  qz: number; // Gu Qi (Middle)
  qw: number; // Wei Qi (Upper)
  qy: number; // Ying Yin (Lower)
}

export interface AnalysisResult {
  totalPTI: number;
  initialTotalDosage: number; 
  herbs: CalculatedHerb[];
  top3: CalculatedHerb[];
  sanJiao: SanJiaoAnalysis;
  herbPairs: HerbPair[]; 
  aiReportRaw?: string;
  
  // Dynamics & Physics
  netVector: Vector2D;
  dynamics: SimulationSeriesPoint[];
}

// === Ben Cao Database Interface ===
export interface BenCaoHerb {
  id: string;
  name: string; // 药名
  pinyin?: string; // 拼音 (Optional in raw data)
  category?: string; // 来源/分类
  nature: string; // 四气 (e.g. 温, 寒)
  flavors: string[]; // 五味 (e.g. 辛, 甘)
  meridians: string[]; // 归经
  efficacy?: string; // 功能主治 (Directly from Pharmacopoeia)
  usage?: string; // 用法用量 (Directly from Pharmacopoeia)
  classicContent?: string; // 备注/原文
  contraindications?: string; // 禁忌
  isRaw?: boolean; 
  parentHerb?: string; // 指向原药材（用于炮制品）
  processing?: string; // 炮制方法
  source?: 'local' | 'cloud' | 'pharmacopoeia'; // Data source tracking
}

// === Cloud Storage Interfaces ===

export interface CloudReport {
  id: string;
  prescription: string; // 处方原文
  content: string; // HTML内容
  meta: any; // 版本、模式等元数据
  analysis_result?: any; // 关键计算结果快照
  created_at: string;
}

export interface CloudChatSession {
  id: string;
  title: string;
  messages: any[]; // JSONB
  created_at: number; // Timestamp
  updated_at?: string; // ISO String from DB
}

// === AI Settings Interface (Updated for Cloud Deployment) ===
export interface ModelOption {
  id: string;
  name?: string;
}

export interface AISettings {
  apiKey: string;           // 用户输入的 Key
  apiBaseUrl: string;       // 用户输入的 Base URL (e.g., https://api.openai.com/v1)
  
  analysisModel: string;    // 深度推演使用的模型ID
  chatModel: string;        // 问答使用的模型ID
  availableModels: ModelOption[]; // 从API获取的模型列表

  systemInstruction: string; // 虽然UI隐藏，但内部仍需保留传递给SDK
  temperature: number;
  topK: number;
  topP?: number;       // Nucleus sampling
  maxTokens?: number;  // Max output tokens
  thinkingBudget: number;

  // Cloud Database Settings (Supabase)
  supabaseUrl?: string;
  supabaseKey?: string;
}
