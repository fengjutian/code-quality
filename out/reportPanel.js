"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showQualityReport = showQualityReport;
const vscode = require("vscode");
function showQualityReport(context, qualityScore, issues) {
    console.log('Showing report with issues:', issues); // Debug log
    const panel = vscode.window.createWebviewPanel('codeQualityReport', '代码质量报告', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    // 向 Webview 注入 VSCode API 用于消息通信
    const issueItems = issues
        .map((i, idx) => {
        // Determine issue type based on message content
        const isEslintIssue = !i.message.includes('文件行数过多') &&
            !i.message.includes('函数数量过多') &&
            !i.message.includes('注释比例过低') &&
            !i.message.includes('检测到重复代码') &&
            !i.message.includes('测试覆盖率不足');
        const isAnyTypeIssue = i.message.includes('any类型');
        const issueType = isAnyTypeIssue ? 'Any类型' : (isEslintIssue ? 'ESLint' : '代码质量');
        const issueClass = isAnyTypeIssue ? 'any-issue' : (isEslintIssue ? 'eslint-issue' : 'quality-issue');
        return `
        <li class="issue ${i.severity === 2 ? 'error' : 'warning'} ${isAnyTypeIssue ? 'any-type' : ''}" data-index="${idx}">
          <span class="line">Line ${i.line}:</span>
          <span class="message">${i.message}</span>
          <span class="issue-type ${issueClass}">${issueType}</span>
          <span class="file">${i.filePath.split('/').pop()?.split('\\').pop()}</span>
        </li>
      `;
    })
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
        .issue { padding:12px 15px; margin-bottom:10px; border-left:4px solid #ff9800; border-radius:4px; cursor:pointer; transition: transform 0.2s; background:#2d2d2d; }
        .issue.error { border-left-color:#f44336; background:#3a2d2d; }
        .issue.warning { border-left-color:#ff9800; background:#3a352d; }
        .issue:hover { transform:scale(1.02); }
        .line { font-weight:bold; margin-right:10px; color:#9cdcfe; }
        .message { color:#ffffff; display:block; margin:5px 0; }
        .file { color:#9cdcfe; font-size:0.9em; }
        h2 { margin-top: 30px; border-bottom: 1px solid #444; padding-bottom: 10px; }
        .issue-type { font-size: 0.8em; padding: 2px 6px; border-radius: 3px; margin-left: 10px; }
        .eslint-issue { background: #81c784; color: #000; }
        .quality-issue { background: #4fc3f7; color: #000; }
        /* Any类型问题特殊样式 */
        .any-type { border-left-color:#ff00ff; background:#402d40; }
        .any-issue { background: #ff00ff; color: #000; }
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
      <h2>代码问题列表 (${issues.length} 个问题)</h2>
      <ul id="issue-list">
        ${issueItems || '<li>No issues found</li>'}
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
    panel.webview.onDidReceiveMessage(message => {
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
    }, undefined, context.subscriptions);
}
//# sourceMappingURL=reportPanel.js.map