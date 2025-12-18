import * as vscode from 'vscode';

export class AISelectedCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] | undefined {
        // 检查是否有选中的代码
        if (range.isEmpty) {
            console.log('CodeOracle: 没有选中代码，不提供AI分析选项');
            return;
        }

        console.log('CodeOracle: 检测到选中的代码，提供AI分析选项');

        const action = new vscode.CodeAction(
            'CodeOracle: 分析选中代码 (AI)',
            vscode.CodeActionKind.Refactor
        );

        action.command = {
            command: 'extension.analyzeSelectedCodeWithAI',
            title: '分析选中代码',
            arguments: [document, range]
        };

        return [action];
    }
}
