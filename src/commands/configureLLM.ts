import * as vscode from 'vscode';

export function registerConfigureLLMCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('extension.configureLLM', () => {
        // 打开设置页面并定位到我们的扩展配置
        vscode.commands.executeCommand('workbench.action.openSettings', 'codeQualityAnalyzer.llm');
    });
}
