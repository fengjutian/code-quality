import * as vscode from 'vscode';

/**
 * 根据代码文本和 ESLint 报告计算各项质量评分
 */
export function calculateQualityScore(diagnostics: vscode.Diagnostic[], codeText: string) {
    const lines = codeText.split('\n').length;

    // eslint评分：基于 diagnostics 数量
    const eslintScore = Math.max(0, 100 - diagnostics.length * 5);

    // 复杂度评分：函数数量 / 行数，越多扣分
    const functionCount = (codeText.match(/\bfunction\b|\b=>\b/g) || []).length;
    const complexityScore = Math.max(0, 100 - functionCount * 2 - Math.floor(lines / 200));

    // 注释评分：注释行占比
    const commentLines = (codeText.match(/^\s*(\/\/|\/\*|\*)/gm) || []).length;
    const commentScore = Math.min(100, Math.floor((commentLines / lines) * 100));

    // 重复代码评分：重复行超过3次扣分
    const linesCountMap: Record<string, number> = {};
    codeText.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        linesCountMap[trimmed] = (linesCountMap[trimmed] || 0) + 1;
    });
    const duplicateCount = Object.values(linesCountMap).filter(v => v > 3).length;
    const duplicateScore = Math.max(0, 100 - duplicateCount * 5);

    // 测试覆盖率评分：暂定固定值，可接实际工具
    const testScore = 80;

    // 总分：各指标平均
    const totalScore = Math.round((eslintScore + complexityScore + commentScore + duplicateScore + testScore) / 5);

    return {
        score: totalScore,
        breakdown: {
            eslintScore,
            complexityScore,
            commentScore,
            duplicateScore,
            testScore
        },
        // Return details for issue reporting
        details: {
            lineCount: lines,
            functionCount,
            commentLines,
            duplicateCount,
            diagnosticsCount: diagnostics.length
        }
    };
}