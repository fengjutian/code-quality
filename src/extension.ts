// extension.ts
import * as vscode from 'vscode';
import { analyzeCode, analyzeDirectory, FileAnalysisResult } from './analyzer';
import { showQualityReport } from './reportPanel';
import { calculateQualityScore } from './utils/qualityScore';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);

    // 文件保存时触发分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

        const diagnostics = await analyzeCode(document.getText(), document.languageId, cwd, document.fileName);
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

            const diagnostics = await analyzeCode(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);

            // 动态计算质量得分
            const qualityScore = calculateQualityScore(diagnostics, editor.document.getText());

            // 转换为报告所需的 Issue 格式
            const issues = diagnostics.map((d: vscode.Diagnostic) => ({
                message: d.message,
                line: d.range.start.line + 1,
                severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                filePath: editor.document.fileName
            }));

            showQualityReport(context, qualityScore, issues);
            vscode.window.showInformationMessage('代码分析完成！');

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
            console.error(err);
        }
    });

    // 分析整个项目
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

                const results: FileAnalysisResult[] = await analyzeDirectory(rootPath);

                progress.report({ increment: 50, message: '分析完成，生成报告...' });

                diagnosticCollection.clear();

                let allIssues: any[] = [];
                let totalIssues = 0;

                results.forEach(result => {
                    const uri = vscode.Uri.file(result.filePath);
                    diagnosticCollection.set(uri, result.diagnostics);

                    totalIssues += result.diagnostics.length;

                    // 动态计算每个文件质量得分
                    // const fileQuality = calculateQualityScore(result.diagnostics, result.codeText);

                    const fileIssues = result.diagnostics.map((d: vscode.Diagnostic) => ({
                        message: d.message,
                        line: d.range.start.line + 1,
                        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
                        filePath: result.filePath
                    }));

                    allIssues = allIssues.concat(fileIssues);
                });

                // 整体项目得分，可取文件平均
                const totalScore = results.length > 0
                    ? Math.round(results.reduce((sum, r) => sum + calculateQualityScore(r.diagnostics, r.codeText).score, 0) / results.length)
                    : 100;

                const qualityScore = {
                    score: totalScore,
                    breakdown: {
                        eslintScore: totalScore, // 可加权平均或取总平均
                        complexityScore: totalScore,
                        commentScore: totalScore,
                        duplicateScore: totalScore,
                        testScore: totalScore
                    }
                };

                progress.report({ increment: 100, message: '报告生成完成' });

                showQualityReport(context, qualityScore, allIssues);

                vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${totalIssues} 个问题。`);
            });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
            console.error(err);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(projectDisposable);
}

export function deactivate() {}
