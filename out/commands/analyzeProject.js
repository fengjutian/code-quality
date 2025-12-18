"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyzeProjectCommand = registerAnalyzeProjectCommand;
const vscode = require("vscode");
const analyzer_1 = require("../analyzer");
const reportPanel_1 = require("../reportPanel");
const qualityScore_1 = require("../utils/qualityScore");
const codeAnalysis_1 = require("../services/codeAnalysis");
function registerAnalyzeProjectCommand(context, diagnosticCollection) {
    return vscode.commands.registerCommand('extension.analyzeProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0)
            return vscode.window.showErrorMessage('没有打开任何工作区');
        const rootPath = workspaceFolders[0].uri.fsPath;
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '分析整个项目的代码质量',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: '开始分析...' });
                const results = await (0, analyzer_1.analyzeDirectory)(rootPath);
                progress.report({ increment: 50, message: '分析完成，生成报告...' });
                diagnosticCollection.clear();
                let allIssues = [];
                for (const result of results) {
                    diagnosticCollection.set(vscode.Uri.file(result.filePath), result.diagnostics);
                    const { allIssues: fileIssues } = (0, codeAnalysis_1.generateIssuesFromQualityScore)((0, qualityScore_1.calculateQualityScore)(result.diagnostics, result.codeText), result.codeText, result.filePath);
                    allIssues.push(...fileIssues);
                }
                // Calculate average scores across all files using the new weighted system
                if (results.length > 0) {
                    let totalWeightedScore = 0;
                    let totalEslintScore = 0;
                    let totalComplexityScore = 0;
                    let totalCommentScore = 0;
                    let totalDuplicateScore = 0;
                    let totalTestScore = 0;
                    results.forEach(result => {
                        const score = (0, qualityScore_1.calculateQualityScore)(result.diagnostics, result.codeText);
                        totalWeightedScore += score.score;
                        totalEslintScore += score.breakdown.eslintScore;
                        totalComplexityScore += score.breakdown.complexityScore;
                        totalCommentScore += score.breakdown.commentScore;
                        totalDuplicateScore += score.breakdown.duplicateScore;
                        totalTestScore += score.breakdown.testScore;
                    });
                    const avgWeightedScore = Math.round(totalWeightedScore / results.length);
                    const avgEslintScore = Math.round(totalEslintScore / results.length);
                    const avgComplexityScore = Math.round(totalComplexityScore / results.length);
                    const avgCommentScore = Math.round(totalCommentScore / results.length);
                    const avgDuplicateScore = Math.round(totalDuplicateScore / results.length);
                    const avgTestScore = Math.round(totalTestScore / results.length);
                    const qualityScore = {
                        score: avgWeightedScore,
                        breakdown: {
                            eslintScore: avgEslintScore,
                            complexityScore: avgComplexityScore,
                            commentScore: avgCommentScore,
                            duplicateScore: avgDuplicateScore,
                            testScore: avgTestScore
                        }
                    };
                    progress.report({ increment: 100, message: '报告生成完成' });
                    (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                    vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${allIssues.length} 个问题。`);
                }
                else {
                    // Handle empty project case
                    const qualityScore = {
                        score: 100,
                        breakdown: {
                            eslintScore: 100,
                            complexityScore: 100,
                            commentScore: 100,
                            duplicateScore: 100,
                            testScore: 80 // Default test score
                        }
                    };
                    progress.report({ increment: 100, message: '报告生成完成' });
                    (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                    vscode.window.showInformationMessage('项目分析完成！未找到可分析的文件。');
                }
            });
        }
        catch (err) {
            // handleError(err, diagnosticCollection);
        }
    });
}
//# sourceMappingURL=analyzeProject.js.map