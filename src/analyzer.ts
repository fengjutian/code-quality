import * as vscode from 'vscode';
import { ESLint } from 'eslint';
import * as fs from 'fs';
import * as path from 'path';

export async function analyzeCode(code: string, language: string, cwd?: string, fileName?: string): Promise<vscode.Diagnostic[]> {
    const diagnostics: vscode.Diagnostic[] = [];

    if (language === 'javascript' || language === 'typescript') {
        try {
            const eslint = new ESLint({
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
                    const range = new vscode.Range(
                        new vscode.Position(msg.line - 1, msg.column - 1),
                        new vscode.Position(msg.endLine ? msg.endLine - 1 : msg.line - 1, msg.endColumn ? msg.endColumn - 1 : msg.column)
                    );
                    const severity = msg.severity === 2 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                    diagnostics.push(new vscode.Diagnostic(range, msg.message, severity));
                });
            });
        } catch (error) {
            console.error('ESLint分析错误:', error);
            // 创建一个诊断对象来显示错误
            const errorMessage = error instanceof Error ? error.message : String(error);
            const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
            diagnostics.push(new vscode.Diagnostic(range, `ESLint分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error));
        }
    }

    return diagnostics;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
           if (file === 'node_modules' || file === '.git' || file === 'out' || file === 'dist') {
              return;
            }
            getAllFiles(fullPath, fileList);
        } else if (/\.(js|ts|jsx|tsx|vue|py|go|cpp)$/.test(file)) {
            fileList.push(fullPath);
        }
    });
    return fileList;
}

// 定义文件分析结果接口
export interface FileAnalysisResult {
    filePath: string;
    diagnostics: vscode.Diagnostic[];
    codeText: string;
}

// 分析整个目录的代码质量
export async function analyzeDirectory(rootPath: string): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];
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
