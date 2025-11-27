
import { HerbRawData, CalculatedHerb, AnalysisResult, SanJiaoAnalysis, Flavor, Temperature, BurnerWeights, HerbPair, QiDirection, Constitution, SimulationSeriesPoint, Vector2D, AdministrationMode } from '../types';
import { HV_MAP, WF_MAP, PROCESSING_DELTAS, BURNER_RULES, CONSTITUTION_MODIFIERS, FLAVOR_VECTOR_X, DIRECTION_VECTOR_Y, ADMIN_PHYSICS } from '../constants';

// ==========================================
// 辅助函数
// ==========================================

const getTemperatureLabelFromValue = (hv: number): string => {
  if (hv >= 2.2) return '大热';
  if (hv >= 1.8) return '热';
  if (hv >= 1.3) return '温';
  if (hv >= 0.8) return '微温';
  if (hv >= 0.3) return '平偏温';
  if (hv > -0.3) return '平';
  if (hv > -1.3) return '微寒';
  if (hv > -1.8) return '凉';
  if (hv > -2.3) return '寒';
  return '大寒';
};

export const COMMON_PAIRS: { names: string[], label: string, effect: string, description: string }[] = [
  { 
    names: ['麻黄', '桂枝'], 
    label: '麻桂配', 
    effect: '发汗解表，调和营卫',
    description: '麻黄宣肺开腠，桂枝解肌透邪。二者相须，增强发汗解表之力。' 
  },
  { 
    names: ['桂枝', '白芍'], 
    label: '桂芍配', 
    effect: '调和阴阳，敛阴和营',
    description: '桂枝辛温主散，透营达卫；白芍酸寒主收，敛阴益营。一散一收，调和营卫。' 
  },
  { 
    names: ['柴胡', '黄芩'], 
    label: '柴芩配', 
    effect: '和解少阳，清热疏肝',
    description: '柴胡升散疏肝，黄芩清泄少阳胆火。一升一降，和解少阳。' 
  },
  { 
    names: ['附子', '干姜'], 
    label: '姜附配', 
    effect: '回阳救逆，温补脾肾',
    description: '附子走而不守，通行十二经；干姜守而不走，温中散寒。回阳之力大增。' 
  },
  { 
    names: ['黄芪', '当归'], 
    label: '芪归配', 
    effect: '气血双补，阳生阴长',
    description: '甘温除热，以气生血。' 
  }
];

const detectHerbPairs = (herbs: CalculatedHerb[]): HerbPair[] => {
  const herbNames = new Set(herbs.map(h => h.name));
  const pairs: HerbPair[] = [];

  COMMON_PAIRS.forEach(pair => {
    if (pair.names.every(n => herbNames.has(n))) {
      pairs.push({
        herbs: pair.names,
        name: pair.label,
        effect: pair.effect,
        type: 'synergy',
        description: pair.description
      });
    }
  });
  return pairs;
};

const estimateTwfc = (channels: string[]): BurnerWeights => {
  let u = 0, m = 0, l = 0;
  channels.forEach(c => {
    if (BURNER_RULES.UPPER.some(rule => c.includes(rule))) u++;
    else if (BURNER_RULES.MIDDLE.some(rule => c.includes(rule))) m++;
    else if (BURNER_RULES.LOWER.some(rule => c.includes(rule))) l++;
  });
  const total = u + m + l || 1;
  return { upper: u/total, middle: m/total, lower: l/total };
};

// ==========================================
// 通用物理引擎：三焦流注动力学 (Universal ODE Engine)
// ==========================================
export const runSanJiaoSimulation = (
  sanJiao: SanJiaoAnalysis, 
  netVector: Vector2D,
  adminMode: AdministrationMode = AdministrationMode.STANDARD
): SimulationSeriesPoint[] => {
  const series: SimulationSeriesPoint[] = [];
  const dt = 0.5; // time step (0.5 min for better resolution)
  const maxTime = 120; // 2 hours

  const physics = ADMIN_PHYSICS[adminMode];

  // ==========================================
  // 1. Initial State (Initial Energy Reserves)
  // ==========================================
  
  // Qz (Middle Burner - Gu Qi / Source):
  // Determined by Middle Burner PTI (digestive fire) + Admin Mode (Porridge energy).
  // A higher Middle PTI means more robust generation capability.
  const ptiMid = sanJiao.middle.pti; 
  let Qz = 40 + (ptiMid * 20) + physics.qzBoost;
  if (Qz < 10) Qz = 10; 
  
  // Qw (Upper Burner - Wei Qi / Defense):
  // Starts low, builds up from Gu Qi.
  let Qw = 2;

  // Qy (Lower Burner - Ying Yin / Nutritive):
  // Represents baseline Essence/Yin. Starts moderate.
  let Qy = 15;

  // ==========================================
  // 2. Coefficients (Rate Constants)
  // ==========================================
  
  // k1 (Uplift Rate): Gu Qi -> Wei Qi
  // Driven by: 
  //  a) Upper Burner Heat (PTI Upper) - "Heat rises"
  //  b) Lifting Vector (Net Vector Y > 0) - "Ascending direction"
  const ptiUp = sanJiao.upper.pti;
  const liftForce = Math.max(0, netVector.y); 
  const heatForce = Math.max(0, ptiUp);
  const k1 = (0.04 + (liftForce * 0.03) + (heatForce * 0.02)) * physics.kRateMult;

  // k2 (Yin Constraint): Lower Yin inhibits Upper Yang
  // "Ying Yin constrains Wei Qi" (K_control)
  // Driven by: Lower Burner PTI (if cold/astringent) and Sinking Vector.
  const ptiLow = sanJiao.lower.pti;
  // If Lower PTI is negative (Cold/Yin) or Vector Y is negative (Sinking), constraint increases.
  const sinkForce = Math.abs(Math.min(0, netVector.y));
  const k2 = 0.005 + (sinkForce * 0.01) + (Math.abs(Math.min(0, ptiLow)) * 0.01);

  // k3 (Descent Rate): Gu Qi -> Ying Yin
  // Driven by Sinking Vector and natural gravity
  const k3 = 0.02 + (sinkForce * 0.02);

  // k_out (Dispersal): Loss of Wei Qi to exterior (Sweating/Action)
  // Driven by Pungent flavor (Vector X) and Heat
  const disperseForce = Math.max(0, netVector.x);
  const k_out = 0.02 + (disperseForce * 0.03);

  for (let t = 0; t <= maxTime; t += dt) {
    // Record state every 1 min (integer steps)
    if (Math.abs(t % 1) < 0.001) {
       series.push({ 
        time: Math.round(t), 
        qz: parseFloat(Qz.toFixed(2)), 
        qw: parseFloat(Qw.toFixed(2)), 
        qy: parseFloat(Qy.toFixed(2)) 
      });
    }

    // ==========================================
    // 3. ODE Solver (Euler Method)
    // ==========================================
    
    // dQz/dt = - (Transfer to Upper) - (Transfer to Lower)
    // Gu Qi is consumed to create Wei and Ying.
    const flowToWei = k1 * Qz;
    const flowToYing = k3 * Qz;
    const dQz = -(flowToWei + flowToYing);

    // dQw/dt = (Inflow from Gu) - (Constraint by Ying) - (Dispersal)
    // The core equation: dQw = k1*Qz - k2*Qy - k_out*Qw
    // Note: Constraint is modeled as a drag factor proportional to Qy.
    // If Qy is high (Strong Yin), it holds Qw back.
    const yinConstraint = k2 * Qy * Qw; // Interaction term
    const dQw = flowToWei - yinConstraint - (k_out * Qw);

    // dQy/dt = (Inflow from Gu) - (Metabolic Consumption)
    const dQy = flowToYing - (0.01 * Qy);

    // Update States
    Qz += dQz * dt;
    Qw += dQw * dt;
    Qy += dQy * dt;

    // Boundary conditions
    if (Qz < 0) Qz = 0;
    if (Qw < 0) Qw = 0;
    if (Qy < 0) Qy = 0;
  }

  return series;
};


// ==========================================
// 核心计算引擎
// ==========================================

export const calculatePrescription = (
  rawHerbs: HerbRawData[], 
  constitution: Constitution = Constitution.NEUTRAL,
  adminMode: AdministrationMode = AdministrationMode.STANDARD,
  originalTotalDosageRef?: number
): AnalysisResult => {
  const currentTotalDosage = rawHerbs.reduce((sum, h) => sum + h.dosageGrams, 0);
  const D_total = originalTotalDosageRef || currentTotalDosage;

  // Constitution Multipliers
  const constMods = CONSTITUTION_MODIFIERS[constitution];

  const calculatedHerbs: CalculatedHerb[] = rawHerbs.map((h, index) => {
    const staticData = h.staticData;
    const temp = staticData?.temperature || Temperature.NEUTRAL;
    const hvBase = HV_MAP[temp] || 0;
    
    const deltaHV = h.processingMethod ? (PROCESSING_DELTAS[h.processingMethod] || 0) : 0;
    let hvCorrected = hvBase + deltaHV;

    // Apply Constitution Modifier
    if (hvCorrected > 0) hvCorrected *= constMods.heatMult;
    else if (hvCorrected < 0) hvCorrected *= constMods.coldMult;

    const flavors = staticData?.flavors || [Flavor.BLAND];
    const primaryFlavor = flavors[0];
    const wf = WF_MAP[primaryFlavor] || 1.0;
    const dr = D_total > 0 ? h.dosageGrams / D_total : 0;
    const contribution = hvCorrected * wf * dr;
    const burnerWeights = staticData?.twfc || estimateTwfc(staticData?.channels || []);

    // Vector Calculation
    const qiDir = staticData?.direction || QiDirection.NEUTRAL;
    const vecX = (FLAVOR_VECTOR_X[primaryFlavor] || 0) * Math.abs(contribution); 
    const vecY = (DIRECTION_VECTOR_Y[qiDir] || 0) * Math.abs(contribution);
    
    return {
      ...h,
      id: `herb-${index}-${h.name}`,
      staticData,
      temperature: temp,
      displayTemperature: getTemperatureLabelFromValue(hvCorrected),
      primaryFlavor: primaryFlavor,
      channels: staticData?.channels || [],
      qiDirection: qiDir,
      hvBase,
      deltaHV,
      hvCorrected,
      wf,
      dr,
      ptiContribution: contribution,
      burnerWeights,
      vector: { x: vecX, y: vecY }
    } as CalculatedHerb;
  });

  const totalPTI = calculatedHerbs.reduce((sum, h) => sum + h.ptiContribution, 0);

  // San Jiao Distribution Calculation
  const sj = { upper: 0, middle: 0, lower: 0 };
  calculatedHerbs.forEach(h => {
    sj.upper += h.ptiContribution * h.burnerWeights.upper;
    sj.middle += h.ptiContribution * h.burnerWeights.middle;
    sj.lower += h.ptiContribution * h.burnerWeights.lower;
  });

  // Calculate Net Vector
  let netX = 0;
  let netY = 0;
  calculatedHerbs.forEach(h => {
    netX += h.vector.x;
    netY += h.vector.y;
  });
  
  // Overall Vector Score (Legacy)
  let vectorScore = 0;
  calculatedHerbs.forEach(h => {
     if (h.qiDirection === QiDirection.LIFTING || h.qiDirection === QiDirection.SINKING) {
        vectorScore += h.ptiContribution;
     }
  });

  const totalAbsSJ = Math.abs(sj.upper) + Math.abs(sj.middle) + Math.abs(sj.lower) || 1;
  const sanJiao: SanJiaoAnalysis = {
    upper: { pti: sj.upper, percentage: (Math.abs(sj.upper)/totalAbsSJ)*100 },
    middle: { pti: sj.middle, percentage: (Math.abs(sj.middle)/totalAbsSJ)*100 },
    lower: { pti: sj.lower, percentage: (Math.abs(sj.lower)/totalAbsSJ)*100 },
    overallVector: vectorScore
  };

  const netVectorResult = { 
    x: netX, 
    y: netY, 
    magnitude: Math.sqrt(netX*netX + netY*netY), 
    angle: Math.atan2(netY, netX) * (180/Math.PI) 
  };

  const herbPairs = detectHerbPairs(calculatedHerbs);
  const sortedByAbs = [...calculatedHerbs].sort((a, b) => Math.abs(b.ptiContribution) - Math.abs(a.ptiContribution));

  // Run Dynamics Simulation (Integrated)
  const dynamics = runSanJiaoSimulation(sanJiao, netVectorResult, adminMode);

  return {
    totalPTI,
    initialTotalDosage: D_total,
    herbs: calculatedHerbs,
    top3: sortedByAbs.slice(0, 3),
    sanJiao,
    herbPairs,
    netVector: netVectorResult,
    dynamics
  };
};

// ==========================================
// 修复后的标签显示逻辑
// 严格对应 HV_MAP 的定义，避免区间重叠导致的显示错误
// ==========================================
// Great Heat (2.5), Heat (2.0), Warm (1.5), Slight Warm (1.0), Neutral (0), 
// Slight Cold (-1.0), Cool (-1.5), Cold (-2.0), Great Cold (-2.5).
export const getPTILabel = (pti: number) => {
  if (pti >= 2.2) return { label: '大热', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-600' };
  if (pti >= 1.8) return { label: '热', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-500' };
  if (pti >= 1.3) return { label: '温', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-500' };
  if (pti >= 0.8) return { label: '微温', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-500' };
  if (pti >= 0.3) return { label: '平偏温', color: 'text-lime-600', bg: 'bg-lime-50', border: 'border-lime-500' };
  if (pti > -0.3) return { label: '平', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-500' };
  if (pti > -0.8) return { label: '平偏凉', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-500' };
  if (pti > -1.3) return { label: '微寒', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-500' };
  if (pti > -1.8) return { label: '凉', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-500' };
  if (pti > -2.3) return { label: '寒', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-500' };
  return { label: '大寒', color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-700' };
};
