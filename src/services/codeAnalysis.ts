import { calculateQualityScore } from '../utils/qualityScore';
import {
    checkLineCount,
    checkFunctionCount,
    checkCommentRatio,
    checkDuplicateBlocks,
    checkTestScore,
    checkWhitespaceIssues,
    checkNamingConvention
} from '../utils/quailty-check';

/**
 * 根据 qualityScore 生成所有 issues
 */
export function generateIssuesFromQualityScore(
    qualityScore: ReturnType<typeof calculateQualityScore>,
    codeText: string,
    filePath: string
) {
    const { lineCount, functionCount, commentLines } = qualityScore.details;
    const testScore = qualityScore.breakdown.testScore;

    return [
        ...checkLineCount(lineCount, filePath),
        ...checkFunctionCount(functionCount, codeText, filePath),
        ...checkCommentRatio(commentLines, lineCount, filePath),
        ...checkDuplicateBlocks(codeText, filePath),
        ...checkTestScore(testScore, filePath),
        ...checkWhitespaceIssues(codeText, filePath),
        ...checkNamingConvention(codeText, filePath)
    ];
}

/**
 * 文件分析 pipeline：ESLint + qualityScore
 */
export function analyzeFileAndGenerateIssues(
    codeText: string,
    diagnostics: any[],
    filePath: string
) {
    const eslintIssues = diagnostics.map(d => ({
        message: d.message,
        line: d.range.start.line + 1,
        severity: d.severity === 1 ? 2 : 1, // 转换为自定义严重级别
        filePath
    }));

    const qualityScore = calculateQualityScore(diagnostics, codeText);
    const otherIssues = generateIssuesFromQualityScore(qualityScore, codeText, filePath);

    return { allIssues: [...eslintIssues, ...otherIssues], qualityScore };
}
