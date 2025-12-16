"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCode = analyzeCode;
exports.analyzeDirectory = analyzeDirectory;
const vscode = require("vscode");
const eslint_1 = require("eslint");
const fs = require("fs");
const path = require("path");
const index_1 = require("./utils/index");
const heuristic_evaluation_1 = require("./utils/heuristic-evaluation");
// 扩展 analyzeCode 函数，添加启发式评估
async function analyzeCode(code, language, cwd, fileName) {
    const diagnostics = [];
    // 现有 ESLint 分析...
    if (language === 'javascript' || language === 'typescript') {
        try {
            const eslint = new eslint_1.ESLint({
                cwd: cwd || process.cwd(), // 使用提供的工作目录或当前目录
                overrideConfig: {
                    files: ['*.js', '*.ts'],
                    languageOptions: {
                        ecmaVersion: 'latest',
                        sourceType: 'module'
                    },
                    rules: {
                        'no-unused-vars': 'warn',
                        'no-undef': 'error',
                        'semi': ['error', 'always'],
                        'quotes': ['error', 'single'],
                        'no-console': 'warn',
                        'no-empty': 'error',
                        'curly': ['error', 'all'],
                        'eqeqeq': ['error', 'always'],
                        '@typescript-eslint/no-explicit-any': 'error'
                    }
                }
            });
            // 提供文件名信息，以便ESLint正确应用规则
            const results = await eslint.lintText(code, {
                filePath: fileName || `test.${language}`
            });
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
            // 创建一个诊断对象来显示错误
            const errorMessage = error instanceof Error ? error.message : String(error);
            const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
            diagnostics.push(new vscode.Diagnostic(range, `ESLint分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error));
        }
    }
    // 添加启发式评估
    if (language === 'javascript' || language === 'typescript') {
        // 评估函数长度
        const functionLengthResult = (0, heuristic_evaluation_1.evaluateFunctionLength)(code);
        if (functionLengthResult.issues.length > 0) {
            // 创建诊断信息
            functionLengthResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 评估嵌套深度
        const nestedDepthResult = (0, heuristic_evaluation_1.evaluateNestedDepth)(code);
        if (nestedDepthResult.issues.length > 0) {
            nestedDepthResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 计算圈复杂度
        const complexity = (0, heuristic_evaluation_1.calculateCyclomaticComplexity)(code);
        if (complexity > 10) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `圈复杂度较高（${complexity}），建议重构以降低复杂度`, vscode.DiagnosticSeverity.Warning));
        }
        // 检测代码重复度
        const duplicationResult = (0, heuristic_evaluation_1.detectCodeDuplication)(code);
        if (duplicationResult.issues.length > 0) {
            duplicationResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 评估注释密度
        const commentResult = (0, heuristic_evaluation_1.evaluateCommentDensity)(code);
        if (commentResult.issues.length > 0) {
            commentResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 检查变量命名规范
        const namingResult = (0, heuristic_evaluation_1.checkVariableNaming)(code);
        if (namingResult.issues.length > 0) {
            namingResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 检测魔法数字
        const magicNumberResult = (0, heuristic_evaluation_1.detectMagicNumbers)(code);
        if (magicNumberResult.issues.length > 0) {
            magicNumberResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 检查错误处理
        const errorHandlingResult = (0, heuristic_evaluation_1.checkErrorHandling)(code);
        if (errorHandlingResult.issues.length > 0) {
            errorHandlingResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 检查函数参数数量
        const parameterResult = (0, heuristic_evaluation_1.checkFunctionParameters)(code);
        if (parameterResult.issues.length > 0) {
            parameterResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 检查过长行
        const longLineResult = (0, heuristic_evaluation_1.checkLongLines)(code);
        if (longLineResult.issues.length > 0) {
            longLineResult.issues.forEach(issue => {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
            });
        }
        // 检测any类型使用（仅对TypeScript文件生效）
        if (language === 'typescript') {
            const anyTypeResult = (0, heuristic_evaluation_1.detectAnyTypeUsage)(code);
            if (anyTypeResult.issues.length > 0) {
                anyTypeResult.issues.forEach((issue) => {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), issue, vscode.DiagnosticSeverity.Warning));
                });
            }
        }
    }
    return diagnostics;
}
// 分析整个目录的代码质量
async function analyzeDirectory(rootPath) {
    const results = [];
    const files = (0, index_1.getAllFiles)(rootPath);
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