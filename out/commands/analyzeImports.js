"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyzeImportsCommand = registerAnalyzeImportsCommand;
const vscode = require("vscode");
const analyzeImports_1 = require("../utils/analyzeImports");
function registerAnalyzeImportsCommand() {
    const disposable = vscode.commands.registerCommand('extension.showImports', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('没有打开任何文件');
            return;
        }
        const filePath = editor.document.uri.fsPath;
        const imports = (0, analyzeImports_1.analyzeFileImports)(filePath);
        // 创建Webview面板
        const panel = vscode.window.createWebviewPanel('importsVisualization', '导入依赖可视化', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        // 统计各类导入数量
        const stats = {
            thirdParty: imports.filter(m => m.type === 'third-party').length,
            local: imports.filter(m => m.type === 'local').length,
            builtin: imports.filter(m => m.type === 'builtin').length
        };
        // 准备可视化数据
        const moduleData = imports.map((module, index) => ({
            ...module,
            id: index
        }));
        // 生成HTML内容
        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>导入依赖可视化</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: #1e1e1e;
                        color: #d4d4d4;
                        margin: 0;
                        padding: 20px;
                    }
                    h1 {
                        font-size: 24px;
                        margin-bottom: 20px;
                        color: #9cdcfe;
                    }
                    .container {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .stats-card {
                        background: #2d2d2d;
                        border-radius: 8px;
                        padding: 20px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    }
                    .stats-title {
                        font-size: 18px;
                        margin-bottom: 15px;
                        color: #ce9178;
                    }
                    .stat-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                        padding: 8px 0;
                        border-bottom: 1px solid #444;
                    }
                    .stat-item:last-child {
                        border-bottom: none;
                    }
                    .stat-value {
                        font-weight: bold;
                        font-size: 20px;
                    }
                    .builtin { color: #4ec9b0; }
                    .third-party { color: #c586c0; }
                    .local { color: #9cdcfe; }
                    
                    .visualization-container {
                        grid-column: 1 / -1;
                        background: #2d2d2d;
                        border-radius: 8px;
                        padding: 20px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    }
                    canvas {
                        border: 1px solid #444;
                        background: #1e1e1e;
                        border-radius: 4px;
                        display: block;
                        margin: 0 auto;
                    }
                    
                    .modules-list {
                        grid-column: 1 / -1;
                        background: #2d2d2d;
                        border-radius: 8px;
                        padding: 20px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    }
                    .modules-title {
                        font-size: 18px;
                        margin-bottom: 15px;
                        color: #ce9178;
                    }
                    .module-item {
                        display: flex;
                        align-items: center;
                        padding: 10px;
                        margin-bottom: 5px;
                        border-radius: 4px;
                        background: #333;
                    }
                    .module-item:hover {
                        background: #3a3a3a;
                    }
                    .module-type {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        margin-right: 10px;
                    }
                    .module-name {
                        flex: 1;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .module-type-badge {
                        font-size: 12px;
                        padding: 2px 6px;
                        border-radius: 3px;
                        background: #444;
                    }
                </style>
            </head>
            <body>
                <h1>导入依赖可视化</h1>
                
                <div class="container">
                    <div class="stats-card">
                        <div class="stats-title">导入统计</div>
                        <div class="stat-item">
                            <span>内置模块</span>
                            <span class="stat-value builtin">${stats.builtin}</span>
                        </div>
                        <div class="stat-item">
                            <span>第三方模块</span>
                            <span class="stat-value third-party">${stats.thirdParty}</span>
                        </div>
                        <div class="stat-item">
                            <span>本地模块</span>
                            <span class="stat-value local">${stats.local}</span>
                        </div>
                        <div class="stat-item">
                            <span>总模块数</span>
                            <span class="stat-value">${imports.length}</span>
                        </div>
                    </div>
                    
                    <div class="stats-card">
                        <div class="stats-title">导入类型占比</div>
                        <canvas id="pieChart" width="300" height="300"></canvas>
                    </div>
                </div>
                
                <div class="modules-list">
                    <div class="modules-title">模块列表</div>
                    <div id="modulesContainer">
                        ${moduleData.map(module => `
                            <div class="module-item">
                                <div class="module-type" style="background-color: 
                                    ${module.type === 'builtin' ? '#4ec9b0' :
            module.type === 'third-party' ? '#c586c0' : '#9cdcfe'}"></div>
                                <div class="module-name">${module.name}</div>
                                <div class="module-type-badge">${module.type}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <script>
                    // 绘制饼图
                    const canvas = document.getElementById('pieChart');
                    const ctx = canvas.getContext('2d');
                    
                    const data = [
                        { value: ${stats.builtin}, color: '#4ec9b0', label: '内置模块' },
                        { value: ${stats.thirdParty}, color: '#c586c0', label: '第三方模块' },
                        { value: ${stats.local}, color: '#9cdcfe', label: '本地模块' }
                    ];
                    
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const radius = Math.min(centerX, centerY) - 20;
                    
                    let startAngle = 0;
                    const total = data.reduce((sum, item) => sum + item.value, 0);
                    
                    data.forEach(item => {
                        const sliceAngle = (item.value / total) * 2 * Math.PI;
                        
                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                        ctx.closePath();
                        
                        ctx.fillStyle = item.color;
                        ctx.fill();
                        
                        // 添加标签
                        const labelAngle = startAngle + sliceAngle / 2;
                        const labelRadius = radius + 15;
                        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
                        const labelY = centerY + Math.sin(labelAngle) * labelRadius;
                        
                        ctx.fillStyle = '#d4d4d4';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(item.label, labelX, labelY);
                        
                        startAngle += sliceAngle;
                    });
                    
                    // 添加中心圆
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
                    ctx.fillStyle = '#1e1e1e';
                    ctx.fill();
                    
                    // 添加总数
                    ctx.fillStyle = '#d4d4d4';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('${imports.length}', centerX, centerY - 10);
                    ctx.font = '12px Arial';
                    ctx.fillText('总模块', centerX, centerY + 10);
                </script>
            </body>
            </html>
        `;
    });
    return disposable;
}
//# sourceMappingURL=analyzeImports.js.map