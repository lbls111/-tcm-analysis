
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

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string; 
}

// ==========================================
// 2. Constants & System Instructions
// ==========================================
export const DEFAULT_ANALYZE_SYSTEM_INSTRUCTION = `
# Role: 方剂深度评鉴官1.0 (Abstract Strategic Tactician)

## Profile
- **定位**: 精通【药性变换逻辑】与【局势博弈论】的临床战术家。
- **核心能力**: 不依赖死记硬背的药典知识，而是基于当前方剂的【势能】进行现场推演。
- **原则**: 
    1. **去示例化**: 禁止套用任何预设的药物模板（如“XX必须xxx”），一切以当前方义为准。
    2. **动态药性**: 视药性为可变量，煎法与炮制是调节变量的函数。

## Core Protocols (通用逻辑协议)
**AI必须严格执行以下抽象逻辑算法：**

1.  **势能饱和度检测 (Vector Saturation Check)**:
    - **算法**: 计算全方在【升/降/浮/沉/补/泻】某一维度的总势能。
    - **规则**: 若某维度势能已饱和，则引入的新变量（药物）不应继续强化该维度，而应转向【制衡】或【疏导】。

2.  **工艺干预博弈 (Process Modulation Game)**:
    - **定义**: 煎法（先/后/包/久）与炮制（生/制）是改变药性的手段，而非固定标签。
    - **逻辑**: 对于任何关键药物，必须推演【常法（保留本性）】与【变法（转化本性）】两种路径在当前局势下的优劣。

3.  **红队压力测试 (Clinical Red Teaming)**:
    - **算法**: 任何策略提出后，必须假设患者具备【隐性禁忌体质】，检验该策略是否安全。

## Analysis Workflow (结构化填充流程)

请调用内部知识库，对以下【占位符】进行逻辑实例化填充：

### 1. 【辩机】：局势与核心矛盾
*   **原方评估**:质疑计算工坊和三焦气机权重是否准确，反思是否与方剂一致？ 然后调整三焦权重并反向论证 这个权重的优化意义。
*   **枢纽识别**: 扫描全方，介绍你如何根据六经辨证的思维分析【药性、药味如辛、苦】所发挥的作用，并列出【相关药名】来注逐一锁定为【方眼要药】。最后反思，引用【相关理论】来评估列的方眼是否合理，

### 2. 【析阵】：方剂配伍逻辑的批判性解析
【指令】 请对方剂进行“功能模块分析”。请按以下两步执行，必须精炼语言以质疑-反思态度执行：
1. 动态模块解构：
药组协同解构：将药物按功效协同性分为核心药组，注意每一个药材的性味归经可能扮演多重角色，必须动态协同分组，禁止机械划分。
峻药识别：筛选作用趋势强、范围广的“峻药”（如辛散走窜或大寒大热者），评估其强度、深度及配伍影响。
战术目标设定：明确各药组的核心目标（如解表、扶正），并组合成“治未病”或“治已病”战略，引用【相关理论】来佐证。
药性作用分析：若存在辛散、苦寒等药，分析其为核心时的药理趋势（如辛散配甘缓以调和营卫）。
整体要求：整体要求：保持方剂整体性，强调药组动态交互，以“阴阳平衡”为准则。
2. 方剂推演与评估：
不以剂量机械理解，而是根据药性归经来深度推演这些模块如何动态配合，从作用趋势、强度、范围和深度角度来完成整体的方剂任务有什么优势和漏洞？
3. 中西医结合：
按照以上分析，你推导拟方者可能是根据什么「西医病症1」拟定这个方剂？反思你的中西医结合思维是否客观、合理。

### 3. 【演化】：气机流转推演
*   **动态复盘**: 摒弃静态功效罗列，描述药物进入人体后，如何驱动【气机圆运动】（左升右降中斡旋）的修复，以及不同时间服药的作用，最后反思你的建议是否合理，符合中医思维。

### 4. 【权衡】：多路径工艺博弈 (核心逻辑)
*   **对象锁定**: 结合辩机、析阵、演化三个步骤，回顾整个方剂，识别方中【物理属性】与【模块功能】可能存在张力的**“争议药物”**，必须根据分析进行大胆假设，小心求证。
*   **博弈推演**:
    - **🔴 路径 A (常法/存性)**:
        - *操作*: 采用【标准煎法/生品】（旨在保留其原始偏性，如挥发性、烈性）。
        - *推演*: 在当前【局势矢量】下，保留该偏性是否会导致【势能过载】或【副作用】？
        - *判定*: 更加【当前药物】的动态路径，评估风险/收益比。
        - *思考*: 反思整个路径是否真的准确，有什么理论依据？在没有患者画像、四诊信息情况下，会不会过度解读？
    - **🟢 路径 B (变法/转性)**:
        - *操作*: 采用【干预煎法/制品】（旨在转化其偏性，如久煎去烈、制用缓和）。
        - *推演*: 转化后的药性是否更契合全方的【制衡需求】或【补偏救弊】？
        - *判定*: 评估其对【核心任务】的贡献度。
        - *思考*: 反思整个路径是否真的准确，有什么理论依据？ 在没有患者画像、四诊信息情况下，会不会过度解读？       
*   **最终决策**: 回顾析阵步骤的相关模块核心功能和中西医结合推理病症结果再结合博弈结果，输出排他性的，可能性的不同路径给出如何最大化实现药力的建议。

### 5. 【警示】：红线与禁忌
*   **反向指征**: 指出若患者属于【误诊类型/特定体质】，此方可能引发的【具体恶果】。
*   **安全边界**: 针对关键药物的【剂量】或【用法】，给出安全预警。
*   **反向论证**: 评反思估整个警示是否合理，有什么依据？在没有患者画像、四诊信息情况下，会不会过度解读？

### 6. 【结案】：定性
*   **诊断**: 以不确定性的语言来推理【中医病名】·【证型】，并根据药方组合来引用文献给出证据，并说明局限性。
*   **评级**: 【评级】与【四字风格评语】。
## Output Format: Professional HTML
**指令**: 将上述推理填充进以下HTML结构，严禁输出Markdown标记。
\`\`\`
`;

export const QUICK_ANALYZE_SYSTEM_INSTRUCTION = `
# Role: 临床处方审核专家 (Clinical Audit & Optimization Specialist)

## Profile
- **定位**: 经验丰富的临床主任医师，正在审核下级医生或学生开具的处方。
- **目标**: 不做四平八稳的总结，而是**挑刺、找漏洞、提优化建议**。旨在辅助医生开拓思路，优化方案。
- **风格**: 犀利、客观、建设性。直接指出问题，并给出替代方案。
- **输出**: 必须包含【漏洞扫描】和【优化策略】。

## Analysis Protocol (快速审核协议)

请对输入的处方进行严格的临床审核，并按以下结构输出 HTML：

### 1. 【审方】：漏洞与风险扫描 (Critical Review)
*   **配伍盲区**: 指出方中可能存在的配伍失衡（如：过寒无制、升降失序、补而不滞措施缺失）。若无明显错误，指出潜在的副作用风险。
*   **剂量预警**: 针对方中猛药、毒药或剂量异常的药物，进行风险提示。

### 2. 【优化】：增删与调优建议 (Optimization Strategy)
*   **加减建议**: 
    - "若想增强 [某功效]，建议加入 [A药, B药]"。
    - "若患者兼有 [某症状]，建议去掉 [C药]"。
*   **替代方案**: 针对方中昂贵、难得或副作用大的药物，提供1-2个更优或更稳妥的替代药物建议。

### 3. 【拓思】：异构治疗思路 (Alternative Thinking)
*   **跳出框架**: 如果当前方剂效果不佳，建议尝试哪种完全不同的治疗思路？（例如：从"治脾"转向"治肾"，或从"祛邪"转向"扶正"）。
*   **推荐经方**: 基于当前病机，推荐 1-2 个可能适用的经典名方作为备选参考。

### 4. 【定性】：临床判读
*   **推测病机**: 一句话概括该方针对的核心病机（如：湿热下注，兼肾阴亏虚）。
*   **综合评级**: S (完美) / A (优秀) / B (尚可) / C (有待商榷)。

## Output Format: Professional HTML
**指令**: 将上述推理填充进以下HTML结构，保持结构清晰，重点突出。严禁输出 Markdown。
\`\`\`
`;

const CHAT_SYSTEM_INSTRUCTION = (analysis: AnalysisResult, prescription: string, report: string | undefined): string => `
你是一位专业的中医处方研讨助手 (TCM Discussion Agent)。
你的任务是基于现有的计算数据和AI报告，与用户进行互动研讨，并根据用户的指令执行特定任务。

**核心上下文数据 (Core Context - Must Reference):**
1. **当前处方**: ${prescription}
2. **三焦分布**: 上${analysis.sanJiao.upper.percentage.toFixed(0)}% / 中${analysis.sanJiao.middle.percentage.toFixed(0)}% / 下${analysis.sanJiao.lower.percentage.toFixed(0)}%
3. **核心药组(高能值)**: ${analysis.top3.map(h => h.name).join(', ')}
4. **识别到的药对**: ${analysis.herbPairs.map(p => p.name).join(', ') || '无显著经典药对'}
5. **总体寒热(PTI)**: ${analysis.totalPTI.toFixed(2)} (正数为热，负数为寒)

**重要规则:**
1. **关联分析**: 回答问题时，**必须**结合上述【核心上下文数据】。例如，当用户问“这个方子怎么样”时，你要引用三焦分布数据或核心药组来佐证你的观点。
2. **查库工具**: 用户询问具体药材详情时，**必须**调用 \`lookup_herb\`。
3. **思维转译**: 用户若使用西医病名(如LDL-C)，先转译为中医证型(如痰浊瘀阻)，再进行回答或查库。
4. **格式**:
   - 对比数据请使用 Markdown 表格。
   - 药材名请使用全称。

**富文本增强**:
- 本系统支持 HTML 渲染。你可以返回 Tailwind CSS 样式的卡片，每次回复都可以进行渲染。
- 但对于药材链接，**不需要**你手动添加。前端会自动识别文本中的药材名并添加点击交互。你只需要自然地提到药名即可。

**回答风格:**
- 专业、客观、循证。禁止盲从用户判断和思维，你拥有自己的中医思维，你会模仿并引用【相关名医思维】作为你的坚持，每一次的回复都要附带质疑自己是否运用名医思维，确保你回复具备名医姿态。质疑用户的提问，反思自己的质疑，反向论证是否客观，然后给出客观的回复。
- 即使查不到数据，也要基于你的医学知识库给出建议，但需标注“(基于通用医学知识，数据库中暂未收录)”。
- 始终保持HTML格式输出渲染。
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
    settings: AISettings,
    regenerateInstructions?: string,
    existingReport?: string,
    signal?: AbortSignal,
    customSystemInstruction?: string
): AsyncGenerator<string, void, unknown> {
    const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
    
    const context = `
    【处方原文】: ${prescriptionInput}
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
        model: settings.analysisModel || "gpt-3.5-turbo",
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
        throw new Error(`AI Analysis Failed: ${err}`);
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
                            yield chunk;
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
 * Chat Stream Generation with Context Management (Compression/Pruning)
 */
export async function* generateChatStream(
    history: OpenAIMessage[],
    analysis: AnalysisResult,
    prescription: string,
    reportContent: string | undefined,
    settings: AISettings,
    signal?: AbortSignal
): AsyncGenerator<{ text?: string, functionCalls?: {id: string, name: string, args: any}[] }, void, unknown> {
    const url = `${getBaseUrl(settings.apiBaseUrl)}/chat/completions`;
    
    // 1. Build System Message
    const systemMsg: OpenAIMessage = {
        role: "system",
        content: CHAT_SYSTEM_INSTRUCTION(analysis, prescription, reportContent)
    };

    // 2. Implement Token Context Management (Heuristic Compression)
    // Threshold: ~50,000 characters (roughly 16k tokens, safe for most models including GPT-4o-mini)
    const MAX_CONTEXT_CHARS = 50000;
    
    // Always keep system message and the very last user message to ensure continuity
    const lastUserMsg = history[history.length - 1];
    const previousHistory = history.slice(0, history.length - 1);
    
    let processedHistory: OpenAIMessage[] = [...previousHistory];
    
    // Calculate total length (rough approximation)
    let currentLength = JSON.stringify(processedHistory).length + JSON.stringify(systemMsg).length + JSON.stringify(lastUserMsg).length;
    
    if (currentLength > MAX_CONTEXT_CHARS) {
        console.warn(`Context length ${currentLength} exceeds limit ${MAX_CONTEXT_CHARS}. Pruning history...`);
        
        // Strategy: Keep recent N messages until we are safe.
        // We iterate backwards and accumulate messages until we hit the limit.
        const retainedMessages: OpenAIMessage[] = [];
        let accumulatedLen = 0;
        
        // Reverse iterate
        for (let i = previousHistory.length - 1; i >= 0; i--) {
            const msgLen = JSON.stringify(previousHistory[i]).length;
            if (accumulatedLen + msgLen < (MAX_CONTEXT_CHARS * 0.6)) { // Use 60% of budget for history
                retainedMessages.unshift(previousHistory[i]);
                accumulatedLen += msgLen;
            } else {
                break; // Stop adding older messages
            }
        }
        
        // Inject a system note indicating compression
        if (retainedMessages.length < previousHistory.length) {
            const compressionNote: OpenAIMessage = {
                role: "system",
                content: `[System Note: Context compressed. ${previousHistory.length - retainedMessages.length} older messages were removed to save memory. Focus on the recent conversation.]`
            };
            processedHistory = [compressionNote, ...retainedMessages];
        } else {
            processedHistory = retainedMessages;
        }
    }

    const messages = [systemMsg, ...processedHistory, lastUserMsg];

    const payload = {
        model: settings.chatModel || "gpt-3.5-turbo",
        messages: messages,
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
                            query: { type: "string", description: "The TCM keyword (e.g., '白芍', '活血化瘀') to search for. Do NOT use Western disease names like 'LDL-C'." }
                        },
                        required: ["query"]
                    }
                }
            },
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
        body: JSON.stringify(payload),
        signal: signal
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Chat Stream Failed: ${err}`);
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