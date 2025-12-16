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
    // 通用函数：根据 qualityScore 生成 issues
    function generateIssuesFromQualityScore(qualityScore, codeText, filePath) {
        const issues = [];
        const { lineCount, functionCount, commentLines, duplicateBlocks } = qualityScore.details;
        // 文件行数过多
        if (lineCount > 200) {
            issues.push({
                message: `文件行数过多 (${lineCount} 行)，建议拆分为多个小文件`,
                line: lineCount,
                severity: 1,
                filePath
            });
        }
        // 函数数量过多
        if (functionCount > 10) {
            const codeLines = codeText.split('\n');
            let firstFunctionLine = codeLines.findIndex(line => line.includes('function') || line.includes('=>')) + 1 || 1;
            issues.push({
                message: `函数数量过多 (${functionCount} 个)，建议重构代码`,
                line: firstFunctionLine,
                severity: 1,
                filePath
            });
        }
        // 注释比例过低
        const commentRatio = commentLines / lineCount;
        if (commentRatio < 0.1) {
            issues.push({
                message: `注释比例过低 (${Math.round(commentRatio * 100)}%)，建议增加注释`,
                line: 1,
                severity: 1,
                filePath
            });
        }
        // 重复代码
        if (duplicateBlocks > 0) {
            const linesCountMap = {};
            const codeLines = codeText.split('\n');
            for (let i = 0; i < codeLines.length; i++) {
                const trimmed = codeLines[i].trim();
                if (!trimmed)
                    continue;
                if (!linesCountMap[trimmed]) {
                    linesCountMap[trimmed] = { count: 1, lines: [i + 1] };
                }
                else {
                    linesCountMap[trimmed].count++;
                    linesCountMap[trimmed].lines.push(i + 1);
                    if (linesCountMap[trimmed].count > 3) {
                        issues.push({
                            message: `检测到重复代码: "${trimmed.substring(0, 30)}${trimmed.length > 30 ? '...' : ''}"`,
                            line: i + 1,
                            severity: 1,
                            filePath
                        });
                    }
                }
            }
        }
        // 测试分数低
        if (qualityScore.breakdown.testScore < 70) {
            issues.push({
                message: `测试覆盖率不足 (${qualityScore.breakdown.testScore}%)，建议增加测试`,
                line: 1,
                severity: 1,
                filePath
            });
        }
        return issues;
    }
    // 文件保存时触发分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
        const diagnostics = await (0, analyzer_1.analyzeCode)(document.getText(), document.languageId, cwd, document.fileName);
        diagnosticCollection.set(document.uri, diagnostics);
    });
    // 手动分析当前文件
    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor)
                return vscode.window.showErrorMessage('没有打开任何文件');
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            const qualityScore = (0, qualityScore_1.calculateQualityScore)(diagnostics, editor.document.getText());
            const eslintIssues = diagnostics.map((d) => ({
                message: d.message,
                line: d.range.start.line + 1,
                severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                filePath: editor.document.fileName
            }));
            const otherIssues = generateIssuesFromQualityScore(qualityScore, editor.document.getText(), editor.document.fileName);
            const allIssues = [...eslintIssues, ...otherIssues];
            (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
            vscode.window.showInformationMessage('代码分析完成！');
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
    // 分析整个项目
    const projectDisposable = vscode.commands.registerCommand('extension.analyzeProject', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0)
                return vscode.window.showErrorMessage('没有打开任何工作区');
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
                for (const result of results) {
                    const uri = vscode.Uri.file(result.filePath);
                    diagnosticCollection.set(uri, result.diagnostics);
                    const eslintIssues = result.diagnostics.map((d) => ({
                        message: d.message,
                        line: d.range.start.line + 1,
                        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                        filePath: result.filePath
                    }));
                    const fileQualityScore = (0, qualityScore_1.calculateQualityScore)(result.diagnostics, result.codeText);
                    const otherIssues = generateIssuesFromQualityScore(fileQualityScore, result.codeText, result.filePath);
                    allIssues.push(...eslintIssues, ...otherIssues);
                }
                const totalScore = results.length > 0
                    ? Math.round(results.reduce((sum, r) => sum + (0, qualityScore_1.calculateQualityScore)(r.diagnostics, r.codeText).score, 0) / results.length)
                    : 100;
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
            handleError(err, diagnosticCollection);
        }
    });
    context.subscriptions.push(disposable, projectDisposable);
    function handleError(err, collection) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
        console.error(err);
        const outputChannel = vscode.window.createOutputChannel("Code Quality Analysis");
        outputChannel.appendLine(`Analysis failed: ${errorMessage}`);
        outputChannel.show();
        const errorDiagnostic = new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `代码分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error);
        diagnosticCollection.clear();
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            collection.set(editor.document.uri, [errorDiagnostic]);
        }
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map