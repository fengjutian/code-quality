"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const analyzer_1 = require("./analyzer");
const reportPanel_1 = require("./reportPanel");
function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);
    // 文件保存时触发分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        // 获取当前工作区根目录
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        // 传递文件名参数
        const diagnostics = await (0, analyzer_1.analyzeCode)(document.getText(), document.languageId, cwd, document.fileName);
        diagnosticCollection.set(document.uri, diagnostics);
    });
    // 手动触发命令 - 分析当前文件
    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有打开任何文件');
                return;
            }
            // 获取当前工作区根目录
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
            // 传递文件名参数
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            // 得分计算逻辑保持不变
            const score = Math.max(0, 100 - diagnostics.length * 5);
            // 创建符合 CodeQualityScore 接口的对象
            const qualityScore = {
                score: score,
                breakdown: {
                    eslintScore: score, // 目前只使用 ESLint 评分
                    complexityScore: 100, // 默认值
                    commentScore: 100, // 默认值
                    duplicateScore: 100, // 默认值
                    testScore: 100 // 默认值
                }
            };
            // 创建符合 Issue 接口的问题列表
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
    // 分析整个项目的命令
    const projectDisposable = vscode.commands.registerCommand('extension.analyzeProject', async () => {
        try {
            // 获取当前工作区根目录
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('没有打开任何工作区');
                return;
            }
            const rootPath = workspaceFolders[0].uri.fsPath;
            // 显示进度条
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '分析整个项目的代码质量',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: '开始分析...' });
                // 分析整个目录
                const results = await (0, analyzer_1.analyzeDirectory)(rootPath);
                progress.report({ increment: 50, message: '分析完成，生成报告...' });
                // 清空之前的诊断信息
                diagnosticCollection.clear();
                // 聚合所有问题
                let allIssues = [];
                let totalIssues = 0;
                results.forEach(result => {
                    const uri = vscode.Uri.file(result.filePath);
                    diagnosticCollection.set(uri, result.diagnostics);
                    totalIssues += result.diagnostics.length;
                    // 转换为报告所需的Issue格式
                    const fileIssues = result.diagnostics.map((d) => ({
                        message: d.message,
                        line: d.range.start.line + 1,
                        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                        filePath: result.filePath
                    }));
                    allIssues = allIssues.concat(fileIssues);
                });
                // 计算质量得分
                const score = Math.max(0, 100 - totalIssues * 2); // 整个项目的问题权重较低
                // 创建符合 CodeQualityScore 接口的对象
                const qualityScore = {
                    score: score,
                    breakdown: {
                        eslintScore: score, // 目前只使用 ESLint 评分
                        complexityScore: 100, // 默认值
                        commentScore: 100, // 默认值
                        duplicateScore: 100, // 默认值
                        testScore: 100 // 默认值
                    }
                };
                progress.report({ increment: 100, message: '报告生成完成' });
                // 显示质量报告
                (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${totalIssues} 个问题。`);
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