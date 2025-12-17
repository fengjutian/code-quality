"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LLM_CONFIG = void 0;
exports.getLLMConfig = getLLMConfig;
exports.validateLLMConfig = validateLLMConfig;
const vscode = require("vscode");
exports.DEFAULT_LLM_CONFIG = {
    model: 'kimi-k2-0905-preview',
    temperature: 0.3,
    maxTokens: 3000,
    apiKey: 'sk-IZwZS47Lq7VR7SqtbYythH7DwpwOUcL3Ymhaq3CVKCIEl6IC',
    timeout: 120000,
    enabled: true,
    baseURL: 'https://api.moonshot.cn/v1/chat/completions',
};
function getLLMConfig() {
    const config = vscode.workspace.getConfiguration('codeQualityAnalyzer.llm');
    return {
        model: config.get('model', exports.DEFAULT_LLM_CONFIG.model),
        temperature: config.get('temperature', exports.DEFAULT_LLM_CONFIG.temperature),
        maxTokens: config.get('maxTokens', exports.DEFAULT_LLM_CONFIG.maxTokens),
        apiKey: config.get('apiKey', exports.DEFAULT_LLM_CONFIG.apiKey),
        baseURL: config.get('baseURL', exports.DEFAULT_LLM_CONFIG.baseURL),
        timeout: config.get('timeout', exports.DEFAULT_LLM_CONFIG.timeout),
        enabled: config.get('enabled', exports.DEFAULT_LLM_CONFIG.enabled)
    };
}
function validateLLMConfig(config) {
    if (!config.enabled) {
        return { valid: false, error: 'AI 功能已禁用' };
    }
    if (!config.apiKey) {
        return { valid: false, error: '未配置 AI API 密钥' };
    }
    if (config.temperature < 0 || config.temperature > 1) {
        return { valid: false, error: '温度参数必须在 0-1 之间' };
    }
    if (config.maxTokens < 100 || config.maxTokens > 4096) {
        return { valid: false, error: '最大令牌数必须在 100-4096 之间' };
    }
    return { valid: true };
}
//# sourceMappingURL=config.js.map