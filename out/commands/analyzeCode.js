"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyzeCodeCommand = registerAnalyzeCodeCommand;
const vscode = require("vscode");
const analyzer_1 = require("../analyzer");
const reportPanel_1 = require("../reportPanel");
const qualityScore_1 = require("../utils/qualityScore");
const qualityScoreWithAI_1 = require("../qualityScoreWithAI");
const codeAnalysis_1 = require("../services/codeAnalysis");
function registerAnalyzeCodeCommand(context, diagnosticCollection) {
    return vscode.commands.registerCommand('extension.analyzeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage('没有打开任何文件');
        const filePath = editor.document.uri.fsPath;
        try {
            // 使用传统分析方法（不依赖AI）
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            const codeText = editor.document.getText();
            const qualityScore = (0, qualityScore_1.calculateQualityScore)(diagnostics, codeText);
            const allIssues = (0, codeAnalysis_1.generateIssuesFromQualityScore)(qualityScore, codeText, editor.document.fileName);
            (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
            vscode.window.showInformationMessage('代码分析完成！');
            // 可选：使用AI增强分析（如果配置了API密钥）
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (openaiApiKey) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在使用AI进行深度代码分析...',
                    cancellable: false,
                }, async () => {
                    try {
                        const scorer = new qualityScoreWithAI_1.QualityScorerAI(openaiApiKey);
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
                        (0, reportPanel_1.showQualityReport)(context, qualityScore, aiEnhancedIssues);
                        vscode.window.showInformationMessage('AI增强分析完成！');
                    }
                    catch (aiErr) {
                        const errorMessage = aiErr instanceof Error ? aiErr.message : 'AI分析失败';
                        vscode.window.showWarningMessage(`AI分析失败: ${errorMessage}`);
                        console.error('AI分析失败:', aiErr);
                    }
                });
            }
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
}
//# sourceMappingURL=analyzeCode.js.map