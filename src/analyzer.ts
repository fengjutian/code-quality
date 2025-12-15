import * as vscode from 'vscode';
import { ESLint } from 'eslint';

export async function analyzeCode(code: string, language: string): Promise<vscode.Diagnostic[]> {
    const diagnostics: vscode.Diagnostic[] = [];

    if (language === 'javascript' || language === 'typescript') {
        const eslint = new ESLint(); // 移除了不兼容的 useEslintrc 选项
        const results = await eslint.lintText(code);

        results.forEach(result => {
            result.messages.forEach(msg => {
                const range = new vscode.Range(
                    new vscode.Position(msg.line - 1, msg.column - 1),
                    new vscode.Position(msg.endLine ? msg.endLine - 1 : msg.line - 1, msg.endColumn ? msg.endColumn - 1 : msg.column)
                );
                const severity = msg.severity === 2 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                diagnostics.push(new vscode.Diagnostic(range, msg.message, severity));
            });
        });
    }

    return diagnostics;
}
