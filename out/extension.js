"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// extension.ts
const vscode = require("vscode");
const analyzer_1 = require("./analyzer");
const reportPanel_1 = require("./reportPanel");
const qualityScore_1 = require("./utils/qualityScore");
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
function checkFunctionLength(codeText, filePath) {
    const issues = [];
    const lines = codeText.split('\n');
    const funcRegex = /\bfunction\b|\b=>\b/g;
    let funcStart = -1;
    lines.forEach((line, idx) => {
        if (funcRegex.test(line)) {
            funcStart = idx;
        }
        else if (funcStart >= 0 && line.trim() === '') {
            const length = idx - funcStart;
            if (length > 50) {
                issues.push({
                    message: `函数过长 (${length} 行)，建议拆分`,
                    line: funcStart + 1,
                    severity: 1,
                    filePath
                });
            }
            funcStart = -1;
        }
    });
    return issues;
}
function checkCommentRatio(commentLines, lineCount, filePath) {
    const ratio = commentLines / lineCount;
    if (ratio >= 0.1)
        return [];
    return [{
            message: `注释比例过低 (${Math.round(ratio * 100)}%)，建议增加注释`,
            line: 1,
            severity: 1,
            filePath
        }];
}
function checkDuplicateBlocks(duplicateBlocks, codeText, filePath) {
    if (duplicateBlocks <= 0)
        return [];
    const issues = [];
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
    const lines = codeText.split('\n');
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
    const { lineCount, functionCount, commentLines, duplicateBlocks } = qualityScore.details;
    const testScore = qualityScore.breakdown.testScore;
    return [
        ...checkLineCount(lineCount, filePath),
        ...checkFunctionCount(functionCount, codeText, filePath),
        ...checkFunctionLength(codeText, filePath),
        ...checkCommentRatio(commentLines, lineCount, filePath),
        ...checkDuplicateBlocks(duplicateBlocks, codeText, filePath),
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
        try {
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            const { allIssues, qualityScore } = analyzeFileAndGenerateIssues(editor.document.getText(), diagnostics, editor.document.fileName);
            (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
            vscode.window.showInformationMessage('代码分析完成！');
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
}
function deactivate() { }
//# sourceMappingURL=extension.js.map