import * as vscode from 'vscode';
import { analyzeCode } from './analyzer';
import { showQualityReport } from './reportPanel';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);

    // 文件保存时触发分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        // 获取当前工作区根目录
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        
        const diagnostics = await analyzeCode(document.getText(), document.languageId, cwd);
        diagnosticCollection.set(document.uri, diagnostics);
    });

    // 手动触发命令
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
          
          const diagnostics = await analyzeCode(editor.document.getText(), editor.document.languageId, cwd);
          diagnosticCollection.set(editor.document.uri, diagnostics);

          const score = Math.max(0, 100 - diagnostics.length * 5);
          
          // 创建符合 CodeQualityScore 接口的对象
          const qualityScore = {
            score: score,
            breakdown: {
              eslintScore: score, // 目前只使用 ESLint 评分
              complexityScore: 100, // 默认值
              commentScore: 100,    // 默认值
              duplicateScore: 100,  // 默认值
              testScore: 100        // 默认值
            }
          };
          
          // 创建符合 Issue 接口的问题列表
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

    context.subscriptions.push(disposable);
}

export function deactivate() {}
