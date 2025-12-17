"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIReportHTML = generateAIReportHTML;
function generateAIReportHTML(assessment) {
    // 根据分数获取对应的颜色
    const getScoreColor = (score) => {
        if (score >= 9)
            return '#27ae60'; // 优秀
        if (score >= 7)
            return '#2ecc71'; // 良好
        if (score >= 5)
            return '#f39c12'; // 中等
        if (score >= 3)
            return '#e67e22'; // 较差
        return '#e74c3c'; // 很差
    };
    // 根据分数获取对应的描述
    const getScoreDescription = (score) => {
        if (score >= 9)
            return '优秀';
        if (score >= 7)
            return '良好';
        if (score >= 5)
            return '中等';
        if (score >= 3)
            return '较差';
        return '很差';
    };
    return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI代码质量评估报告</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background-color: #f5f7fa;
                    color: #333;
                    line-height: 1.6;
                    padding: 20px;
                }
                
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }
                
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }
                
                .header h1 {
                    font-size: 28px;
                    margin-bottom: 10px;
                    font-weight: 600;
                }
                
                .score-section {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    margin-top: 20px;
                }
                
                .score {
                    font-size: 48px;
                    font-weight: bold;
                    ${assessment.overallScore > 0 ? `color: ${getScoreColor(assessment.overallScore)};` : 'color: #27ae60;'}
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                .score-description {
                    font-size: 20px;
                    font-weight: 500;
                    background-color: rgba(255, 255, 255, 0.2);
                    padding: 5px 15px;
                    border-radius: 20px;
                    ${assessment.overallScore > 0 ? `border: 2px solid ${getScoreColor(assessment.overallScore)};` : 'border: 2px solid #27ae60;'}
                }
                
                .content {
                    padding: 30px;
                }
                
                .section {
                    margin-bottom: 30px;
                    background-color: #f9f9f9;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                }
                
                .section h2 {
                    color: #2c3e50;
                    margin-bottom: 15px;
                    font-size: 20px;
                    font-weight: 600;
                }
                
                .summary {
                    font-size: 16px;
                    line-height: 1.8;
                    color: #555;
                    background-color: white;
                    padding: 15px;
                    border-radius: 5px;
                    border: 1px solid #e0e0e0;
                }
                
                .list-container {
                    background-color: white;
                    border-radius: 5px;
                    overflow: hidden;
                }
                
                ul {
                    list-style: none;
                    padding: 0;
                }
                
                li {
                    padding: 12px 15px;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background-color 0.2s ease;
                }
                
                li:last-child {
                    border-bottom: none;
                }
                
                li:hover {
                    background-color: #f8f9fa;
                }
                
                .strengths li::before {
                    content: '✓';
                    color: #27ae60;
                    font-weight: bold;
                    margin-right: 10px;
                }
                
                .weaknesses li::before {
                    content: '✗';
                    color: #e74c3c;
                    font-weight: bold;
                    margin-right: 10px;
                }
                
                .improvements li::before {
                    content: '→';
                    color: #3498db;
                    font-weight: bold;
                    margin-right: 10px;
                }
                
                .raw-response {
                    background-color: #f0f0f0;
                    padding: 20px;
                    border-radius: 5px;
                    margin-top: 30px;
                    font-family: 'Courier New', Courier, monospace;
                    white-space: pre-wrap;
                    font-size: 14px;
                    line-height: 1.5;
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #e0e0e0;
                }
                
                .raw-response h3 {
                    color: #34495e;
                    margin-bottom: 15px;
                    font-size: 16px;
                }
                
                /* 响应式设计 */
                @media (max-width: 768px) {
                    body {
                        padding: 10px;
                    }
                    
                    .header {
                        padding: 20px;
                    }
                    
                    .header h1 {
                        font-size: 24px;
                    }
                    
                    .score {
                        font-size: 36px;
                    }
                    
                    .score-description {
                        font-size: 16px;
                    }
                    
                    .content {
                        padding: 20px;
                    }
                    
                    .section {
                        padding: 15px;
                    }
                }
                
                /* 动画效果 */
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .section {
                    animation: fadeIn 0.5s ease forwards;
                }
                
                .section:nth-child(2) { animation-delay: 0.1s; }
                .section:nth-child(3) { animation-delay: 0.2s; }
                .section:nth-child(4) { animation-delay: 0.3s; }
                .section:nth-child(5) { animation-delay: 0.4s; }
                .section:nth-child(6) { animation-delay: 0.5s; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>AI代码质量评估报告</h1>
                    <div class="score-section">
                        <div class="score">${assessment.overallScore}/10</div>
                        <div class="score-description">${getScoreDescription(assessment.overallScore)}</div>
                    </div>
                </div>
                
                <div class="content">
                    <div class="section">
                        <h2>评估摘要</h2>
                        <div class="summary">${assessment.summary || 'AI已完成代码质量评估'}</div>
                    </div>
                    
                    <div class="section">
                        <h2>优点</h2>
                        <div class="list-container">
                            <ul class="strengths">
                                ${assessment.strengths.length > 0 ?
        assessment.strengths.map(strength => `<li>${strength}</li>`).join('') :
        '<li>代码质量良好，未发现明显缺点</li>'}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>缺点</h2>
                        <div class="list-container">
                            <ul class="weaknesses">
                                ${assessment.weaknesses.length > 0 ?
        assessment.weaknesses.map(weakness => `<li>${weakness}</li>`).join('') :
        '<li>未发现明显缺点</li>'}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>改进建议</h2>
                        <div class="list-container">
                            <ul class="improvements">
                                ${assessment.improvements.length > 0 ?
        assessment.improvements.map(improvement => `<li>${improvement}</li>`).join('') :
        '<li>无需特殊改进建议</li>'}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>AI原始响应</h2>
                        <div class="raw-response">
                            ${assessment.aiResponse}
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}
//# sourceMappingURL=ai-template.js.map