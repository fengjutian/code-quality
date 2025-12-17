import * as vscode from 'vscode';

export interface LLMConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    apiKey: string | undefined;
    baseURL?: string;
    timeout: number;
    enabled: boolean;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
    model: 'kimi-k2-0905-preview',
    temperature: 0.3,
    maxTokens: 3000,
    apiKey: undefined,
    timeout: 120000,
    enabled: true,
    baseURL: 'https://api.moonshot.cn/v1/chat/completions',
};

export function getLLMConfig(): LLMConfig {
    const config = vscode.workspace.getConfiguration('codeQualityAnalyzer.llm');
    
    return {
        model: config.get('model', DEFAULT_LLM_CONFIG.model),
        temperature: config.get('temperature', DEFAULT_LLM_CONFIG.temperature),
        maxTokens: config.get('maxTokens', DEFAULT_LLM_CONFIG.maxTokens),
        apiKey: config.get('apiKey', DEFAULT_LLM_CONFIG.apiKey),
        baseURL: config.get('baseURL', DEFAULT_LLM_CONFIG.baseURL),
        timeout: config.get('timeout', DEFAULT_LLM_CONFIG.timeout),
        enabled: config.get('enabled', DEFAULT_LLM_CONFIG.enabled)
    };
}

export function validateLLMConfig(config: LLMConfig): { valid: boolean; error?: string } {
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
