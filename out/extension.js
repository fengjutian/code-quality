"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// extension.ts
const vscode = require("vscode");
const analyzer_1 = require("./analyzer");
const reportPanel_1 = require("./reportPanel");
const qualityScore_1 = require("./utils/qualityScore");
function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);
    // 文件保存时触发分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        const diagnostics = await (0, analyzer_1.analyzeCode)(document.getText(), document.languageId, cwd, document.fileName);
        diagnosticCollection.set(document.uri, diagnostics);
    });
    // 手动触发分析当前文件
    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有打开任何文件');
                return;
            }
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            // 动态计算质量得分
            const qualityScore = (0, qualityScore_1.calculateQualityScore)(diagnostics, editor.document.getText());
            // 转换为报告所需的 Issue 格式
            let issues = diagnostics.map((d) => ({
                message: d.message,
                line: d.range.start.line + 1,
                severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                filePath: editor.document.fileName
            }));
            // 添加非ESLint质量问题作为建议
            if (qualityScore.details) {
                const { lineCount, functionCount, commentLines, duplicateCount } = qualityScore.details;
                // 如果行数过多，添加警告
                if (lineCount > 200) {
                    issues.push({
                        message: `文件行数过多 (${lineCount} 行)，建议拆分为多个小文件`,
                        line: lineCount, // Show last line of file
                        severity: 1, // warning
                        filePath: editor.document.fileName
                    });
                }
                // 如果函数数量过多，添加警告 - show first function line
                if (functionCount > 10) {
                    // Find first function line
                    const codeLines = editor.document.getText().split('\n');
                    let firstFunctionLine = 1;
                    for (let i = 0; i < codeLines.length; i++) {
                        if (codeLines[i].includes('function') || codeLines[i].includes('=>')) {
                            firstFunctionLine = i + 1;
                            break;
                        }
                    }
                    issues.push({
                        message: `函数数量过多 (${functionCount} 个)，建议重构代码`,
                        line: firstFunctionLine,
                        severity: 1, // warning
                        filePath: editor.document.fileName
                    });
                }
                // 如果注释行数过少，添加警告 - show first line
                const commentRatio = commentLines / lineCount;
                if (commentRatio < 0.1) {
                    issues.push({
                        message: `注释比例过低 (${Math.round(commentRatio * 100)}%)，建议增加注释`,
                        line: 1,
                        severity: 1, // warning
                        filePath: editor.document.fileName
                    });
                }
                // 如果重复代码过多，添加警告 - show first duplicate line
                if (duplicateCount > 0) {
                    // Find first duplicate line
                    const linesCountMap = {};
                    const codeLines = editor.document.getText().split('\n');
                    let firstDuplicateLine = 1;
                    for (let i = 0; i < codeLines.length; i++) {
                        const trimmed = codeLines[i].trim();
                        if (!trimmed)
                            continue;
                        if (!linesCountMap[trimmed]) {
                            linesCountMap[trimmed] = { count: 1, line: i + 1 };
                        }
                        else {
                            linesCountMap[trimmed].count++;
                            if (linesCountMap[trimmed].count > 3) {
                                firstDuplicateLine = linesCountMap[trimmed].line;
                                break;
                            }
                        }
                    }
                    issues.push({
                        message: `检测到重复代码 (${duplicateCount} 处)，建议优化`,
                        line: firstDuplicateLine,
                        severity: 1, // warning
                        filePath: editor.document.fileName
                    });
                }
                // 如果测试分数较低，添加警告
                if (qualityScore.breakdown.testScore < 70) {
                    issues.push({
                        message: `测试覆盖率不足 (${qualityScore.breakdown.testScore}%)，建议增加测试`,
                        line: 1,
                        severity: 1, // warning
                        filePath: editor.document.fileName
                    });
                }
            }
            console.log('Displaying issues:', issues); // Debug log
            (0, reportPanel_1.showQualityReport)(context, qualityScore, issues);
            vscode.window.showInformationMessage('代码分析完成！');
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
            console.error(err);
            // 创建一个临时诊断集合来显示错误
            const errorDiagnostic = new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `代码分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error);
            // 如果有活动编辑器，将错误显示在当前文件中
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                diagnosticCollection.set(editor.document.uri, [errorDiagnostic]);
            }
        }
    });
    const projectDisposable = vscode.commands.registerCommand('extension.analyzeProject', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('没有打开任何工作区');
                return;
            }
            const rootPath = workspaceFolders[0].uri.fsPath;
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
                results.forEach(result => {
                    const uri = vscode.Uri.file(result.filePath);
                    diagnosticCollection.set(uri, result.diagnostics);
                    const fileIssues = result.diagnostics.map((d) => ({
                        message: d.message,
                        line: d.range.start.line + 1,
                        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                        filePath: result.filePath
                    }));
                    // 添加非ESLint质量问题作为建议
                    const fileQualityScore = (0, qualityScore_1.calculateQualityScore)(result.diagnostics, result.codeText);
                    if (fileQualityScore.details) {
                        const { lineCount, functionCount, commentLines, duplicateCount } = fileQualityScore.details;
                        // 如果行数过多，添加警告
                        if (lineCount > 200) {
                            fileIssues.push({
                                message: `文件行数过多 (${lineCount} 行)，建议拆分为多个小文件`,
                                line: lineCount, // Show last line of file
                                severity: 1, // warning
                                filePath: result.filePath
                            });
                        }
                        // 如果函数数量过多，添加警告 - show first function line
                        if (functionCount > 10) {
                            // Find first function line
                            const codeLines = result.codeText.split('\n');
                            let firstFunctionLine = 1;
                            for (let i = 0; i < codeLines.length; i++) {
                                if (codeLines[i].includes('function') || codeLines[i].includes('=>')) {
                                    firstFunctionLine = i + 1;
                                    break;
                                }
                            }
                            fileIssues.push({
                                message: `函数数量过多 (${functionCount} 个)，建议重构代码`,
                                line: firstFunctionLine,
                                severity: 1, // warning
                                filePath: result.filePath
                            });
                        }
                        // 如果注释行数过少，添加警告 - show first line
                        const commentRatio = commentLines / lineCount;
                        if (commentRatio < 0.1) {
                            fileIssues.push({
                                message: `注释比例过低 (${Math.round(commentRatio * 100)}%)，建议增加注释`,
                                line: 1,
                                severity: 1, // warning
                                filePath: result.filePath
                            });
                        }
                        // 如果重复代码过多，添加警告 - show first duplicate line
                        if (duplicateCount > 0) {
                            // Find first duplicate line
                            const linesCountMap = {};
                            const codeLines = result.codeText.split('\n');
                            let firstDuplicateLine = 1;
                            for (let i = 0; i < codeLines.length; i++) {
                                const trimmed = codeLines[i].trim();
                                if (!trimmed)
                                    continue;
                                if (!linesCountMap[trimmed]) {
                                    linesCountMap[trimmed] = { count: 1, line: i + 1 };
                                }
                                else {
                                    linesCountMap[trimmed].count++;
                                    if (linesCountMap[trimmed].count > 3) {
                                        firstDuplicateLine = linesCountMap[trimmed].line;
                                        break;
                                    }
                                }
                            }
                            fileIssues.push({
                                message: `检测到重复代码 (${duplicateCount} 处)，建议优化`,
                                line: firstDuplicateLine,
                                severity: 1, // warning
                                filePath: result.filePath
                            });
                        }
                        // 如果测试分数较低，添加警告
                        if (fileQualityScore.breakdown.testScore < 70) {
                            fileIssues.push({
                                message: `测试覆盖率不足 (${fileQualityScore.breakdown.testScore}%)，建议增加测试`,
                                line: 1,
                                severity: 1, // warning
                                filePath: result.filePath
                            });
                        }
                    }
                    allIssues = allIssues.concat(fileIssues);
                });
                console.log('All Issues:', allIssues);
                // Add debug log
                console.log('Displaying project issues:', allIssues); // Debug log
                // 项目总分 = 文件平均分
                const totalScore = results.length > 0
                    ? Math.round(results.reduce((sum, r) => sum + (0, qualityScore_1.calculateQualityScore)(r.diagnostics, r.codeText).score, 0) / results.length)
                    : 100;
                // 整体质量报告（可进一步改为加权平均每个指标）
                const qualityScore = {
                    score: totalScore,
                    breakdown: {
                        eslintScore: totalScore,
                        complexityScore: totalScore,
                        commentScore: totalScore,
                        duplicateScore: totalScore,
                        testScore: totalScore
                    }
                };
                progress.report({ increment: 100, message: '报告生成完成' });
                (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${allIssues.length} 个问题。`);
            });
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
            console.error(err);
            // 显示错误信息到输出面板
            const outputChannel = vscode.window.createOutputChannel("Code Quality Analysis");
            outputChannel.appendLine(`Project analysis failed: ${errorMessage}`);
            outputChannel.show();
            // 创建一个临时诊断集合来显示错误
            const errorDiagnostic = new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `项目代码分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error);
            // 清除之前的诊断并显示错误
            diagnosticCollection.clear();
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                diagnosticCollection.set(editor.document.uri, [errorDiagnostic]);
            }
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(projectDisposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map