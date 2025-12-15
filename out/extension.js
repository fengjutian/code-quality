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
            const issues = diagnostics.map((d) => ({
                message: d.message,
                line: d.range.start.line + 1,
                severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                filePath: editor.document.fileName
            }));
            (0, reportPanel_1.showQualityReport)(context, qualityScore, issues);
            vscode.window.showInformationMessage('代码分析完成！');
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
            console.error(err);
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
                    allIssues = allIssues.concat(fileIssues);
                });
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
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(projectDisposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map