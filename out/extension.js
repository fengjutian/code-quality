"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const analyzer_1 = require("./analyzer");
const reportPanel_1 = require("./reportPanel");
const qualityScore_1 = require("./utils/qualityScore");
const qualityScoreWithAI_1 = require("./qualityScoreWithAI");
/**
 * ======== 质量检查小函数集合 ========
 * 每个函数负责生成对应的 issues
 */
function checkLineCount(lineCount, filePath) {
    if (lineCount <= 200)
        return [];
    return [{
            message: `文件行数过多 (${lineCount} 行)，建议拆分为多个小文件`,
            line: lineCount,
            severity: 1,
            filePath
        }];
}
function checkFunctionCount(functionCount, codeText, filePath) {
    if (functionCount <= 10)
        return [];
    const codeLines = codeText.split('\n');
    const firstFunctionLine = codeLines.findIndex(line => line.includes('function') || line.includes('=>')) + 1 || 1;
    return [{
            message: `函数数量过多 (${functionCount} 个)，建议重构代码`,
            line: firstFunctionLine,
            severity: 1,
            filePath
        }];
}
function checkCommentRatio(commentLines, lineCount, filePath) {
    const ratio = commentLines / lineCount;
    // Based on new scoring: reasonable range is 5% ~ 25%
    if (ratio >= 0.05 && ratio <= 0.25)
        return [];
    if (ratio < 0.05) {
        return [{
                message: `注释比例过低 (${(ratio * 100).toFixed(1)}%)，建议增加注释`,
                line: 1,
                severity: 1,
                filePath
            }];
    }
    else {
        return [{
                message: `注释比例过高 (${(ratio * 100).toFixed(1)}%)，建议减少不必要的注释`,
                line: 1,
                severity: 1,
                filePath
            }];
    }
}
function checkDuplicateBlocks(codeText, filePath) {
    const issues = [];
    const lines = codeText.split('\n');
    const lineCountMap = {};
    // Build map of lines to their line numbers
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        // Filter out short and comment lines
        if (trimmedLine.length < 15 || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
            return;
        }
        if (!lineCountMap[trimmedLine]) {
            lineCountMap[trimmedLine] = [];
        }
        lineCountMap[trimmedLine].push(index + 1);
    });
    // Check for duplicates (4 or more occurrences)
    Object.entries(lineCountMap).forEach(([lineContent, lineNumbers]) => {
        if (lineNumbers.length >= 4) {
            // Report each occurrence after the third
            for (let i = 3; i < lineNumbers.length; i++) {
                issues.push({
                    message: `检测到重复代码: "${lineContent.substring(0, 30)}${lineContent.length > 30 ? '...' : ''}"`,
                    line: lineNumbers[i],
                    severity: 1,
                    filePath
                });
            }
        }
    });
    return issues;
}
function checkTestScore(testScore, filePath) {
    if (testScore >= 70)
        return [];
    return [{
            message: `测试覆盖率不足 (${testScore}%)，建议增加测试`,
            line: 1,
            severity: 1,
            filePath
        }];
}
function checkWhitespaceIssues(codeText, filePath) {
    const issues = [];
    const lines = codeText.split(/\r?\n/);
    lines.forEach((line, idx) => {
        if (/\s+$/.test(line)) {
            issues.push({
                message: '行尾存在多余空格',
                line: idx + 1,
                severity: 1,
                filePath
            });
        }
    });
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '' && lines[i - 1].trim() === '') {
            issues.push({
                message: '存在连续空行',
                line: i + 1,
                severity: 1,
                filePath
            });
        }
    }
    return issues;
}
function checkNamingConvention(codeText, filePath) {
    const issues = [];
    const varRegex = /\b(const|let|var|function)\s+([a-zA-Z_]\w*)/g;
    let match;
    while ((match = varRegex.exec(codeText)) !== null) {
        const name = match[2];
        if (name.length === 1) {
            const line = codeText.substr(0, match.index).split('\n').length;
            issues.push({
                message: `变量或函数名 "${name}" 太短，建议使用描述性名称`,
                line,
                severity: 1,
                filePath
            });
        }
    }
    return issues;
}
/**
 * 根据 qualityScore 生成所有 issues
 */
function generateIssuesFromQualityScore(qualityScore, codeText, filePath) {
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
function analyzeFileAndGenerateIssues(codeText, diagnostics, filePath) {
    const eslintIssues = diagnostics.map(d => ({
        message: d.message,
        line: d.range.start.line + 1,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
        filePath
    }));
    const qualityScore = (0, qualityScore_1.calculateQualityScore)(diagnostics, codeText);
    const otherIssues = generateIssuesFromQualityScore(qualityScore, codeText, filePath);
    return { allIssues: [...eslintIssues, ...otherIssues], qualityScore };
}
/**
 * ======== VS Code 插件激活 ========
 */
function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);
    // 通用错误处理
    function handleError(err, collection) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
        console.error(err);
        const outputChannel = vscode.window.createOutputChannel("Code Quality Analysis");
        outputChannel.appendLine(`Analysis failed: ${errorMessage}`);
        outputChannel.show();
        const errorDiagnostic = new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `代码分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error);
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
            const diagnostics = await (0, analyzer_1.analyzeCode)(document.getText(), document.languageId, cwd, document.fileName);
            diagnosticCollection.set(document.uri, diagnostics);
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
    // 手动分析当前文件
    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage('没有打开任何文件');
        const filePath = editor.document.uri.fsPath;
        try {
            // 使用传统分析方法（不依赖AI）
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            const { allIssues, qualityScore } = analyzeFileAndGenerateIssues(editor.document.getText(), diagnostics, editor.document.fileName);
            (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
            vscode.window.showInformationMessage('代码分析完成！');
            // 可选：使用AI增强分析（如果配置了API密钥）
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (openaiApiKey) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在使用AI进行深度代码分析...',
                    cancellable: false,
                }, async (progress) => {
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
    // 分析整个项目
    const projectDisposable = vscode.commands.registerCommand('extension.analyzeProject', async () => {
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
                    const { allIssues: fileIssues } = analyzeFileAndGenerateIssues(result.codeText, result.diagnostics, result.filePath);
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
            handleError(err, diagnosticCollection);
        }
    });
    context.subscriptions.push(disposable, projectDisposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map