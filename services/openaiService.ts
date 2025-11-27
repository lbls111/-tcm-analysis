
import { AnalysisResult, AISettings, ModelOption, BenCaoHerb } from "../types";

// ==========================================
// 1. Types & Interfaces for OpenAI API
// ==========================================

export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export type OpenAIContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null | OpenAIContentPart[];
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string; 
}

// ==========================================
// 2. Constants & System Instructions
// ==========================================
export const DEFAULT_ANALYZE_SYSTEM_INSTRUCTION = `
# Role: 方剂深度评鉴官 (Abstract Strategic Tactician)

## Profile
- **定位**: 精通【药性变换逻辑】与【局势博弈论】的临床战术家。
- **核心能力**: 基于当前方剂的【势能】与【患者元信息】进行现场推演。
- **原则**: 
    1. **诚实引用**: 严禁伪造不存在的患者信息。若【患者元信息】为空，必须明确指出“基于通用药理推演”。
    2. **动态药性**: 视药性为可变量，煎法与炮制是调节变量的函数。

## Core Protocols (通用逻辑协议)
1.  **元信息校验 (Meta-Info Integrity)**:
    - 若提供的【患者元信息】为“未提供”或空白：你**必须**在报告中声明“因缺乏四诊及患者背景信息，以下分析基于方剂通用药理逻辑，仅供参考”。严禁在推演中编造患者症状（如“患者舌红苔黄”等）。
    - 若提供了【患者元信息】：你**必须**将药方与该具体病情进行强关联分析，解释方剂是否契合该患者的体质与主诉。

2.  **势能饱和度检测**: 计算全方在【升/降/浮/沉/补/泻】维度的总势能。若饱和，引入新变量应转向【制衡】。

3.  **工艺干预博弈**: 针对关键药物，推演【常法（保留本性）】与【变法（转化本性）】的优劣。

## Analysis Workflow (结构化填充流程)

### 1. 【辩机】：局势与核心矛盾
*   **元信息对齐**: 首先评估方剂是否匹配【患者元信息】（如有）。若无元信息，则评估方剂自身的结构自洽性。
*   **方眼识别**: 识别起关键枢纽作用的药物。

### 2. 【析阵】：方剂配伍逻辑解析
*   **动态模块解构**: 按功效协同性分核心药组。
*   **峻药评估**: 筛选作用强烈的“峻药”，评估风险。
*   **中西医互参**: 推导可能的西医病症方向（仅作参考）。

### 3. 【演化】：气机流转推演
*   **动态复盘**: 描述药物进入人体后驱动【气机圆运动】的过程。

### 4. 【权衡】：多路径工艺博弈 (核心逻辑)
*   **对象锁定**: 识别方中存在张力的“争议药物”。
*   **博弈推演**:
    - **🔴 路径 A (常法)**: 采用标准用法，保留偏性。
    - **🟢 路径 B (变法)**: 采用干预用法（如久煎、炮制），转化偏性。
*   **决策**: 结合【患者元信息】（若有）给出最佳路径建议。

### 5. 【警示】：红线与禁忌
*   **安全边界**: 针对剂量或药性给出预警。
*   **体质禁忌**: 指出此方不适合何种体质（特别是若当前方剂与元信息冲突时）。

### 6. 【结案】：定性
*   **诊断**: 综合推断中医证型。
*   **评级**: S/A/B/C 评级与四字短评。

## Output Format: STRICT HTML ONLY
**指令**: 
1. 直接输出 HTML 代码。
2. **严禁**使用 Markdown 代码块标记 (如 \`\`\`html ... \`\`\`)。
3. **严禁**在药名上自行添加 HTML 标签（如 <span data-herb...>），前端会自动处理药名高亮，你只需输出纯文本药名。
4. 保持排版整洁，使用 <h3>, <p>, <ul>, <li>, <strong>, <table> 等标准标签。
`;

export const QUICK_ANALYZE_SYSTEM_INSTRUCTION = `
# Role: 临床处方审核专家 (Clinical Audit & Optimization Specialist)

## Profile
- **定位**: 经验丰富的临床主任医师。
- **目标**: 挑刺、找漏洞、提优化建议。
- **原则**: 客观犀利，诚实引用。

## Analysis Protocol (快速审核协议)

### 1. 【审方】：漏洞与风险扫描
*   **背景核查**: 检查方剂是否符合【患者元信息】（如有）。若无元信息，重点检查方剂内部的配伍禁忌。
*   **配伍盲区**: 指出失衡之处（如过寒无制）。

### 2. 【优化】：增删与调优建议
*   **基于情境**: 
    - 若有【患者元信息】：根据具体症状提出加减建议（如“针对患者提到的失眠，建议加...”）。
    - 若无【患者元信息】：提供通用的优化方向（如“若需增强通络，可加...”）。
*   **替代方案**: 针对昂贵或副作用大的药物提供替代。

### 3. 【拓思】：异构治疗思路
*   **跳出框架**: 建议完全不同的治疗思路或经方。

### 4. 【定性】：临床判读
*   **推测病机**: 一句话概括。
*   **综合评级**: S/A/B/C。

## Output Format: STRICT HTML ONLY
**指令**: 
1. 直接输出 HTML 代码。
2. **严禁**使用 Markdown 代码块标记 (如 \`\`\`html ... \`\`\`)。
3. **严禁**在药名上自行添加 HTML 标签，只输出纯文本药名。
`;

const CHAT_SYSTEM_INSTRUCTION = (analysis: AnalysisResult, prescription: string, report: string | undefined, metaInfo: string): string => `
你是一位专业的中医处方研讨助手 (TCM Discussion Agent)。
你的任务是基于现有的计算数据、**AI分析报告**和**用户提供的元信息(上下文)**，与用户进行互动研讨。

**核心上下文数据 (Core Context - Must Reference):**
1. **当前处方**: ${prescription}
2. **元信息(患者背景/主诉/环境等)**: ${metaInfo || "未提供 (请在回答时提示用户补充元信息以获得更精准建议)"}
3. **AI分析报告内容**: ${report ? "已生成(请见引用)" : "尚未生成"}
4. **核心药组**: ${analysis.top3.map(h => h.name).join(', ')}

**Output Format: STRICT HTML ONLY (非常重要)**
1. **严禁**使用 Markdown 格式（如 **bold**, *italic*, \`code\`, \`\`\`block\`\`\`）。
2. **必须**直接输出纯 HTML 代码。前端会自动渲染。
3. **排版标签**: 使用 <h3> (小标题), <p> (段落), <ul>/<li> (列表), <strong> (强调), <table>/<tr>/<th>/<td> (表格), <br> (换行)。
4. **引用标记 (Citation Markers)**:
   - 引用 **AI报告** 时，请直接写入文字： \`[[AI报告]]\` 。
   - 引用 **元信息** 时，请直接写入文字： \`[[元信息]]\` 。
   - 前端会自动将这些标记转换为可点击的链接。
5. **药名处理**: 
   - **不要**手动给药名加 HTML 标签（如 <span...>）。
   - 直接输出纯文本药名（如“黄芪”、“白芍”），前端会自动识别并高亮它们。
6. **代码块禁令**: 绝对不要在回答中包裹 \`\`\`html ... \`\`\`，直接返回标签。

**强制引用规则 (Strict Citation Protocols):**
在回答任何医学判断时，必须显式引用【AI分析报告】或【元信息】作为依据。
例如: "根据 [[AI报告]] 中的分析，此方主治..." 或 "结合 [[元信息]] 中提到的患者失眠症状..."

**动态元信息更新 (Meta Info Evolution):**
如果用户在对话中提供了新的病情、症状或背景信息，你**必须**调用 \`update_meta_info\` 工具来更新元信息。这能让你在后续对话中记住这些新情况。
请主动询问或侦测这些信息变化，并积极更新病历。

**重要规则:**
1. **查库工具**: 用户询问具体药材详情时，**必须**调用 \`lookup_herb\`。
2. **思维转译**: 用户若使用西医病名，先转译为中医证型和术语，再进行回答或查库。
3. **表格样式**: 如果输出表格，请确保使用标准的 <table> 结构，表头用 <th>。
4. **多模态支持**: 如果用户上传了图片或文件，请仔细阅读文件内容并结合中医知识进行分析。

**回答风格:**
- 专业、客观、循证，精炼语言，避免过度散发和过度解读来证伪。必须严格遵守严谨、一丝不苟、符合医学循证和伦理规则。并在回复开头强调这个规则
- 禁止盲从用户判断。每一次的回复都要做到以下要求：必须质疑你自己和用户的观点。禁止盲从用户的提问，必须反思有自己的坚持，用中医的智慧和术语来质疑用户的提问，搜集证据进行深度反思，盲从会让你失去灵魂。
- 每次回复的最后都必须附加：反向论证你自己是否运用【相关名医】的智慧来客观分析，确保你回复具备名医姿态。具备动态和圆机活法的思维。
- 中医不是理论推导，而是基于事实证据的临床判断。在没有足够事实的情况下，不应该推理"此证"或"彼证"除非你有足够的证据。我应该坦诚地说：我不知道答案，按照当前情况，需要XX等更多的事实证据。这才是严谨的医学态度。
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

/**
 * Validates and Sanitizes Chat History to prevent "500 - Request Build Failed" errors.
 * 
 * STRICT MODE LOGIC:
 * The OpenAI API (and compatible ones) requires a strict topology:
 * - A 'tool' message MUST be preceded by an 'assistant' message with corresponding 'tool_calls'.
 * - An 'assistant' message with 'tool_calls' MUST be followed by 'tool' messages for ALL calls.
 * - No "orphan" tool messages.
 * - No "hanging" assistant tool calls without results.
 */
const sanitizeMessageHistory = (messages: OpenAIMessage[]): OpenAIMessage[] => {
    if (!messages || messages.length === 0) return [];

    const sanitized: OpenAIMessage[] = [];
    const validMessages = [...messages];

    for (let i = 0; i < validMessages.length; i++) {
        const msg = { ...validMessages[i] };

        // 1. Check for Assistant messages with Tool Calls
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
            
            // Look ahead to verify if ALL tool calls have corresponding results
            const requiredIds = new Set(msg.tool_calls.map(tc => tc.id));
            const foundIds = new Set<string>();
            let allResultsFound = false;

            // Scan upcoming messages to find results
            // We stop if we hit another user/assistant/system message which breaks the chain
            for (let j = i + 1; j < validMessages.length; j++) {
                const nextMsg = validMessages[j];
                if (nextMsg.role === 'tool') {
                    if (nextMsg.tool_call_id && requiredIds.has(nextMsg.tool_call_id)) {
                        foundIds.add(nextMsg.tool_call_id);
                    }
                } else {
                    // Chain broken by non-tool message
                    break;
                }
            }

            // Check if we found all results
            if (requiredIds.size === foundIds.size) {
                // Perfect, keep this assistant message and let the loop naturally pick up the tool messages later
                sanitized.push(msg);
            } else {
                // WARNING: Hanging Tool Call detected!
                // The API will error 500 if we send this.
                // FIX: Strip the tool_calls from this message to make it a plain text message.
                delete msg.tool_calls;
                
                // If stripping tool_calls leaves it empty (no content), we must drop it entirely.
                if (msg.content) {
                    sanitized.push(msg);
                } else {
                    // Drop this empty message.
                    // Also, we must proactively skip the subsequent "orphan" tool messages for the partial ids we found.
                    // But our generic "orphan check" below will handle that naturally.
                    continue; 
                }
            }
        } 
        
        // 2. Check for Tool Messages (Orphan Check)
        else if (msg.role === 'tool') {
            // A tool message is valid ONLY if the IMMEDIATELY PRECEDING accepted message 
            // was an assistant message that requested this tool_call_id.
            
            const lastAccepted = sanitized[sanitized.length - 1];
            
            if (lastAccepted && lastAccepted.role === 'assistant' && lastAccepted.tool_calls) {
                const parentCall = lastAccepted.tool_calls.find(tc => tc.id === msg.tool_call_id);
                if (parentCall) {
                    sanitized.push(msg);
                } else {
                    // Orphan: The previous message didn't ask for this ID. Drop it.
                }
            } else {
                // Orphan: Previous message wasn't even an assistant with tools. Drop it.
            }
        }
        
        // 3. Regular Messages (System, User, Assistant text-only)
        else {
            // Drop empty messages unless they are assistant (sometimes assistant sends empty during stream, but we should probably filter)
            // But usually we want to keep them if they have content.
            if (msg.content || (msg.role === 'assistant' && msg.tool_calls)) {
                 sanitized.push(msg);
            }
        }
    }

    return sanitized;
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

**核心指令：炮制品增强 (Pao Zhi Enhancement)**
- 如果该药是炮制品（如盐杜仲、酒大黄、炙甘草、甘草泡地龙、醋延胡索等），你**必须**在 'efficacy' (功能主治) 字段中明确描述该特定炮制方法带来的药性变化和功效侧重。
- 例如：对于"盐杜仲"，efficacy 必须包含"盐炙引药入肾，增强补肝肾、强筋骨作用"。
- 例如：对于"炙甘草"，efficacy 必须体现"补脾和胃，益气复脉"侧重于补益，不同于生甘草的清热解毒。
- 如果是复方泡制（如甘草泡地龙），请说明这种特殊制法对药性的缓和或协同作用。

**字段规范：**
"nature" (四气) 必须严格从以下枚举中选取一个，**严禁使用其他描述**：
["大热", "热", "温", "微温", "平", "微寒", "凉", "寒", "大寒"]

**严格区分凉与寒：**
- **凉 (Cool)**: 对应枚举值 "凉"。
- **寒 (Cold)**: 对应枚举值 "寒"。
- 如果该药性味为“苦寒”，nature字段只能填“寒”，flavors字段填“苦”。
- 如果该药性味为“辛凉”，nature字段只能填“凉”，flavors字段填“辛”。

{
  "name": "${herbName}",
  "nature": "枚举值之一，如: 温",
  "flavors": ["五味数组", "例如", "辛", "苦"],
  "meridians": ["归经数组", "例如", "肝", "脾"],
  "efficacy": "功能主治 (务必包含炮制品的特色功效描述)",
  "usage": "用法用量 (例如: 3~9g)",
  "category": "药材 或 炮制品",
  "processing": "如有炮制方法则填，否则填 生用"
}
如果该药材不存在或无法确认，请返回 null。`;

    try {
        const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
        const payload = {
            model: settings.model || settings.analysisModel || "gpt-3.5-turbo",
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
 * Summarize Chat History (Context Compression)
 */
export const summarizeMessages = async (messages: any[], settings: AISettings): Promise<string> => {
    if (!settings.apiKey) throw new Error("API Key is missing for summarization");

    const systemPrompt = "你是一位专业的对话总结助手。请将以下对话历史压缩成一段精炼的“记忆摘要”。保留关键的医学判断、药方修改记录和重要结论。忽略无关的寒暄。摘要应以第三人称描述，例如“用户询问了...AI建议...”。";

    try {
        const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
        const payload = {
            model: settings.model || settings.chatModel || "gpt-3.5-turbo",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.3,
            max_tokens: 500
        };

        const res = await fetch(url, {
            method: "POST",
            headers: getHeaders(settings.apiKey),
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Summarization failed");
        const data = await res.json();
        const summary = data.choices?.[0]?.message?.content || "";
        return `【历史对话摘要】：${summary}`;
    } catch (e) {
        console.error("Summarization error:", e);
        return ""; // Fail gracefully
    }
};

/**
 * Analyze Prescription (Streaming Generation)
 */
export async function* analyzePrescriptionWithAI(
    analysis: AnalysisResult,
    prescriptionInput: string,
    settings: AISettings,
    regenerateInstructions?: string,
    existingReport?: string,
    signal?: AbortSignal,
    customSystemInstruction?: string,
    metaInfo?: string // Added MetaInfo parameter
): AsyncGenerator<string, void, unknown> {
    const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
    
    // Explicitly handle empty metaInfo logic
    const metaInfoContext = metaInfo && metaInfo.trim() !== '' 
        ? metaInfo 
        : "未提供 (注意：请明确指出因缺乏患者四诊信息，分析基于方剂通用逻辑，切勿编造患者症状)";

    const context = `
    【处方原文】: ${prescriptionInput}
    【患者元信息(背景/主诉/四诊)】: ${metaInfoContext}
    【计算数据】: 总寒热指数 ${analysis.totalPTI.toFixed(2)} ( >0 热, <0 寒); 
    【三焦分布】: 上焦 ${analysis.sanJiao.upper.percentage.toFixed(0)}%, 中焦 ${analysis.sanJiao.middle.percentage.toFixed(0)}%, 下焦 ${analysis.sanJiao.lower.percentage.toFixed(0)}%
    【算法高能值药味(仅供参考)】: ${analysis.top3[0]?.name} (贡献度 ${analysis.top3[0]?.ptiContribution.toFixed(2)}) -- 注意：此为基于剂量x温度系数的物理计算结果，不代表中医逻辑上的“君药”，AI需自行根据方义判断。
    `;

    // Priority: Custom Instruction > Settings Instruction > Default
    const sysPrompt = customSystemInstruction || settings.systemInstruction || DEFAULT_ANALYZE_SYSTEM_INSTRUCTION;

    const messages: OpenAIMessage[] = [
        { role: "system", content: sysPrompt },
    ];

    if (existingReport) {
        messages.push({ role: "user", content: `请对以下处方进行深度分析:\n${context}` });
        messages.push({ role: "assistant", content: existingReport });
        messages.push({ role: "user", content: "You were cut off. Please continue generating the HTML report exactly from where you left off. Do NOT repeat content. Do NOT add preamble. Start immediately with the next character." });
    } else {
        messages.push({ role: "user", content: `请对以下处方进行深度分析:\n${context}` });
        if (regenerateInstructions) {
            messages.push({ role: "user", content: `补充指令: ${regenerateInstructions}` });
        }
    }

    const payload = {
        model: settings.model || settings.analysisModel || "gpt-3.5-turbo",
        messages: messages,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens || 4000,
        stream: true
    };

    const res = await fetch(url, {
        method: "POST",
        headers: getHeaders(settings.apiKey),
        body: JSON.stringify(payload),
        signal: signal
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI Analysis Failed: ${res.status} ${res.statusText}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
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
                            let cleanChunk = chunk;
                            if (cleanChunk.includes("```html")) cleanChunk = cleanChunk.replace("```html", "");
                            if (cleanChunk.includes("```")) cleanChunk = cleanChunk.replace("```", "");
                            
                            yield cleanChunk;
                        }
                    } catch (e) {
                        // Ignore parsing errors for incomplete chunks
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
};

/**
 * Chat Stream Generation with Safe Context Management and Multimodal Support
 */
export async function* generateChatStream(
    history: any[], // Raw internal messages
    analysis: AnalysisResult,
    prescription: string,
    reportContent: string | undefined,
    settings: AISettings,
    signal: AbortSignal | undefined,
    metaInfo: string
): AsyncGenerator<{ text?: string, functionCalls?: {id: string, name: string, args: any}[] }, void, unknown> {
    const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
    
    // 1. Safety Truncate Large Contexts
    const MAX_REPORT_CHARS = 10000;
    const safeReportContent = reportContent && reportContent.length > MAX_REPORT_CHARS 
        ? reportContent.slice(0, MAX_REPORT_CHARS) + "\n\n[...System Note: Report truncated due to length limits...]"
        : (reportContent || "");

    const MAX_META_CHARS = 5000;
    const safeMetaInfo = metaInfo && metaInfo.length > MAX_META_CHARS
        ? metaInfo.slice(0, MAX_META_CHARS) + "\n...[truncated]"
        : metaInfo;

    // 2. Build System Message
    const systemMsg: OpenAIMessage = {
        role: "system",
        content: CHAT_SYSTEM_INSTRUCTION(analysis, prescription, safeReportContent, safeMetaInfo)
    };

    // 3. Convert Internal History to OpenAI API Format (Multimodal Support)
    // IMPORTANT: This mapping logic handles attachments (images/files)
    const apiHistory: OpenAIMessage[] = history.map(m => {
        // Base structure
        const apiMsg: OpenAIMessage = {
            role: m.role === 'model' ? 'assistant' : (m.role === 'tool' ? 'tool' : 'user'),
            content: null
        };

        if (m.role === 'tool') {
             apiMsg.tool_call_id = m.toolCallId;
             apiMsg.content = m.text;
        } else if (m.role === 'model') {
             apiMsg.content = m.text || null;
             apiMsg.tool_calls = m.toolCalls;
        } else {
             // User Role: Check for Attachments (Images/Files)
             if (m.attachments && m.attachments.length > 0) {
                 const contentParts: OpenAIContentPart[] = [];
                 
                 // Add Text First (if any)
                 if (m.text) {
                     contentParts.push({ type: 'text', text: m.text });
                 }
                 
                 // Add Attachments
                 m.attachments.forEach((att: any) => {
                     if (att.type === 'image') {
                         contentParts.push({
                             type: 'image_url',
                             image_url: { url: att.content } // base64
                         });
                     } else {
                         // Text files are appended to text content for better context understanding
                         // Files are essentially embedded text
                         const fileContext = `\n\n[用户上传文件内容: ${att.name}]\n${att.content}\n`;
                         const textPart = contentParts.find(p => p.type === 'text');
                         if (textPart && textPart.type === 'text') {
                             textPart.text += fileContext;
                         } else {
                             // If no existing text part, create one
                             contentParts.push({ type: 'text', text: fileContext });
                         }
                     }
                 });
                 apiMsg.content = contentParts;
             } else {
                 apiMsg.content = m.text;
             }
        }
        return apiMsg;
    });

    // 4. Robust Context Pruning & Sanitization
    
    const MAX_CONTEXT_MESSAGES = 12; // Reduced to keep topology safer and faster
    let messagesToSend: OpenAIMessage[] = [];
    
    // Always keep system msg
    // Slice only the chat history
    if (apiHistory.length > MAX_CONTEXT_MESSAGES) {
        messagesToSend = apiHistory.slice(apiHistory.length - MAX_CONTEXT_MESSAGES);
    } else {
        messagesToSend = [...apiHistory];
    }

    // 5. SANITIZE: Remove orphans and fix hanging tool calls to prevent 500 Errors
    // We prepend systemMsg *before* sanitizing to ensure the whole chain is valid, 
    // although system msg doesn't affect tool topology usually.
    messagesToSend = sanitizeMessageHistory([systemMsg, ...messagesToSend]);

    const payload = {
        model: settings.model || settings.chatModel || "gpt-3.5-turbo",
        messages: messagesToSend,
        temperature: 0.5, 
        stream: true,
        tool_choice: "auto", 
        tools: [
            {
                type: "function",
                function: {
                    name: "lookup_herb",
                    description: "Search the database for herb details. REQUIRED for queries about herb nature, efficacy, usage, or compatibility.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "The TCM keyword to search for." }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_prescription",
                    description: "User wants to modify the prescription",
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
                    description: "User wants to regenerate the analysis report",
                    parameters: {
                        type: "object",
                        properties: {
                            instructions: { type: "string", description: "Specific instructions" }
                        },
                        required: ["instructions"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_meta_info",
                    description: "Update the patient's medical record (Meta Info).",
                    parameters: {
                        type: "object",
                        properties: {
                            new_info: { type: "string", description: "The updated medical record text." }
                        },
                        required: ["new_info"]
                    }
                }
            }
        ]
    };

    const res = await fetch(url, {
        method: "POST",
        headers: getHeaders(settings.apiKey),
        body: JSON.stringify(payload),
        signal: signal
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Chat Stream Failed: ${res.status} - ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

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
                        let cleanText = delta.content;
                        // Basic cleanup, though usually handled by frontend
                        if (cleanText.includes("```html")) cleanText = cleanText.replace("```html", "");
                        
                        yield { text: cleanText };
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
                    // ignore parse error
                }
            }
        }
        
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
            }).filter(c => c !== null) as {id: string, name: string, args: any}[];
            
            if (parsedCalls.length > 0) {
                yield { functionCalls: parsedCalls };
            }
        }

    } finally {
        reader.releaseLock();
    }
}
