"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const commands_1 = require("./commands");
const aiSelectedCodeActionProvider_1 = require("./providers/aiSelectedCodeActionProvider");
const analyzer_1 = require("./analyzer");
const errorHandler_1 = require("./utils/errorHandler");
/**
 * ======== VS Code 插件激活 ========
 * 扩展入口文件，仅负责模块注册和事件监听
 */
async function activate(context) {
    // 创建诊断集合
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);
    // 注册CodeActionProvider
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, new aiSelectedCodeActionProvider_1.AISelectedCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }));
    // 文件保存时自动分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        try {
            const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(document.getText(), document.languageId, cwd, document.fileName);
            diagnosticCollection.set(document.uri, diagnostics);
        }
        catch (err) {
            (0, errorHandler_1.handleError)(err, diagnosticCollection);
        }
    });
    // 注册所有命令
    (0, commands_1.registerCommands)(context, diagnosticCollection);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map