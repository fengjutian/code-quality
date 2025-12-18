import * as vscode from 'vscode';
import { analyzeCode } from '../analyzer';
import { showQualityReport } from '../reportPanel';
import { calculateQualityScore } from '../utils/qualityScore';
import { QualityScorerAI } from '../qualityScoreWithAI';
import { generateIssuesFromQualityScore } from '../services/codeAnalysis';

export function registerAnalyzeCodeCommand(context: vscode.ExtensionContext, diagnosticCollection: vscode.DiagnosticCollection): vscode.Disposable {
    return vscode.commands.registerCommand('extension.analyzeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showErrorMessage('没有打开任何文件');

        const filePath = editor.document.uri.fsPath;
        
        try {
            // 使用传统分析方法（不依赖AI）
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await analyzeCode(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);

            const codeText = editor.document.getText();
            const qualityScore = calculateQualityScore(diagnostics, codeText);
            const allIssues = generateIssuesFromQualityScore(qualityScore, codeText, editor.document.fileName);

            showQualityReport(context, qualityScore, allIssues);
            vscode.window.showInformationMessage('代码分析完成！');

            // 可选：使用AI增强分析（如果配置了API密钥）
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (openaiApiKey) {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: '正在使用AI进行深度代码分析...',
                        cancellable: false,
                    },
                    async () => {
                        try {
                            const scorer = new QualityScorerAI(openaiApiKey);
                            const aiResult = await scorer.analyzeFile(filePath);
                            
                            // 将AI分析结果与现有结果结合
                            const aiEnhancedIssues = [...allIssues];
                            aiResult.issues.forEach(issue => {
                                if (issue.line && issue.suggestion) {
                                    aiEnhancedIssues.push({
                                        message: `${issue.message} (AI建议: ${issue.suggestion})`,
                                        line: issue.line,
                                        severity: 1, // warning
                                        filePath: filePath
                                    });
                                }
                            });
                            
                            // 重新显示报告，包含AI建议
                            showQualityReport(context, qualityScore, aiEnhancedIssues);
                            vscode.window.showInformationMessage('AI增强分析完成！');
                        } catch (aiErr: unknown) {
                            const errorMessage = aiErr instanceof Error ? aiErr.message : 'AI分析失败';
                            vscode.window.showWarningMessage(`AI分析失败: ${errorMessage}`);
                            console.error('AI分析失败:', aiErr);
                        }
                    }
                );
            }
        } catch (err: unknown) {
            handleError(err, diagnosticCollection);
        }
    });
}
