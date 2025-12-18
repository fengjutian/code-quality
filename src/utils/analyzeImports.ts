import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import builtinModules from 'builtin-modules';

export type ModuleType = 'builtin' | 'third-party' | 'local';

export interface ModuleInfo {
    name: string;
    type: ModuleType;
}

/**
 * 分析单个文件的导入依赖
 */
export function analyzeFileImports(filePath: string): ModuleInfo[] {
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, 'utf-8');

    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ESNext,
        true,
        filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );

    const modules: ModuleInfo[] = [];

    function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            const moduleName = node.moduleSpecifier?.getText().replace(/['"]/g, '');
            if (moduleName) {
                modules.push(classifyModule(moduleName));
            }
        } else if (
            ts.isCallExpression(node) &&
            node.expression.getText() === 'require' &&
            node.arguments.length === 1
        ) {
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
function classifyModule(moduleName: string): ModuleInfo {
    if (moduleName.startsWith('.') || path.isAbsolute(moduleName)) {
        return { name: moduleName, type: 'local' };
    } else if (builtinModules.includes(moduleName.split('/')[0])) {
        return { name: moduleName, type: 'builtin' };
    } else {
        return { name: moduleName, type: 'third-party' };
    }
}
