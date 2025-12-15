"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showQualityReport = showQualityReport;
const vscode = require("vscode");
function showQualityReport(context, score, issues) {
    const panel = vscode.window.createWebviewPanel('codeQualityReport', '代码质量报告', vscode.ViewColumn.One, {});
    panel.webview.html = `
        <html>
        <body>
            <h1>代码质量评分: ${score}/100</h1>
            <ul>
                ${issues.map(i => `<li>Line ${i.line}: ${i.message}</li>`).join('')}
            </ul>
        </body>
        </html>
    `;
}
//# sourceMappingURL=reportPanel.js.map