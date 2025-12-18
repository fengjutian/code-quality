import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { AISelectedCodeActionProvider } from './providers/aiSelectedCodeActionProvider';
import { analyzeCode } from './analyzer';
import { handleError } from './utils/errorHandler';

/**
 * ======== VS Code 插件激活 ========
 * 扩展入口文件，仅负责模块注册和事件监听
 */
export async function activate(context: vscode.ExtensionContext) {
    // 创建诊断集合
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);

    // 注册CodeActionProvider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file', language: '*' },
            new AISelectedCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }
        )
    );

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

    // 注册所有命令
    registerCommands(context, diagnosticCollection);
}

export function deactivate() {}
