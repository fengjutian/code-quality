import * as vscode from 'vscode';
import { analyzeCode, analyzeDirectory } from './analyzer';
import { showQualityReport } from './reportPanel';
import { calculateQualityScore } from './utils/qualityScore';

/**
 * ======== 质量检查小函数集合 ========
 * 每个函数负责生成对应的 issues
 */
function checkLineCount(lineCount: number, filePath: string) {
    if (lineCount <= 200) return [];
    return [{
        message: `文件行数过多 (${lineCount} 行)，建议拆分为多个小文件`,
        line: lineCount,
        severity: 1,
        filePath
    }];
}

function checkFunctionCount(functionCount: number, codeText: string, filePath: string) {
    if (functionCount <= 10) return [];
    const codeLines = codeText.split('\n');
    const firstFunctionLine = codeLines.findIndex(line => line.includes('function') || line.includes('=>')) + 1 || 1;
    return [{
        message: `函数数量过多 (${functionCount} 个)，建议重构代码`,
        line: firstFunctionLine,
        severity: 1,
        filePath
    }];
}

function checkFunctionLength(codeText: string, filePath: string) {
    const issues: any[] = [];
    const lines = codeText.split('\n');
    const funcRegex = /\bfunction\b|\b=>\b/g;
    let funcStart = -1;

    lines.forEach((line, idx) => {
        if (funcRegex.test(line)) {
            funcStart = idx;
        } else if (funcStart >= 0 && line.trim() === '') {
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

function checkCommentRatio(commentLines: number, lineCount: number, filePath: string) {
    const ratio = commentLines / lineCount;
    if (ratio >= 0.1) return [];
    return [{
        message: `注释比例过低 (${Math.round(ratio * 100)}%)，建议增加注释`,
        line: 1,
        severity: 1,
        filePath
    }];
}

function checkDuplicateBlocks(codeText: string, filePath: string, minBlockSize = 3) {
    const issues: any[] = [];
    const lines = codeText.split('\n');
    const blockMap = new Map<string, number[]>(); // key = block hash, value = 行号数组

    for (let i = 0; i <= lines.length - minBlockSize; i++) {
        const block = lines.slice(i, i + minBlockSize).map(l => l.trim()).join('\n');
        if (!block.trim()) continue; // 空块不算

        if (!blockMap.has(block)) {
            blockMap.set(block, [i + 1]);
        } else {
            const occurrences = blockMap.get(block)!;
            occurrences.push(i + 1);

            // 仅当出现超过1次时才报 issue
            if (occurrences.length === 2) {
                // 第一次重复出现
                issues.push({
                    message: `检测到重复代码块（${minBlockSize}行起）`,
                    line: i + 1,
                    severity: 1,
                    filePath
                });
            }
        }
    }

    return issues;
}

function checkTestScore(testScore: number, filePath: string) {
    if (testScore >= 70) return [];
    return [{
        message: `测试覆盖率不足 (${testScore}%)，建议增加测试`,
        line: 1,
        severity: 1,
        filePath
    }];
}

function checkWhitespaceIssues(codeText: string, filePath: string) {
    const issues: any[] = [];
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

function checkNamingConvention(codeText: string, filePath: string) {
    const issues: any[] = [];
    const varRegex = /\b(const|let|var|function)\s+([a-zA-Z_]\w*)/g;
    let match: RegExpExecArray | null;
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
function generateIssuesFromQualityScore(
    qualityScore: ReturnType<typeof calculateQualityScore>,
    codeText: string,
    filePath: string
) {
    const { lineCount, functionCount, commentLines, duplicateBlocks } = qualityScore.details;
    const testScore = qualityScore.breakdown.testScore;

    return [
        ...checkLineCount(lineCount, filePath),
        ...checkFunctionCount(functionCount, codeText, filePath),
        ...checkFunctionLength(codeText, filePath),
        ...checkCommentRatio(commentLines, lineCount, filePath),
        ...checkDuplicateBlocks(codeText, filePath, duplicateBlocks),
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
export function activate(context: vscode.ExtensionContext) {
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

        try {
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

                const totalScore = results.length > 0
                    ? Math.round(results.reduce((sum, r) => sum + calculateQualityScore(r.diagnostics, r.codeText).score, 0) / results.length)
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
                showQualityReport(context, qualityScore, allIssues);

                vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${allIssues.length} 个问题。`);
            });
        } catch (err: unknown) {
            handleError(err, diagnosticCollection);
        }
    });

    context.subscriptions.push(disposable, projectDisposable);
}

export function deactivate() {}
