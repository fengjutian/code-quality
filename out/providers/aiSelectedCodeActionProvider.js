"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISelectedCodeActionProvider = void 0;
const vscode = require("vscode");
class AISelectedCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        // 检查是否有选中的代码
        if (range.isEmpty) {
            console.log('CodeOracle: 没有选中代码，不提供AI分析选项');
            return;
        }
        console.log('CodeOracle: 检测到选中的代码，提供AI分析选项');
        const action = new vscode.CodeAction('CodeOracle: 分析选中代码 (AI)', vscode.CodeActionKind.Refactor);
        action.command = {
            command: 'extension.analyzeSelectedCodeWithAI',
            title: '分析选中代码',
            arguments: [document, range]
        };
        return [action];
    }
}
exports.AISelectedCodeActionProvider = AISelectedCodeActionProvider;
//# sourceMappingURL=aiSelectedCodeActionProvider.js.map