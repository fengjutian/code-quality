"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigureLLMCommand = registerConfigureLLMCommand;
const vscode = require("vscode");
function registerConfigureLLMCommand() {
    return vscode.commands.registerCommand('extension.configureLLM', () => {
        // 打开设置页面并定位到我们的扩展配置
        vscode.commands.executeCommand('workbench.action.openSettings', 'codeQualityAnalyzer.llm');
    });
}
//# sourceMappingURL=configureLLM.js.map