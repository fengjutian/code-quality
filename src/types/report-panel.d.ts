
export interface Issue {
  message: string;
  line: number; // 从 1 开始
  severity: number; // 1 = warning, 2 = error
  filePath: string; // 文件路径
}

export interface CodeQualityScore {
  score: number;
  breakdown: {
    eslintScore: number;
    complexityScore: number;
    commentScore: number;
    duplicateScore: number;
    testScore: number;
  };
  details?: {
    lineCount: number;
    functionCount: number;
    commentLines: number;
    duplicateBlocks: number;
    diagnosticsCount: number;
  };
}
