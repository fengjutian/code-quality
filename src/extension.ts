import * as vscode from 'vscode';
import { analyzeCode } from './analyzer';
import { showQualityReport } from './reportPanel';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);

    // 文件保存时触发分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        const diagnostics = await analyzeCode(document.getText(), document.languageId);
        diagnosticCollection.set(document.uri, diagnostics);
    });

    // 手动触发命令
    // const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
    //     const editor = vscode.window.activeTextEditor;
    //     if (!editor) return;

    //     const diagnostics = await analyzeCode(editor.document.getText(), editor.document.languageId);
    //     diagnosticCollection.set(editor.document.uri, diagnostics);

    //     // 生成评分和报告
    //     const score = Math.max(0, 100 - diagnostics.length * 5); // 简单评分算法
    //     showQualityReport(context, score, diagnostics.map(d => ({
    //         message: d.message,
    //         line: d.range.start.line + 1
    //     })));

    //     vscode.window.showInformationMessage('代码分析完成！');
    // });

    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
      try {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
              vscode.window.showErrorMessage('没有打开任何文件');
              return;
          }

          const issues = await AnalysisManager.analyze(editor.document.getText(), editor.document.languageId, editor.document.fileName);
          const diagnostics = issues.map(i => {
              const range = new vscode.Range(i.line-1, i.column? i.column-1:0, i.line-1, i.column? i.column:0);
              const severity = i.severity==='error'? vscode.DiagnosticSeverity.Error:
                              i.severity==='warning'? vscode.DiagnosticSeverity.Warning:
                              vscode.DiagnosticSeverity.Information;
              return new vscode.Diagnostic(range, i.message, severity);
          });

          diagnosticCollection.set(editor.document.uri, diagnostics);

          const score = Math.max(0, 100 - diagnostics.length*5);
          showQualityReport(context, score, issues);

          vscode.window.showInformationMessage('代码分析完成！');
      } catch (err: any) {
          vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${err.message}`);
          console.error(err);
      }
    });


    

    context.subscriptions.push(disposable);
}

export function deactivate() {}
