// 计算圈复杂度
export function calculateCyclomaticComplexity(code: string): number {
    // 简单实现：统计条件语句和循环语句
    const complexity = (code.match(/(if|for|while|switch|case|&&|\|\|)/g) || []).length + 1;
    return complexity;
}

// 评估函数长度
export function evaluateFunctionLength(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    const lines = code.split('\n').length;

    let score = 100;
    if (lines > 50) {
        score = Math.max(0, 100 - (lines - 50) * 2);
        issues.push(`函数长度过长（${lines}行），建议拆分`);
    }

    return { score, issues };
}

// 评估嵌套深度
export function evaluateNestedDepth(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let maxDepth = 0;
    let currentDepth = 0;

    // 简单实现：统计括号嵌套
    for (const char of code) {
        if (char === '{' || char === '(' || char === '[') {
            currentDepth++;
            maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === '}' || char === ')' || char === ']') {
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

// 检测代码重复度
export function detectCodeDuplication(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    const lines = code.split('\n');
    const lineMap = new Map<string, number[]>();

    // 构建行映射，记录每行出现的行号
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*') && !trimmedLine.startsWith('*')) {
            if (!lineMap.has(trimmedLine)) {
                lineMap.set(trimmedLine, []);
            }
            lineMap.get(trimmedLine)?.push(index + 1);
        }
    });

    // 查找重复行
    let duplicateCount = 0;
    lineMap.forEach((lineNumbers, lineContent) => {
        if (lineNumbers.length > 1 && lineContent.length > 10) {
            duplicateCount++;
            if (duplicateCount <= 5) { // 只报告前5个重复行
                issues.push(`发现重复代码行："${lineContent.substring(0, 50)}..." 出现在行 ${lineNumbers.join(', ')}`);
            }
        }
    });

    // 计算得分
    const score = Math.max(0, 100 - duplicateCount * 5);

    return { score, issues };
}


// 评估注释密度
export function evaluateCommentDensity(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    const lines = code.split('\n');
    const totalLines = lines.length;

    if (totalLines === 0) {
        return { score: 100, issues };
    }

    // 统计注释行
    let commentLines = 0;
    let inBlockComment = false;
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (inBlockComment) {
            commentLines++;
            if (trimmedLine.includes('*/')) {
                inBlockComment = false;
            }
        } else {
            if (trimmedLine.startsWith('//')) {
                commentLines++;
            } else if (trimmedLine.startsWith('/*')) {
                commentLines++;
                if (!trimmedLine.includes('*/')) {
                    inBlockComment = true;
                }
            } else if (trimmedLine.includes('/*') && trimmedLine.includes('*/')) {
                // 单行块注释
                commentLines++;
            } else if (trimmedLine.includes('/*')) {
                commentLines++;
                inBlockComment = true;
            }
        }
    });
    
    const commentDensity = (commentLines / totalLines) * 100;
    let score = 100;
    
    if (commentDensity < 10) {
        score = Math.max(0, commentDensity * 10);
        issues.push(`注释密度过低（${commentDensity.toFixed(1)}%），建议增加注释`);
    } else if (commentDensity > 50) {
        score = Math.max(0, 150 - commentDensity * 1);
        issues.push(`注释密度过高（${commentDensity.toFixed(1)}%），建议减少不必要的注释`);
    }
    
    return { score, issues };
}

// 检查变量命名规范
export function checkVariableNaming(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    
    // 检测变量声明
    const varDeclarations = code.match(/(let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    
    let namingIssues = 0;
    
    varDeclarations.forEach(declaration => {
        const varName = declaration.split(' ')[1];
        
        // 检查是否使用驼峰命名
        if (!/^[a-z][a-zA-Z0-9]*$/.test(varName)) {
            namingIssues++;
            if (namingIssues <= 5) { // 只报告前5个命名问题
                issues.push(`变量命名不规范："${varName}"，建议使用驼峰命名法`);
            }
        }
    });
    
    // 检查常量命名（使用大写）
    const constDeclarations = code.match(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    
    constDeclarations.forEach(declaration => {
        const constName = declaration.split(' ')[1];
        
        // 排除函数、对象、数组等非简单常量
        if (/^[A-Z_]+$/.test(constName)) {
            // 正确使用大写命名常量
        } else if (!code.includes(`${constName} = `) && !code.includes(`${constName}: `)) {
            // 如果不是赋值或对象属性，可能是简单常量
            namingIssues++;
            if (namingIssues <= 5) {
                issues.push(`常量命名不规范："${constName}"，建议使用全大写命名法`);
            }
        }
    });
    
    const score = Math.max(0, 100 - namingIssues * 10);
    
    return { score, issues };
}

// 检测魔法数字
export function detectMagicNumbers(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];

    // 正则表达式：匹配数字但排除行号、版本号、CSS单位等
    const magicNumberRegex = /\b(\d+\.?\d*)\b(?!\s*[a-zA-Z])(?!\s*%)/g;
    const magicNumbers = code.match(magicNumberRegex) || [];

    // 排除常用数字
    const commonNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '100', '1000'];

    let magicNumberCount = 0;
    const uniqueMagicNumbers = new Set<string>();

    magicNumbers.forEach(number => {
        if (!commonNumbers.includes(number) && number.length > 1) {
            uniqueMagicNumbers.add(number);
            magicNumberCount++;
        }
    });

    if (uniqueMagicNumbers.size > 0) {
        uniqueMagicNumbers.forEach(number => {
            if (magicNumberCount <= 5) {
                issues.push(`发现魔法数字：${number}，建议定义为常量`);
            }
        });
    }

    const score = Math.max(0, 100 - uniqueMagicNumbers.size * 15);

    return { score, issues };
}

// 检查错误处理
export function checkErrorHandling(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    
    // 检查是否有 try-catch 块
    const hasTryCatch = code.includes('try') && code.includes('catch');
    
    // 检查是否有错误日志
    const hasErrorLogging = code.includes('console.error') || code.includes('logger.error');
    
    // 检查异步函数是否正确处理错误
    const asyncFunctions = code.match(/async\s+function\s+[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
    const awaitExpressions = code.match(/await\s+[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
    
    let errorHandlingIssues = 0;
    
    if (asyncFunctions.length > 0 && awaitExpressions.length > 0 && !hasTryCatch) {
        errorHandlingIssues++;
        issues.push('异步函数中使用了 await，但未使用 try-catch 处理可能的错误');
    }
    
    if (code.includes('throw') && !hasErrorLogging) {
        errorHandlingIssues++;
        issues.push('代码中抛出了错误，但没有相应的错误日志记录');
    }
    
    // 检查 Promise 是否正确处理错误
    const hasPromise = code.includes('Promise') || code.includes('.then(');
    const hasPromiseCatch = code.includes('.catch(');

    if (hasPromise && !hasPromiseCatch && !hasTryCatch) {
        errorHandlingIssues++;
        issues.push('使用了 Promise，但未处理可能的拒绝（reject）');
    }

    const score = Math.max(0, 100 - errorHandlingIssues * 25);

    return { score, issues };
}

// 检查函数参数数量
export function checkFunctionParameters(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    
    // 匹配函数定义
    const functionRegex = /function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(([^)]*)\)/g;
    const arrowFunctionRegex = /=>\s*\(([^)]*)\)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g;
    
    let match;
    let parameterIssues = 0;
    
    // 检查普通函数
    while ((match = functionRegex.exec(code)) !== null) {
        const params = match[1].split(',').map(p => p.trim()).filter(p => p);
        if (params.length > 5) {
            parameterIssues++;
            const functionName = match[0].split('(')[0].trim().replace('function ', '');
            issues.push(`函数 ${functionName} 参数过多（${params.length}个），建议减少到5个以内`);
        }
    }
    
    // 检查箭头函数
    while ((match = arrowFunctionRegex.exec(code)) !== null) {
        if (match[1]) { // 有括号的箭头函数
            const params = match[1].split(',').map(p => p.trim()).filter(p => p);
            if (params.length > 5) {
                parameterIssues++;
                issues.push(`箭头函数参数过多（${params.length}个），建议减少到5个以内`);
            }
        }
    }
    
    const score = Math.max(0, 100 - parameterIssues * 15);
    
    return { score, issues };
}

// 检测TypeScript中的any类型使用
export function detectAnyTypeUsage(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;
    
    // 使用正则表达式匹配各种any类型的使用场景
    const anyTypeRegex = /\bany\b/g;
    const matches = code.match(anyTypeRegex);
    
    if (matches) {
        const anyCount = matches.length;
        // 每使用一次any类型，降低5分，最低0分
        score = Math.max(0, 100 - anyCount * 5);
        issues.push(`代码中使用了 ${anyCount} 次 any 类型，建议使用更具体的类型定义`);
        
        // 标记具体的any使用位置
        // let match;
        const codeLines = code.split('\n');
        codeLines.forEach((line, lineNum) => {
            if (line.includes('any')) {
                issues.push(`第 ${lineNum + 1} 行使用了any类型`);
            }
        });
    }
    
    return { score, issues };
}

// 检查过长行
export function checkLongLines(code: string): { score: number; issues: string[] } {
    const issues: string[] = [];
    const lines = code.split('\n');
    
    const maxLineLength = 120;
    let longLineCount = 0;
    
    lines.forEach((line, index) => {
        if (line.length > maxLineLength) {
            longLineCount++;
            if (longLineCount <= 5) {
                issues.push(`行 ${index + 1} 过长（${line.length}字符），建议不超过${maxLineLength}字符`);
            }
        }
    });
    
    const score = Math.max(0, 100 - longLineCount * 5);
    
    return { score, issues };
}