
import { AnalysisResult, Constitution, AdministrationMode, AISettings, ModelOption, BenCaoHerb } from "../types";

// ==========================================
// 1. Types & Interfaces for OpenAI API
// ==========================================

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string; 
}

export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

// ==========================================
// 2. Constants & System Instructions
// ==========================================

const FALLBACK_MODEL = "gpt-3.5-turbo";

export const DEFAULT_ANALYZE_SYSTEM_INSTRUCTION = `
# 角色：中医方剂学大医评鉴官
你是一位深谙《伤寒杂病论》、精通《神农本草经》的资深中医临床专家与方剂学家。你具备卓越的“方证逆推”能力，能从任何一张中药处方的结构、剂量与配伍中，深度还原拟方者的辨证思维、治疗意图，并**审慎评估其处方水平**。

## 核心分析原则

1.  **整体恒定**：始终以完整处方为分析单元，严禁孤立解读单味药的药效。
2.  **引经据典**：所有关键论断，必须明确引用中医经典原文（如《内经》、《伤寒论》、《金匮要略》、《温病条辨》等）或权威现代临床研究作为佐证。
3.  **思辨为本**：你的分析过程必须清晰地展现“推演→验证→质疑→再论证”的动态思辨循环。
4.  **术语纯粹**：全程使用标准、专业的中医术语体系（如脏腑、经络、气血津液、六经、三焦、卫气营血等），避免使用西医概念进行生硬比附。
5.  **客观审慎**：对疗效的预测和风险的评估必须保持客观、严谨，尊重临床复杂性，**不默认任何处方均为良方**，需以审视和质疑的眼光进行评估，避免任何夸大或绝对化的描述。所有的判断和猜测都必须用不确定性的词汇，例如，可能、提示等等，灵活根据语境选择不同的不确定性词汇，避免出现武断情况。
6.  **分级审视**：你要认识到，医师水平有别（工医、良医、名医、大医），其处方思路亦有高下之分。你的任务不仅是解释处方，更是要**评鉴其立法、配伍、用量的精妙或不足之处**。

## 分析工作流

请严格按照以下六个步骤，对给定的中药处方进行一次全面、深度、系统的分析。

### 第一步：方证逆推与病机定位

首先，对处方进行宏观的“方证逆推”，精准定位其所针对的核心病机。

1.  **君药识别与核心病机**：识别方中君药，阐述其剂量背后的考量，并由此逆推出处方的核心病机。引用经典条文论述该君药在此场景下的核心作用。
2.  **臣药辅佐与兼证推演**：分析臣药与君药的配伍关系，推演出患者可能存在的兼夹证候，并阐明此配伍的协同增效或监制毒副作用的意图。
3.  **佐使药群与细节完善**：解构佐使药群的功能，说明它们是如何调和药性、引经报使、或处理次要矛盾的。
4.  **病机三维坐标**：基于全方药味，从“病位”（脏腑/经络/层次）、“病性”（寒热虚实）和“病势”（升降出入/表里内外）三个维度，为该方所对应的病机进行精准画像，并详细阐述推理依据。

### 第二步：配伍解构与七情审查

深入方剂内部结构，以“药对”为核心，解析其精妙的配伍艺术与潜在风险。

1.  **核心药对解析**：识别方中最关键的1-3个核心药对。对每一个药对，从“七情关系”（相须、相使、相畏等）、“气味配伍”（寒热、攻补的平衡）、“归经协同”（靶向脏腑的协同或引导）三个层面进行深度解析。
2.  **配伍权重与君臣佐使**：分析不同药对在方中的剂量比例，评估其在整体功效中所占的权重，并以此印证君臣佐使的划分是否合理。
3.  **配伍禁忌扫描**：严格审查全方是否存在“十八反”、“十九畏”或妊娠禁忌等配伍问题。若存在，需引用文献探讨在特定病机下“反、畏”同用的可能性与风险控制要点。

### 第三步：气机动态学推演

模拟药物进入人体后的时空动态过程，从三焦和气机升降出入的视角，推演其作用过程与效应。

1.  **服药前气机状态预设**：基于第一步的病机分析，描绘出服药前上、中、下三焦各自的气机郁结或升降失常状态。
2.  **药后气机演变模拟 (T0-T6小时)**：
    *   **中焦运化阶段**：分析和胃、健脾药如何启动中焦，使药力得以化生和布散。
    *   **升降出入阶段**：阐述药物如何作用于上焦（宣发肃降）、中焦（枢纽转输）、下焦（气化开合），实现邪有出路、正气环转。
    *   **三焦权重分析**：判断此方剂的药力主要偏重于哪一焦，并结合六经或卫气营血理论解释其原因。
3.  **四维气机动向综合分析**：综合全方药性，从“升/降”、“浮/沉”、“开/合”、“寒/热”四个维度，判断该方的总体气机作用向量，并与经典方剂进行对比分析，揭示其独特的治疗特性。

### 第四步：多维审视与风险矩阵

启动批判性思维，通过反事实推演和风险评估，对方剂进行多维度的审视。

1.  **反事实推演**：选择以下情景进行推演，可灵活选择：
    *   **若去除君药**：方剂的治疗方向会发生何种改变？疗效会如何变化？
    *   **若改变君臣剂量比例**：方剂的攻补之势、寒热之性会如何偏移？
    *   **若加入一味反佐或对立药味（如苦寒药或辛热药）**：会产生何种正面或负面的影响？
2.  **临床风险评估**：
    *   **风险点识别**：明确指出此方在临床应用中可能存在的风险（如耗伤阴液、损伤脾胃、中病即止的度等），并引用文献或医案进行警示。
    *   **风险/收益象限定位**：将该方定位在“高风险-高收益”、“低风险-高收益”、“高风险-低收益”或“低风险-低收益”的哪个象限，并说明理由。
    *   **临床观察要点**：列出服药后需要密切观察的关键指标（如二便、汗、体温、脉象、舌象等），以及出现异常反应时的应对预案。
   *   **药代动力学**：从现代对中药材的研究文献和内容，从性味归经到成分，列出所有方剂药物的现代研究、成分作用，详细预判当前药方的药代动力学进行解读。

### 第五步：煎服策略的系统化筛选与辩证决策

此步骤旨在通过一套严谨的、非主观的筛选流程，精准定位需要进行特殊煎煮处理的药物，并对其进行深度辩证，以确保最终方案完全服务于本方的核心治疗意图。

#### 1. 第一阶段：基于药性分类的“通用规则”初步筛选

**任务指令**：你的首要任务是扮演一名严谨的药剂师，对全方进行一次无差别的、基于常规药理分类的扫描。你必须创建一个清单，将方中所有符合以下任一条件的药物识别并归类。

*   **A. 芳香/挥发类（常规需后下以取其气）**：
    *   **识别结果**：[AI填充所有符合此类的药名，若无则填写“无”]
*   **B. 行气/活血类（其功效依赖辛散走窜之性）**：
    *   **识别结果**：[AI填充所有符合此类的药名，若无则填写“无”]
*   **C. 解表类（常规认为不宜久煎）**：
    *   **识别结果**：[AI填充所有符合此类的药名，若无则填写“无”]
*   **D. 贵重/特殊类（常规需另炖、烊化以保全药效）**：
    *   **识别结果**：[AI填充所有符合此类的药名，若无则填写“无”]
*   **E. 矿石/贝壳/有毒类（常规需先煎以释出成分或降低毒性）**：
    *   **识别结果**：[AI填充所有符合此类的药名，若无则填写“无”]

#### 2. 煎煮法的“可能性空间”探索

**任务指令**：现在，对你上面选出的每一个药物或药组，严格按照以下“开放式探索模板”进行填充式分析。你的任务是探索不同煎法如何改变药性，并评估这些改变对本方核心治疗意图的利弊。

**【开放式探索模板】**
---
**辩证对象：** [AI填充所选药名]

*   **核心属性与常规用法**：
    *   **性味归经**：[AI填充该药的性味归经]
    *   **常规认知**：[AI填充该药在常规方剂中的作用定位与常用煎法]

*   **多路径推演（结合本方方意）**：
    *   **路径 A：若采用【久煎】**
        *   **药性变化**：[AI填充：其药性（如气、味、质）会发生何种变化？还是...]
        *   **对方意影响**：[AI填充：这种变化将如何影响本方“【此处AI应自动引用本方的核心治疗意图】”的实现？是增强、削弱还是转化？]

    *   **路径 B：若采用【后下】**
        *   **药性变化**：[AI填充：其挥发性成分得以保留，药性会如何变化？还是...]
        *   **对方意影响**：[AI填充：这种变化对实现本方核心意图是利大于弊，还是弊大于利？为什么？]
---
    *   **中医饮食禁忌**：依据药性和病机，提出服药期间的详细饮食宜忌建议，并解释原因。
    *   **西医交互警示**：根据现代药理研究，明确指出方中哪些药物可能与常见的西药，发生相互作用，并提出具体的西医检查或监测建议以确保用药安全。

### 第六步：综合论证与最终诊断

最后，整合以上所有分析，形成一个高度凝练、融会贯通的最终论断。

1.  **拟方者思维画像**：用一段话精准概括出拟方者的核心辨证思路、治疗策略、以及其对疾病传变规律的深刻洞察。
2.  **核心治疗意图解码**：解码出处方背后三个层次的治疗意图：一级（显性，针对主症）、二级（隐性，兼顾夹杂）、三级（预防性，防止传变）。
3.  **最终诊断结论**：基于完整的方证逆推，给出一个最可能的中医诊断（包括病名和证候），并简要总结此方的优势、局限性以及适用的核心人群特征。
4.  **方剂水平评级**：综合以上所有分析，对该方剂的配伍水平、辨证精准度、立法巧妙程度进行一个综合评级（例如：工医之方、良医之方、名医之方），并给出简要评语。

# 输出格式：专业级HTML报告

**任务指令**：你不仅是一位中医专家，也是一位精通信息可视化的报告设计师。请将以上分析内容，严格按照以下设计规范，生成一份专业、美观、易读的HTML报告。

**重要要求：**
1. **必须输出完整的HTML**，以 \`<!DOCTYPE html>\` 开头，**必须**以 \`</html>\` 结尾。
2. **切分与续写**：由于内容较长，如果你一次无法输出完整，**必须**在下次回答时无缝衔接，不要重复上文，也不要输出多余的Markdown标记（如 \`\`\`html）。
3. **严格的结束标志**：只有当你输出了 \`</html>\` 标签时，才算任务结束。在此之前，不要停止生成。
4. **精炼策略**：此报告内容应**精炼而深刻**，**言简意赅，切中要害**。请不要堆砌辞藻，务必**以最少的文字揭示最核心的洞见**。

### 1. HTML结构规范

*   使用 \`<!DOCTYPE html>\` 和 \`<html>\` 标签。
*   在 \`<head>\` 中嵌入 \`<style>\` 标签，用于定义所有CSS样式。
*   主体内容使用语义化标签，如 \`<main>\`, \`<article>\`, \`<section>\`, \`<h2>\`, \`<h3>\`, \`<p>\`, \`<table>\`, \`<ul>\`, \`<li>\`。
*   整个报告应包含在一个主容器 \`<div class="container">\` 中。

### 2. 设计系统与CSS风格指南

请在 \`<style>\` 标签内，严格使用以下CSS代码作为你的设计基础。

\`\`\`css
/* --- 设计系统：CSS变量定义 --- */
:root {
    --primary-color: #8B0000; /* 丹砂红: 用于主标题和强调 */
    --secondary-color: #2F4F4F; /* 苍艾色: 用于次级标题和表格头部 */
    --accent-color: #D2691E; /* 琥珀色: 用于点缀、边框和特殊模块 */
    --bg-color: #F9F7F2; /* 宣纸白: 页面背景 */
    --content-bg: #FFFFFF; /* 内容区白 */
    --text-color: #333333; /* 主要文本颜色 */
    --highlight-bg: #FFFBEB; /* 淡米黄: 用于高亮背景，如box */
    --border-color: #EAEAEA; /* 边框灰 */
}

/* --- 基础样式 --- */
body {
    font-family: 'Helvetica Neue', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei', sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.9;
    margin: 0;
    padding: 20px;
}
.container {
    max-width: 1200px;
    margin: 20px auto;
    background: var(--content-bg);
    padding: 30px 50px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    border-radius: 8px;
    border-top: 8px solid var(--primary-color);
}

/* --- 排版样式 --- */
h1 {
    color: var(--primary-color);
    text-align: center;
    font-size: 2.6em;
    font-weight: 600;
    border-bottom: 3px solid var(--accent-color);
    padding-bottom: 15px;
    margin-bottom: 40px;
}
h2 {
    color: var(--secondary-color);
    border-left: 5px solid var(--accent-color);
    padding-left: 15px;
    margin-top: 50px;
    font-size: 2em;
    font-weight: 600;
    background: linear-gradient(to right, #f5f5f5, transparent);
    padding-top: 8px;
    padding-bottom: 8px;
}
h3 {
    color: var(--primary-color);
    font-weight: 600;
    margin-top: 30px;
    font-size: 1.5em;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
}
p {
    margin: 15px 0;
}
ul {
    list-style-type: disc;
    padding-left: 25px;
}

/* --- 组件样式 --- */
.critique-box {
    border: 2px dashed var(--accent-color);
    background-color: var(--highlight-bg);
    padding: 20px;
    margin: 25px 0;
    border-radius: 6px;
    position: relative;
    font-style: italic;
}
.critique-box::before {
    content: "辩证审视";
    position: absolute;
    top: -15px;
    left: 20px;
    background: var(--accent-color);
    color: white;
    padding: 4px 12px;
    font-size: 0.9em;
    font-weight: bold;
    border-radius: 4px;
}
.herb-tag {
    display: inline-block;
    padding: 3px 10px;
    margin: 2px 4px;
    border-radius: 12px;
    font-size: 0.9em;
    font-weight: 500;
    border: 1px solid;
}
.herb-king { background-color: #FEE; color: var(--primary-color); border-color: var(--primary-color); }
.herb-minister { background-color: #E6F7FF; color: #00529B; border-color: #00529B; }
.herb-assistant { background-color: #E6FFED; color: #006400; border-color: #006400; }
.warning-box {
    color: #9F6000;
    background-color: #FEEFB3;
    padding: 15px 20px;
    border-radius: 5px;
    border-left: 5px solid #9F6000;
    margin: 20px 0;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 25px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
th, td {
    border: 1px solid var(--border-color);
    padding: 12px 15px;
    text-align: left;
}
th {
    background-color: var(--secondary-color);
    color: white;
    font-weight: 600;
}
tr:nth-child(even) {
    background-color: #f9f9f9;
}
\`\`\`
`;

const CHAT_SYSTEM_INSTRUCTION = (analysis: AnalysisResult, prescription: string, report: string | undefined): string => `
你是一位专业的中医处方研讨助手 (TCM Discussion Agent)。
你的任务是基于现有的计算数据和AI报告，与用户进行互动研讨，并根据用户的指令执行特定任务。

**核心指令:**
1. **忠于数据**: 你的所有分析都必须基于下面提供的【静态计算数据】和【AI深度报告】。
2. **工具优先**: 当用户的意图符合工具描述时（修改处方、重构报告），必须优先调用工具，而不是自己生成文本回复。
3. **简明扼要**: 回答问题要直接、清晰。

---
### **当前处方上下文 (Current Context)**

**1. 原始输入处方:**
\`\`\`
${prescription}
\`\`\`

**2. 静态计算数据 (Static Calculation Data):**
*   **总寒热指数 (Total PTI):** ${analysis.totalPTI.toFixed(2)}
*   **君药 (Top Herb):** ${analysis.top3[0]?.name || 'N/A'}
*   **三焦分布 (San Jiao %):** 上焦 ${analysis.sanJiao.upper.percentage.toFixed(0)}%, 中焦 ${analysis.sanJiao.middle.percentage.toFixed(0)}%, 下焦 ${analysis.sanJiao.lower.percentage.toFixed(0)}%

**3. AI 深度报告 (AI Deep Analysis Report):**
${report ? `\`\`\`html\n${report}\n\`\`\`` : "报告尚未生成。"}
---
`;

// ==========================================
// 3. Helper Functions
// ==========================================

const getHeaders = (apiKey: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
});

const getBaseUrl = (url?: string) => {
    let base = url ? url.trim() : "https://api.openai.com/v1";
    if (base.endsWith('/')) base = base.slice(0, -1);
    if (!base.endsWith('/v1') && !base.includes('/v1/')) base += '/v1';
    return base;
};

// Robustly clean JSON string from Markdown
const cleanJsonString = (str: string): string => {
    // 1. Try to find content within ```json ... ``` or ``` ... ```
    const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    // 2. If no code blocks, just return trimmed string (hope it's raw JSON)
    return str.trim();
};

// ==========================================
// 4. Service Functions
// ==========================================

/**
 * Test Connection
 */
export const testModelConnection = async (baseUrl: string, apiKey: string): Promise<string> => {
    try {
        const models = await fetchAvailableModels(baseUrl, apiKey);
        return `连接成功！共发现 ${models.length} 个可用模型。`;
    } catch (e: any) {
        throw new Error(`连接失败: ${e.message}`);
    }
}

/**
 * Fetch available models from standard /v1/models endpoint
 */
export const fetchAvailableModels = async (baseUrl: string, apiKey: string): Promise<ModelOption[]> => {
    try {
        const url = `${getBaseUrl(baseUrl)}/models`;
        const res = await fetch(url, { headers: getHeaders(apiKey) });
        
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to fetch models: ${res.status} ${err}`);
        }

        const data = await res.json();
        // Standard OpenAI format: { data: [{id: "model-id", ...}] }
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((m: any) => ({ id: m.id, name: m.id }));
        }
        return [];
    } catch (e) {
        console.error("Model fetch error:", e);
        throw e;
    }
};

/**
 * Generate structured Herb Data (JSON Mode)
 */
export const generateHerbDataWithAI = async (herbName: string, settings: AISettings): Promise<BenCaoHerb | null> => {
    if (!settings.apiKey) throw new Error("API Key is missing");

    const systemPrompt = `你是一位精通《中华人民共和国药典》(2025版)的中药学专家。
你的任务是为名为"${herbName}"的中药补充详细数据。
请严格按照以下 JSON 格式返回数据，不要包含任何 Markdown 格式。

**非常重要：**
"nature" (四气) 字段必须严格从以下枚举中选取一个，**严禁使用其他描述**，严禁使用“性”字前缀：
["大热", "热", "温", "微温", "平", "微寒", "凉", "寒", "大寒"]

**严格区分凉与寒：**
- **凉 (Cool)**: 对应枚举值 "凉"。
- **寒 (Cold)**: 对应枚举值 "寒"。
- 如果该药性味为“苦寒”，nature字段只能填“寒”，flavors字段填“苦”。
- 如果该药性味为“辛凉”，nature字段只能填“凉”，flavors字段填“辛”。
- **绝对不要**使用“微凉”、“大凉”等非标准词汇。

{
  "name": "${herbName}",
  "nature": "枚举值之一，如: 温",
  "flavors": ["五味数组", "例如", "辛", "苦"],
  "meridians": ["归经数组", "例如", "肝", "脾"],
  "efficacy": "功能主治 (简练概括)",
  "usage": "用法用量 (例如: 3~9g)",
  "category": "药材 或 炮制品",
  "processing": "如有炮制方法则填，否则填 生用"
}
如果该药材不存在或无法确认，请返回 null。`;

    try {
        const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
        const payload = {
            model: settings.analysisModel || "gpt-3.5-turbo",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: herbName }],
            temperature: 0.1, // Low temp for strict format
            // response_format: { type: "json_object" } // Optional depending on model support
        };
    
        const res = await fetch(url, {
            method: "POST",
            headers: getHeaders(settings.apiKey),
            body: JSON.stringify(payload)
        });
    
        if (!res.ok) throw new Error("API call failed");
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const json = JSON.parse(cleanJsonString(content));
        // Map to BenCaoHerb type
        return {
             id: `custom-${Date.now()}`,
             name: json.name || herbName,
             nature: json.nature,
             flavors: json.flavors || [],
             meridians: json.meridians || [],
             efficacy: json.efficacy,
             usage: json.usage,
             category: json.category,
             parentHerb: undefined,
             processing: json.processing,
             isRaw: false
        } as BenCaoHerb;
    } catch (e) {
        console.error("Failed to parse AI response", e);
        return null;
    }
};

/**
 * Analyze Prescription (Streaming Generation)
 */
export async function* analyzePrescriptionWithAI(
    analysis: AnalysisResult,
    prescriptionInput: string,
    constitution: Constitution,
    adminMode: AdministrationMode,
    settings: AISettings,
    regenerateInstructions?: string,
    existingReport?: string 
): AsyncGenerator<string, void, unknown> {
    const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
    
    const context = `
    【患者体质】: ${constitution}
    【服药方式】: ${adminMode}
    【处方原文】: ${prescriptionInput}
    【计算数据】: 总寒热指数 ${analysis.totalPTI.toFixed(2)} ( >0 热, <0 寒); 
    【三焦分布】: 上焦 ${analysis.sanJiao.upper.percentage.toFixed(0)}%, 中焦 ${analysis.sanJiao.middle.percentage.toFixed(0)}%, 下焦 ${analysis.sanJiao.lower.percentage.toFixed(0)}%
    【君药(推测)】: ${analysis.top3[0]?.name} (贡献度 ${analysis.top3[0]?.ptiContribution.toFixed(2)})
    `;

    const messages: OpenAIMessage[] = [
        { role: "system", content: settings.systemInstruction || DEFAULT_ANALYZE_SYSTEM_INSTRUCTION },
    ];

    if (existingReport) {
        messages.push({ role: "user", content: `请对以下处方进行深度分析:\n${context}` });
        messages.push({ role: "assistant", content: existingReport });
        messages.push({ role: "user", content: "You were cut off. Please continue generating the report from exactly where you left off. Do not repeat any of the provided content or add introductory phrases like 'Continuing from where I left off...'. Just output the rest of the HTML code directly." });
    } else {
        messages.push({ role: "user", content: `请对以下处方进行深度分析:\n${context}` });
        if (regenerateInstructions) {
            messages.push({ role: "user", content: `补充指令: ${regenerateInstructions}` });
        }
    }

    const payload = {
        model: settings.analysisModel || FALLBACK_MODEL,
        messages: messages,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens || 4000,
        stream: true
    };

    const res = await fetch(url, {
        method: "POST",
        headers: getHeaders(settings.apiKey),
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI Analysis Failed: ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.trim().startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") {
                    return;
                }
                try {
                    const json = JSON.parse(dataStr);
                    const chunk = json.choices[0]?.delta?.content;
                    if (chunk) {
                        yield chunk;
                    }
                } catch (e) {
                    // Ignore parsing errors for incomplete chunks
                }
            }
        }
    }
};

/**
 * Chat Stream Generation
 */
export async function* generateChatStream(
    history: OpenAIMessage[],
    analysis: AnalysisResult,
    prescription: string,
    reportContent: string | undefined,
    settings: AISettings
): AsyncGenerator<{ text?: string, functionCalls?: any[] }, void, unknown> {
    const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
    
    const systemMsg: OpenAIMessage = {
        role: "system",
        content: CHAT_SYSTEM_INSTRUCTION(analysis, prescription, reportContent)
    };

    // Ensure system message is first
    const messages = [systemMsg, ...history];

    const payload = {
        model: settings.chatModel || FALLBACK_MODEL,
        messages: messages,
        temperature: 0.7,
        stream: true,
        tools: [
            {
                type: "function",
                function: {
                    name: "update_prescription",
                    description: "User wants to modify the prescription (add/remove herbs, change dosage)",
                    parameters: {
                        type: "object",
                        properties: {
                            prescription: { type: "string", description: "The full new prescription string" }
                        },
                        required: ["prescription"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "regenerate_report",
                    description: "User wants to regenerate the analysis report with specific instructions",
                    parameters: {
                        type: "object",
                        properties: {
                            instructions: { type: "string", description: "Specific instructions for regeneration" }
                        },
                        required: ["instructions"]
                    }
                }
            }
        ]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: getHeaders(settings.apiKey),
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Chat Stream Failed: ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    // Track partial tool calls
    let currentToolCalls: { [index: number]: { id: string, name: string, args: string } } = {};

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data: ")) continue;
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;

                try {
                    const json = JSON.parse(dataStr);
                    const delta = json.choices[0].delta;
                    
                    if (delta.content) {
                        yield { text: delta.content };
                    }
                    
                    if (delta.tool_calls) {
                        delta.tool_calls.forEach((toolDelta: any) => {
                            const index = toolDelta.index;
                            if (!currentToolCalls[index]) {
                                currentToolCalls[index] = { id: '', name: '', args: '' };
                            }
                            if (toolDelta.id) currentToolCalls[index].id = toolDelta.id;
                            if (toolDelta.function?.name) currentToolCalls[index].name = toolDelta.function.name;
                            if (toolDelta.function?.arguments) currentToolCalls[index].args += toolDelta.function.arguments;
                        });
                    }
                } catch (e) {
                    // ignore parse error of chunk
                }
            }
        }
        
        // Finalize tool calls
        const toolCallsArray = Object.values(currentToolCalls);
        if (toolCallsArray.length > 0) {
            const parsedCalls = toolCallsArray.map(tc => {
                try {
                    return {
                        id: tc.id,
                        name: tc.name,
                        args: JSON.parse(tc.args)
                    };
                } catch(e) {
                    return null;
                }
            }).filter(c => c !== null);
            
            if (parsedCalls.length > 0) {
                yield { functionCalls: parsedCalls };
            }
        }

    } finally {
        reader.releaseLock();
    }
}
