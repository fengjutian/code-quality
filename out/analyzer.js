"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCode = analyzeCode;
const vscode = require("vscode");
const eslint_1 = require("eslint");
async function analyzeCode(code, language, cwd) {
    const diagnostics = [];
    if (language === 'javascript' || language === 'typescript') {
        try {
            const eslint = new eslint_1.ESLint({
                cwd: cwd || process.cwd(), // 使用提供的工作目录或当前目录
                // 移除不再支持的useEslintrc选项
                overrideConfig: {
                    rules: {
                        'no-unused-vars': 'warn',
                        'no-undef': 'error',
                        'semi': ['error', 'always'],
                        'quotes': ['error', 'single']
                    }
                }
            });
            const results = await eslint.lintText(code);
            results.forEach(result => {
                result.messages.forEach(msg => {
                    const range = new vscode.Range(new vscode.Position(msg.line - 1, msg.column - 1), new vscode.Position(msg.endLine ? msg.endLine - 1 : msg.line - 1, msg.endColumn ? msg.endColumn - 1 : msg.column));
                    const severity = msg.severity === 2 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                    diagnostics.push(new vscode.Diagnostic(range, msg.message, severity));
                });
            });
        }
        catch (error) {
            console.error('ESLint分析错误:', error);
            // 发生错误时返回空诊断数组
        }
    }
    return diagnostics;
}
//# sourceMappingURL=analyzer.js.map