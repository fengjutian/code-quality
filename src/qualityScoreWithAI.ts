// src/qualityScoreWithAI.ts
import { ESLint } from "eslint";
import * as fs from "fs";
import OpenAI from "openai"; // 使用官方 openai SDK

export interface FileAnalysisResult {
  filePath: string;
  eslintScore: number;
  heuristicScore: number;
  testScore: number;
  structurePenalty: number;
  issues: Issue[];
}

export interface Issue {
  message: string;
  line?: number;
  suggestion?: string; // AI 提供优化建议
}

export interface QualityScoreOptions {
  eslintWeight?: number;
  heuristicWeight?: number;
  testWeight?: number;
  structureWeight?: number;
}

export class QualityScorerAI {
  private options: Required<QualityScoreOptions>;
  private openai: OpenAI;

  constructor(openaiApiKey: string, options?: QualityScoreOptions) {
    this.options = {
      eslintWeight: options?.eslintWeight ?? 0.4,
      heuristicWeight: options?.heuristicWeight ?? 0.3,
      testWeight: options?.testWeight ?? 0.2,
      structureWeight: options?.structureWeight ?? 0.1,
    };
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /** 分析单文件 */
  public async analyzeFile(filePath: string): Promise<FileAnalysisResult> {
    const codeText = fs.readFileSync(filePath, "utf-8");

    // 1️⃣ ESLint 分析
    const eslintResult = await this.calculateESLintScore(filePath);

    // 2️⃣ 启发式评分
    const heuristicScore = this.calculateHeuristicScore(codeText);

    // 3️⃣ 测试评分
    const testScore = this.calculateTestScore(filePath);

    // 4️⃣ 结构惩罚
    const structurePenalty = this.calculateStructurePenalty(codeText);

    // 5️⃣ AI 生成建议
    const issuesWithSuggestions = await this.generateAISuggestions(eslintResult.issues, codeText);

    return {
      filePath,
      eslintScore: eslintResult.score,
      heuristicScore,
      testScore,
      structurePenalty,
      issues: issuesWithSuggestions,
    };
  }

  /** 计算总分 */
  public calculateTotalScore(results: FileAnalysisResult[]): number {
    if (results.length === 0) return 100;

    const totalScore = results.reduce((sum, r) => {
      const weighted =
        r.eslintScore * this.options.eslintWeight +
        r.heuristicScore * this.options.heuristicWeight +
        r.testScore * this.options.testWeight -
        r.structurePenalty * this.options.structureWeight;
      return sum + Math.max(0, Math.min(100, weighted));
    }, 0);

    return Math.round(totalScore / results.length);
  }

  /** ESLint 分析 + 提取问题 */
  private async calculateESLintScore(filePath: string): Promise<{ score: number; issues: Issue[] }> {
    const eslint = new ESLint({ fix: false });
    const results = await eslint.lintFiles([filePath]);

    if (!results || results.length === 0) return { score: 100, issues: [] };

    const result = results[0];
    let score = 100 - result.errorCount * 5 - result.warningCount * 1;
    score = Math.max(0, Math.min(100, score));

    const issues: Issue[] = result.messages.map((msg) => ({
      message: msg.message,
      line: msg.line,
    }));

    return { score, issues };
  }

  /** 启发式评分 */
  private calculateHeuristicScore(codeText: string): number {
    const lines = codeText.split(/\r?\n/).length;

    let score = 100;
    if (lines > 1000) score = 50;
    else if (lines > 500) score = 70;

    return score;
  }

  /** 测试分数 */
  private calculateTestScore(filePath: string): number {
    return filePath.includes(".spec") ? 100 : 60;
  }

  /** 结构惩罚 */
  private calculateStructurePenalty(codeText: string): number {
    const nestedDepth = this.getMaxNestingDepth(codeText);

    if (nestedDepth < 3) return 0;
    if (nestedDepth >= 6) return 30;
    return 10 + (nestedDepth - 3) * 5;
  }

  private getMaxNestingDepth(codeText: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    const lines = codeText.split(/\r?\n/);
    for (const line of lines) {
      if (line.match(/\b(if|for|while|switch|try)\b/)) currentDepth++;
      if (line.match(/\}/)) currentDepth--;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
    }

    return maxDepth;
  }

  /** 使用大模型生成优化建议 */
  private async generateAISuggestions(issues: Issue[], codeText: string): Promise<Issue[]> {
    if (issues.length === 0) return [];

    const prompt = `
你是资深前端/TypeScript 工程师，负责给开发者提供代码优化建议。
下面是代码片段：
\`\`\`ts
${codeText}
\`\`\`

以及检测到的问题：
${issues.map((i) => `- Line ${i.line}: ${i.message}`).join("\n")}

请为每个问题提供简洁的改进建议，不要改变原意。
输出格式：
Line: 建议
`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    });

    const suggestionText = response.choices[0].message?.content ?? "";
    // 简单解析 AI 输出
    const lines = suggestionText.split("\n");
    const suggestionsMap: Record<number, string> = {};
    for (const line of lines) {
      const match = line.match(/Line (\d+): (.+)/);
      if (match) {
        suggestionsMap[Number(match[1])] = match[2].trim();
      }
    }

    return issues.map((i) => ({
      ...i,
      suggestion: i.line ? suggestionsMap[i.line] : undefined,
    }));
  }
}

// 使用示例
async function main() {
  const scorer = new QualityScorerAI(process.env.OPENAI_API_KEY || "");
  const files = ["src/index.ts", "src/utils.ts"];
  const results: FileAnalysisResult[] = [];

  for (const f of files) {
    const result = await scorer.analyzeFile(f);
    results.push(result);
    console.log(result);
  }

  const totalScore = scorer.calculateTotalScore(results);
  console.log("整体质量评分:", totalScore);
}

// main();
