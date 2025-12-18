import * as vscode from 'vscode';
import { getLLMConfig } from '../llm/config';
import { assessCodeQuality } from '../llm/code-annotation-AI';
import { generateAIReportHTML } from '../view-template/ai-template';

export function registerAnalyzeSelectedCodeWithAICommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand(
        'extension.analyzeSelectedCodeWithAI',
        async (document: vscode.TextDocument, range: vscode.Range) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return vscode.window.showErrorMessage('没有打开任何文件');

            // 处理直接调用命令的情况（没有参数传递）
            let selectedCode: string;
            let language: string;
            let filePath: string;

            if (document && range) {
                selectedCode = document.getText(range);
                language = document.languageId;
                filePath = document.uri.fsPath;
            } else {
                // 直接调用命令，使用当前编辑器的选中内容
                selectedCode = editor.document.getText(editor.selection);
                language = editor.document.languageId;
                filePath = editor.document.uri.fsPath;
            }

            if (!selectedCode) return vscode.window.showErrorMessage('没有选中任何代码');

            // 1️⃣ 弹出输入框，让用户输入想让 AI 分析的内容
            const userPrompt = await vscode.window.showInputBox({
                prompt: '请输入你希望AI分析的额外信息或问题（可选）',
                placeHolder: '例如：请检查性能问题、潜在BUG或优化建议'
            });

            if (userPrompt === undefined) return; // 用户取消

            // 2️⃣ 检查 LLM 配置
            const llmConfig = getLLMConfig();
            if (!llmConfig.enabled) {
                return vscode.window.showInformationMessage('AI功能未启用，请在设置中启用后重试！');
            }

            try {
                // 3️⃣ 调用大模型分析
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在使用AI分析选中代码...',
                    cancellable: true
                }, async (progress) => {
                    progress.report({ message: '发送代码到AI分析...', increment: 20 });

                    // 计算代码行数
                    let lineCount: number;
                    if (document && range) {
                        lineCount = range.end.line - range.start.line + 1;
                    } else {
                        // 使用当前编辑器的选中范围
                        lineCount = editor.selection.end.line - editor.selection.start.line + 1;
                    }

                    const aiResult = await assessCodeQuality({
                        code: selectedCode,
                        language,
                        filePath,
                        lineCount,
                        userPrompt // 用户输入附加信息
                    });

                    progress.report({ message: 'AI分析完成，生成报告...', increment: 100 });

                    // 4️⃣ 显示 Webview 报告
                    const panel = vscode.window.createWebviewPanel(
                        'codeQualityAIReport',
                        'AI选中代码分析报告',
                        vscode.ViewColumn.Beside,
                        { enableScripts: true }
                    );

                    panel.webview.html = generateAIReportHTML(aiResult);

                    vscode.window.showInformationMessage('AI选中代码分析完成！');
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'AI分析失败';
                vscode.window.showErrorMessage(msg);
            }
        }
    );
}
