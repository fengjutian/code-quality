import * as vscode from 'vscode';
import { analyzeCode } from '../analyzer';
import { showQualityReport } from '../reportPanel';
import { calculateQualityScore } from '../utils/qualityScore';
import { generateIssuesFromQualityScore } from '../services/codeAnalysis';
import { getLLMConfig } from '../llm/config';
import { assessCodeQuality } from '../llm/code-annotation-AI';
import { generateAIReportHTML } from '../view-template/ai-template';

export function registerAnalyzeWithAICommand(context: vscode.ExtensionContext, diagnosticCollection: vscode.DiagnosticCollection): vscode.Disposable {
    return vscode.commands.registerCommand('extension.analyzeWithAI', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showErrorMessage('没有打开任何文件');

        const filePath = editor.document.uri.fsPath;
        const code = editor.document.getText();
        const language = editor.document.languageId;
        
        try {
            // 先运行传统分析获取基础问题
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await analyzeCode(code, language, cwd, filePath);
            diagnosticCollection.set(editor.document.uri, diagnostics);

            const { allIssues, qualityScore } = {
                qualityScore: calculateQualityScore(diagnostics, code),
                allIssues: generateIssuesFromQualityScore(calculateQualityScore(diagnostics, code), code, filePath)
            };

            // 检查AI配置是否启用
            const llmConfig = getLLMConfig();
            if (llmConfig.enabled) {
                // 运行AI质量评估
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在使用AI评估代码质量...',
                    cancellable: true
                }, async (progress) => {
                    progress.report({ message: '正在生成AI评估...', increment: 0 });
                    
                    try {
                        progress.report({ message: 'AI评估可能需要1-2分钟...', increment: 30 });
                        
                        const aiAssessment = await assessCodeQuality({
                            code,
                            language,
                            issues: allIssues,
                            filePath,
                            lineCount: editor.document.lineCount
                        });
                        
                        progress.report({ message: 'AI评估完成', increment: 100 });
                        
                        // 显示AI评估报告
                        const panel = vscode.window.createWebviewPanel(
                            'codeQualityAIReport',
                            'AI代码质量评估报告',
                            vscode.ViewColumn.Beside,
                            { enableScripts: true }
                        );
                        
                        panel.webview.html = generateAIReportHTML(aiAssessment);
                        
                        vscode.window.showInformationMessage('AI代码质量评估完成！');
                    } catch (error) {
                        vscode.window.showErrorMessage(`AI评估失败: ${error instanceof Error ? error.message : '未知错误'}`);
                        // 继续显示传统报告
                        showQualityReport(context, qualityScore, allIssues);
                    }
                });
            } else {
                // AI功能未启用，仅显示传统报告
                showQualityReport(context, qualityScore, allIssues);
                vscode.window.showInformationMessage('代码分析完成！(AI功能未启用)');
            }
        } catch (err: unknown) {
            handleError(err, diagnosticCollection);
        }
    });
}
