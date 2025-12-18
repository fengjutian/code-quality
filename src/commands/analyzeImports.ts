import * as vscode from 'vscode';
import { analyzeFileImports } from '../utils/analyzeImports';

export function registerAnalyzeImportsCommand() {
    const disposable = vscode.commands.registerCommand('extension.showImports', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const filePath = editor.document.uri.fsPath;
        const imports = analyzeFileImports(filePath);

        const thirdParty = imports.filter(m => m.type === 'third-party').map(m => m.name);
        const local = imports.filter(m => m.type === 'local').map(m => m.name);
        const builtin = imports.filter(m => m.type === 'builtin').map(m => m.name);

        vscode.window.showInformationMessage(
            `Builtin: ${builtin.join(', ')}\nThird-party: ${thirdParty.join(', ')}\nLocal: ${local.join(', ')}`
        );
    });

    return disposable
}
