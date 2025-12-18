"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIssuesFromQualityScore = generateIssuesFromQualityScore;
exports.analyzeFileAndGenerateIssues = analyzeFileAndGenerateIssues;
const qualityScore_1 = require("../utils/qualityScore");
const quailty_check_1 = require("../utils/quailty-check");
/**
 * 根据 qualityScore 生成所有 issues
 */
function generateIssuesFromQualityScore(qualityScore, codeText, filePath) {
    const { lineCount, functionCount, commentLines } = qualityScore.details;
    const testScore = qualityScore.breakdown.testScore;
    return [
        ...(0, quailty_check_1.checkLineCount)(lineCount, filePath),
        ...(0, quailty_check_1.checkFunctionCount)(functionCount, codeText, filePath),
        ...(0, quailty_check_1.checkCommentRatio)(commentLines, lineCount, filePath),
        ...(0, quailty_check_1.checkDuplicateBlocks)(codeText, filePath),
        ...(0, quailty_check_1.checkTestScore)(testScore, filePath),
        ...(0, quailty_check_1.checkWhitespaceIssues)(codeText, filePath),
        ...(0, quailty_check_1.checkNamingConvention)(codeText, filePath)
    ];
}
/**
 * 文件分析 pipeline：ESLint + qualityScore
 */
function analyzeFileAndGenerateIssues(codeText, diagnostics, filePath) {
    const eslintIssues = diagnostics.map(d => ({
        message: d.message,
        line: d.range.start.line + 1,
        severity: d.severity === 1 ? 2 : 1, // 转换为自定义严重级别
        filePath
    }));
    const qualityScore = (0, qualityScore_1.calculateQualityScore)(diagnostics, codeText);
    const otherIssues = generateIssuesFromQualityScore(qualityScore, codeText, filePath);
    return { allIssues: [...eslintIssues, ...otherIssues], qualityScore };
}
//# sourceMappingURL=codeAnalysis.js.map