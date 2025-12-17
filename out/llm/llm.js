"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
exports.createLLMService = createLLMService;
const config_1 = require("./config");
const vscode = require("vscode");
class LLMService {
    constructor(config) {
        const validation = (0, config_1.validateLLMConfig)(config);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        this.config = config;
    }
    async generateResponse(messages) {
        try {
            const response = await fetch(this.config.baseURL || 'https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: messages,
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                }),
                signal: AbortSignal.timeout(this.config.timeout),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message ||
                    errorData.message ||
                    `API 请求失败: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: data.choices[0]?.message?.content || '',
                usage: data.usage,
            };
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('AI 请求超时');
                }
                throw error;
            }
            throw new Error('未知 AI 请求错误');
        }
    }
    async generateCodeQualityAssessment(code, language, issues) {
        const systemPrompt = `你是一名专业的代码质量评估专家，请分析以下${language}代码的质量。评估应包括：
1. 代码结构和组织
2. 可读性和可维护性
3. 性能优化建议
4. 潜在的bug或安全问题
5. 最佳实践建议

请用中文输出，保持专业、客观，并提供具体的改进建议。`;
        const userPrompt = `代码：
${code}

已发现的问题：
${issues.map((issue, index) => `${index + 1}. ${issue.message}`).join('\n')}

请评估这段代码的质量并提供改进建议：`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        const response = await this.generateResponse(messages);
        return response.content;
    }
}
exports.LLMService = LLMService;
async function createLLMService() {
    try {
        const config = await Promise.resolve().then(() => require('./config')).then(m => m.getLLMConfig());
        return new LLMService(config);
    }
    catch (error) {
        console.error('创建 LLM 服务失败:', error);
        vscode.window.showErrorMessage('AI 服务配置错误: ' + (error instanceof Error ? error.message : '未知错误'));
        return null;
    }
}
//# sourceMappingURL=llm.js.map