"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCode = analyzeCode;
exports.analyzeDirectory = analyzeDirectory;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
// export async function analyzeCode(code: string, language: string, cwd?: string, fileName?: string): Promise<vscode.Diagnostic[]> {
//     const diagnostics: vscode.Diagnostic[] = [];
//     if (language === 'javascript' || language === 'typescript') {
//         try {
//             const eslint = new ESLint({
//                 cwd: cwd || process.cwd(), // 使用提供的工作目录或当前目录
//                 overrideConfig: {
//                     files: ['*.js', '*.ts'],
//                     languageOptions: {
//                         ecmaVersion: 'latest',
//                         sourceType: 'module'
//                     },
//                     rules: {
//                         'no-unused-vars': 'warn',
//                         'no-undef': 'error',
//                         'semi': ['error', 'always'],
//                         'quotes': ['error', 'single'],
//                         'no-console': 'warn',
//                         'no-empty': 'error',
//                         'curly': ['error', 'all'],
//                         'eqeqeq': ['error', 'always']
//                     }
//                 }
//             });
//             // 提供文件名信息，以便ESLint正确应用规则
//             const results = await eslint.lintText(code, {
//                 filePath: fileName || `test.${language}`
//             });
//             results.forEach(result => {
//                 result.messages.forEach(msg => {
//                     const range = new vscode.Range(
//                         new vscode.Position(msg.line - 1, msg.column - 1),
//                         new vscode.Position(msg.endLine ? msg.endLine - 1 : msg.line - 1, msg.endColumn ? msg.endColumn - 1 : msg.column)
//                     );
//                     const severity = msg.severity === 2 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
//                     diagnostics.push(new vscode.Diagnostic(range, msg.message, severity));
//                 });
//             });
//         } catch (error) {
//             console.error('ESLint分析错误:', error);
//             // 创建一个诊断对象来显示错误
//             const errorMessage = error instanceof Error ? error.message : String(error);
//             const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
//             diagnostics.push(new vscode.Diagnostic(range, `ESLint分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error));
//         }
//     }
//     return diagnostics;
// }
// 计算圈复杂度
function calculateCyclomaticComplexity(code) {
    // 简单实现：统计条件语句和循环语句
    const complexity = (code.match(/(if|for|while|switch|case|&&|\|\|)/g) || []).length + 1;
    return complexity;
}
// 评估函数长度
function evaluateFunctionLength(code) {
    const issues = [];
    const lines = code.split('\n').length;
    let score = 100;
    if (lines > 50) {
        score = Math.max(0, 100 - (lines - 50) * 2);
        issues.push(`函数长度过长（${lines}行），建议拆分`);
    }
    return { score, issues };
}
// 评估嵌套深度
function evaluateNestedDepth(code) {
    const issues = [];
    let maxDepth = 0;
    let currentDepth = 0;
    // 简单实现：统计括号嵌套
    for (const char of code) {
        if (char === '{' || char === '(' || char === '[') {
            currentDepth++;
            maxDepth = Math.max(maxDepth, currentDepth);
        }
        else if (char === '}' || char === ')' || char === ']') {
            currentDepth--;
        }
    }
    let score = 100;
    if (maxDepth > 3) {
        score = Math.max(0, 100 - (maxDepth - 3) * 20);
        issues.push(`嵌套深度过大（${maxDepth}层），建议重构`);
    }
    return { score, issues };
}
// 扩展 analyzeCode 函数，添加启发式评估
async function analyzeCode(code, language, cwd, fileName) {
    const diagnostics = [];
    // 现有 ESLint 分析...
    // 添加启发式评估
    if (language === 'javascript' || language === 'typescript') {
        // 评估函数长度
        const functionLengthResult = evaluateFunctionLength(code);
        if (functionLengthResult.issues.length > 0) {
            // 创建诊断信息
            functionLengthResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 评估嵌套深度
        const nestedDepthResult = evaluateNestedDepth(code);
        if (nestedDepthResult.issues.length > 0) {
            nestedDepthResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 计算圈复杂度
        const complexity = calculateCyclomaticComplexity(code);
        if (complexity > 10) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `圈复杂度较高（${complexity}），建议重构以降低复杂度`, vscode.DiagnosticSeverity.Warning));
        }
    }
    return diagnostics;
}
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === 'out' || file === 'dist') {
                return;
            }
            getAllFiles(fullPath, fileList);
        }
        else if (/\.(js|ts|jsx|tsx|vue|py|go|cpp)$/.test(file)) {
            fileList.push(fullPath);
        }
    });
    return fileList;
}
// 分析整个目录的代码质量
async function analyzeDirectory(rootPath) {
    const results = [];
    const files = getAllFiles(rootPath);
    for (const filePath of files) {
        const codeText = fs.readFileSync(filePath, 'utf-8');
        const languageId = path.extname(filePath).slice(1); // 简单获取语言，可根据需要改
        const diagnostics = await analyzeCode(codeText, languageId, rootPath, filePath);
        results.push({
            filePath,
            diagnostics,
            codeText
        });
    }
    return results;
}
//# sourceMappingURL=analyzer.js.map