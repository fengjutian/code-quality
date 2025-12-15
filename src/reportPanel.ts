import * as vscode from 'vscode';

interface Issue {
  message: string;
  line: number; // 从 1 开始
  severity: number; // 1 = warning, 2 = error
  filePath: string; // 文件路径
}

interface CodeQualityScore {
  score: number;
  breakdown: {
    eslintScore: number;
    complexityScore: number;
    commentScore: number;
    duplicateScore: number;
    testScore: number;
  };
}

export function showQualityReport(
  context: vscode.ExtensionContext,
  qualityScore: CodeQualityScore,
  issues: Issue[]
) {
  const panel = vscode.window.createWebviewPanel(
    'codeQualityReport',
    '代码质量报告',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // 向 Webview 注入 VSCode API 用于消息通信
  const issueItems = issues
    .map(
      (i, idx) => `
      <li class="issue ${i.severity === 2 ? 'error' : 'warning'}" data-index="${idx}">
        <span class="line">Line ${i.line}:</span>
        <span class="message">${i.message}</span>
        <span class="file">${i.filePath}</span>
      </li>
    `
    )
    .join('');

  const { score, breakdown } = qualityScore;

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>代码质量报告</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#1e1e1e; color:#d4d4d4; padding:20px;}
        h1 { font-size:24px; color: ${score >= 80 ? '#4caf50' : score >= 50 ? '#ff9800' : '#f44336'}; }
        .score-bar { width:100%; background:#333; border-radius:6px; overflow:hidden; height:22px; margin-bottom:20px; }
        .score-fill { height:100%; width:${score}%; background: ${score >= 80 ? '#4caf50' : score >= 50 ? '#ff9800' : '#f44336'}; transition: width 0.5s; }
        .breakdown { display:flex; gap:15px; margin-bottom:20px; }
        .breakdown div { background:#2d2d2d; padding:10px 12px; border-radius:6px; flex:1; text-align:center; }
        ul { list-style:none; padding:0; }
        .issue { padding:8px 12px; margin-bottom:8px; border-left:4px solid #ff9800; border-radius:4px; cursor:pointer; transition: transform 0.2s; }
        .issue.error { border-left-color:#f44336; }
        .issue.warning { border-left-color:#ff9800; }
        .issue:hover { transform:scale(1.02); }
        .line { font-weight:bold; margin-right:6px; }
        .message { color:#ffffff; }
        .file { color:#9cdcfe; margin-left:8px; }
      </style>
    </head>
    <body>
      <h1>代码质量评分: ${score}/100</h1>
      <div class="score-bar"><div class="score-fill"></div></div>
      <div class="breakdown">
        <div>ESLint: ${breakdown.eslintScore}</div>
        <div>复杂度: ${breakdown.complexityScore}</div>
        <div>注释: ${breakdown.commentScore}</div>
        <div>重复率: ${breakdown.duplicateScore}</div>
        <div>测试: ${breakdown.testScore}</div>
      </div>
      <h2>代码问题列表</h2>
      <ul id="issue-list">
        ${issueItems}
      </ul>

      <script>
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('.issue').forEach(item => {
          item.addEventListener('click', () => {
            const index = item.getAttribute('data-index');
            vscode.postMessage({ type: 'openIssue', index: Number(index) });
          });
        });
      </script>
    </body>
    </html>
  `;

  // 接收 Webview 消息
  panel.webview.onDidReceiveMessage(
    message => {
      if (message.type === 'openIssue') {
        const issue = issues[message.index];
        const fileUri = vscode.Uri.file(issue.filePath);
        vscode.workspace.openTextDocument(fileUri).then(doc => {
          vscode.window.showTextDocument(doc).then(editor => {
            const pos = new vscode.Position(issue.line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          });
        });
      }
    },
    undefined,
    context.subscriptions
  );
}
