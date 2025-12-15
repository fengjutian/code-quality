"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCode = analyzeCode;
exports.analyzeDirectory = analyzeDirectory;
const vscode = require("vscode");
const eslint_1 = require("eslint");
const fs = require("fs");
const path = require("path");
async function analyzeCode(code, language, cwd, fileName) {
    const diagnostics = [];
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
                        'eqeqeq': ['error', 'always']
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
            // 发生错误时返回空诊断数组
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
// 获取目录中的所有JavaScript和TypeScript文件
async function getJavaScriptTypeScriptFiles(directoryPath) {
    const files = [];
    async function traverse(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            // 忽略node_modules和.git目录
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out' || entry.name === 'dist') {
                continue;
            }
            if (entry.isDirectory()) {
                await traverse(fullPath);
            }
            else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
                files.push(fullPath);
            }
        }
    }
    await traverse(directoryPath);
    return files;
}
//# sourceMappingURL=analyzer.js.map