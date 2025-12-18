"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = handleError;
const vscode = require("vscode");
/**
 * 通用错误处理函数
 */
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
//# sourceMappingURL=errorHandler.js.map