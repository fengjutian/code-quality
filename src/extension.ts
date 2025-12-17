import * as vscode from 'vscode';
import { analyzeCode, analyzeDirectory } from './analyzer';
import { showQualityReport } from './reportPanel';
import { calculateQualityScore } from './utils/qualityScore';
import { QualityScorerAI, FileAnalysisResult } from "./qualityScoreWithAI";
import { createAIQualityAssessmentCommand, assessCodeQuality, generateAIReportHTML } from './llm/code-annotation-AI';
import { getLLMConfig } from './llm/config';
import {
  checkLineCount,
  checkFunctionCount,
  checkCommentRatio,
  checkDuplicateBlocks,
  checkTestScore,
  checkWhitespaceIssues,
  checkNamingConvention
} from './utils/quailty-check';


/**
 * 根据 qualityScore 生成所有 issues
 */
function generateIssuesFromQualityScore(
    qualityScore: ReturnType<typeof calculateQualityScore>,
    codeText: string,
    filePath: string
) {
    const { lineCount, functionCount, commentLines } = qualityScore.details;
    const testScore = qualityScore.breakdown.testScore;

    return [
        ...checkLineCount(lineCount, filePath),
        ...checkFunctionCount(functionCount, codeText, filePath),
        ...checkCommentRatio(commentLines, lineCount, filePath),
        ...checkDuplicateBlocks(codeText, filePath),
        ...checkTestScore(testScore, filePath),
        ...checkWhitespaceIssues(codeText, filePath),
        ...checkNamingConvention(codeText, filePath)
    ];
}

/**
 * 文件分析 pipeline：ESLint + qualityScore
 */
function analyzeFileAndGenerateIssues(
    codeText: string,
    diagnostics: vscode.Diagnostic[],
    filePath: string
) {
    const eslintIssues = diagnostics.map(d => ({
        message: d.message,
        line: d.range.start.line + 1,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
        filePath
    }));

    const qualityScore = calculateQualityScore(diagnostics, codeText);
    const otherIssues = generateIssuesFromQualityScore(qualityScore, codeText, filePath);

    return { allIssues: [...eslintIssues, ...otherIssues], qualityScore };
}

/**
 * ======== VS Code 插件激活 ========
 */
export async function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);

    // 通用错误处理
    function handleError(err: unknown, collection: vscode.DiagnosticCollection) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
        console.error(err);

        const outputChannel = vscode.window.createOutputChannel("Code Quality Analysis");
        outputChannel.appendLine(`Analysis failed: ${errorMessage}`);
        outputChannel.show();

        const errorDiagnostic = new vscode.Diagnostic(
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            `代码分析失败: ${errorMessage}`,
            vscode.DiagnosticSeverity.Error
        );

        collection.clear();
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            collection.set(editor.document.uri, [errorDiagnostic]);
        }
    }

    // 文件保存时自动分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        try {
            const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            const diagnostics = await analyzeCode(document.getText(), document.languageId, cwd, document.fileName);
            diagnosticCollection.set(document.uri, diagnostics);
        } catch (err: unknown) {
            handleError(err, diagnosticCollection);
        }
    });

    // 手动分析当前文件
    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showErrorMessage('没有打开任何文件');

        const filePath = editor.document.uri.fsPath;
        
        try {
            // 使用传统分析方法（不依赖AI）
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await analyzeCode(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);

            const { allIssues, qualityScore } = analyzeFileAndGenerateIssues(
                editor.document.getText(),
                diagnostics,
                editor.document.fileName
            );

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
                    async (progress) => {
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

    // 分析整个项目
    const projectDisposable = vscode.commands.registerCommand('extension.analyzeProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return vscode.window.showErrorMessage('没有打开任何工作区');

        const rootPath = workspaceFolders[0].uri.fsPath;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '分析整个项目的代码质量',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: '开始分析...' });

                const results = await analyzeDirectory(rootPath);
                progress.report({ increment: 50, message: '分析完成，生成报告...' });

                diagnosticCollection.clear();
                let allIssues: any[] = [];

                for (const result of results) {
                    diagnosticCollection.set(vscode.Uri.file(result.filePath), result.diagnostics);

                    const { allIssues: fileIssues } = analyzeFileAndGenerateIssues(
                        result.codeText,
                        result.diagnostics,
                        result.filePath
                    );

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
                        const score = calculateQualityScore(result.diagnostics, result.codeText);
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
                    showQualityReport(context, qualityScore, allIssues);

                    vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${allIssues.length} 个问题。`);
                } else {
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
                    showQualityReport(context, qualityScore, allIssues);
                    vscode.window.showInformationMessage('项目分析完成！未找到可分析的文件。');
                }
            });
        } catch (err: unknown) {
            handleError(err, diagnosticCollection);
        }
    });

    // 注册AI质量评估命令
    const aiAssessmentDisposable = await createAIQualityAssessmentCommand();
    context.subscriptions.push(aiAssessmentDisposable);

    // 在analyzeCode命令中集成AI质量评估功能
    const analyzeWithAIDisposable = vscode.commands.registerCommand('extension.analyzeWithAI', async () => {
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

            const { allIssues, qualityScore } = analyzeFileAndGenerateIssues(
                code,
                diagnostics,
                filePath
            );

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

    context.subscriptions.push(disposable, projectDisposable, analyzeWithAIDisposable);
}

export function deactivate() {}
