import * as vscode from 'vscode';

const clamp = (v: number, min = 0, max = 100) =>
    Math.max(min, Math.min(max, v));

export function calculateQualityScore(
    diagnostics: vscode.Diagnostic[],
    codeText: string
) {
    const lines = codeText.split('\n');
    const lineCount = Math.max(lines.length, 1);

    /* ================= ESLint 评分 ================= */
    let eslintPenalty = 0;

    for (const d of diagnostics) {
        switch (d.severity) {
            case vscode.DiagnosticSeverity.Error:
                eslintPenalty += 5;
                break;
            case vscode.DiagnosticSeverity.Warning:
                eslintPenalty += 2;
                break;
            default:
                eslintPenalty += 1;
        }
    }

    // 密度化 + 上限
    const eslintScore = clamp(
        100 - Math.min(40, (eslintPenalty / lineCount) * 100)
    );

    /* ================= 复杂度评分 ================= */
    const functionCount =
        (codeText.match(/\bfunction\b|\b=>\b/g) || []).length;

    const ifCount = (codeText.match(/\bif\b|\bswitch\b|\bfor\b|\bwhile\b/g) || []).length;

    const complexityIndex = (functionCount + ifCount * 1.5) / lineCount;

    const complexityScore = clamp(
        100 - complexityIndex * 800
    );

    /* ================= 注释评分 ================= */
    const commentLines =
        (codeText.match(/^\s*(\/\/|\/\*|\*)/gm) || []).length;

    const commentRatio = commentLines / lineCount;

    // 合理区间：5% ~ 25%
    let commentScore = 100;
    if (commentRatio < 0.05) commentScore = 70;
    else if (commentRatio > 0.3) commentScore = 60;

    /* ================= 重复代码评分 ================= */
    const lineCountMap: Record<string, number> = {};

    lines.forEach(line => {
        const t = line.trim();
        if (t.length < 15) return; // 过滤无意义短行
        lineCountMap[t] = (lineCountMap[t] || 0) + 1;
    });

    const duplicateBlocks = Object.values(lineCountMap).filter(v => v >= 4).length;
    const duplicateScore = clamp(100 - duplicateBlocks * 5);

    /* ================= 测试评分 ================= */
    const testScore = 80; // 可接 Jest / Coverage

    /* ================= 总分 ================= */
    const totalScore = Math.round(
        eslintScore * 0.4 +
        complexityScore * 0.25 +
        commentScore * 0.15 +
        duplicateScore * 0.1 +
        testScore * 0.1
    );

    return {
        score: totalScore,
        breakdown: {
            eslintScore,
            complexityScore,
            commentScore,
            duplicateScore,
            testScore
        },
        details: {
            lineCount,
            functionCount,
            commentLines,
            duplicateBlocks,
            diagnosticsCount: diagnostics.length
        }
    };
}
