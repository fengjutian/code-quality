"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeFileImports = analyzeFileImports;
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const builtin_modules_1 = require("builtin-modules");
/**
 * 分析单个文件的导入依赖
 */
function analyzeFileImports(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ESNext, true, filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const modules = [];
    function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            const moduleName = node.moduleSpecifier?.getText().replace(/['"]/g, '');
            if (moduleName) {
                modules.push(classifyModule(moduleName));
            }
        }
        else if (ts.isCallExpression(node) &&
            node.expression.getText() === 'require' &&
            node.arguments.length === 1) {
            const arg = node.arguments[0];
            if (ts.isStringLiteral(arg)) {
                modules.push(classifyModule(arg.text));
            }
        }
        ts.forEachChild(node, visit);
    }
    ts.forEachChild(sourceFile, visit);
    return modules;
}
/**
 * 根据模块名判断类型
 */
function classifyModule(moduleName) {
    if (moduleName.startsWith('.') || path.isAbsolute(moduleName)) {
        return { name: moduleName, type: 'local' };
    }
    else if (builtin_modules_1.default.includes(moduleName.split('/')[0])) {
        return { name: moduleName, type: 'builtin' };
    }
    else {
        return { name: moduleName, type: 'third-party' };
    }
}
//# sourceMappingURL=analyzeImports.js.map