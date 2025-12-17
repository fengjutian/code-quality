"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLineCount = checkLineCount;
exports.checkFunctionCount = checkFunctionCount;
exports.checkCommentRatio = checkCommentRatio;
exports.checkDuplicateBlocks = checkDuplicateBlocks;
exports.checkTestScore = checkTestScore;
exports.checkWhitespaceIssues = checkWhitespaceIssues;
exports.checkNamingConvention = checkNamingConvention;
function checkLineCount(lineCount, filePath) {
    if (lineCount <= 200)
        return [];
    return [{
            message: `文件行数过多 (${lineCount} 行)，建议拆分为多个小文件`,
            line: lineCount,
            severity: 1,
            filePath
        }];
}
function checkFunctionCount(functionCount, codeText, filePath) {
    if (functionCount <= 10)
        return [];
    const codeLines = codeText.split('\n');
    const firstFunctionLine = codeLines.findIndex(line => line.includes('function') || line.includes('=>')) + 1 || 1;
    return [{
            message: `函数数量过多 (${functionCount} 个)，建议重构代码`,
            line: firstFunctionLine,
            severity: 1,
            filePath
        }];
}
function checkCommentRatio(commentLines, lineCount, filePath) {
    const ratio = commentLines / lineCount;
    // Based on new scoring: reasonable range is 5% ~ 25%
    if (ratio >= 0.05 && ratio <= 0.25)
        return [];
    if (ratio < 0.05) {
        return [{
                message: `注释比例过低 (${(ratio * 100).toFixed(1)}%)，建议增加注释`,
                line: 1,
                severity: 1,
                filePath
            }];
    }
    else {
        return [{
                message: `注释比例过高 (${(ratio * 100).toFixed(1)}%)，建议减少不必要的注释`,
                line: 1,
                severity: 1,
                filePath
            }];
    }
}
function checkDuplicateBlocks(codeText, filePath) {
    const issues = [];
    const lines = codeText.split('\n');
    const lineCountMap = {};
    // Build map of lines to their line numbers
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        // Filter out short and comment lines
        if (trimmedLine.length < 15 || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
            return;
        }
        if (!lineCountMap[trimmedLine]) {
            lineCountMap[trimmedLine] = [];
        }
        lineCountMap[trimmedLine].push(index + 1);
    });
    // Check for duplicates (4 or more occurrences)
    Object.entries(lineCountMap).forEach(([lineContent, lineNumbers]) => {
        if (lineNumbers.length >= 4) {
            // Report each occurrence after the third
            for (let i = 3; i < lineNumbers.length; i++) {
                issues.push({
                    message: `检测到重复代码: "${lineContent.substring(0, 30)}${lineContent.length > 30 ? '...' : ''}"`,
                    line: lineNumbers[i],
                    severity: 1,
                    filePath
                });
            }
        }
    });
    return issues;
}
function checkTestScore(testScore, filePath) {
    if (testScore >= 70)
        return [];
    return [{
            message: `测试覆盖率不足 (${testScore}%)，建议增加测试`,
            line: 1,
            severity: 1,
            filePath
        }];
}
function checkWhitespaceIssues(codeText, filePath) {
    const issues = [];
    const lines = codeText.split(/\r?\n/);
    lines.forEach((line, idx) => {
        if (/\s+$/.test(line)) {
            issues.push({
                message: '行尾存在多余空格',
                line: idx + 1,
                severity: 1,
                filePath
            });
        }
    });
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '' && lines[i - 1].trim() === '') {
            issues.push({
                message: '存在连续空行',
                line: i + 1,
                severity: 1,
                filePath
            });
        }
    }
    return issues;
}
function checkNamingConvention(codeText, filePath) {
    const issues = [];
    const varRegex = /\b(const|let|var|function)\s+([a-zA-Z_]\w*)/g;
    let match;
    while ((match = varRegex.exec(codeText)) !== null) {
        const name = match[2];
        if (name.length === 1) {
            const line = codeText.substr(0, match.index).split('\n').length;
            issues.push({
                message: `变量或函数名 "${name}" 太短，建议使用描述性名称`,
                line,
                severity: 1,
                filePath
            });
        }
    }
    return issues;
}
//# sourceMappingURL=quailty-check.js.map