"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessCodeQuality = assessCodeQuality;
exports.generateCodeImprovements = generateCodeImprovements;
exports.generateAIReportHTML = generateAIReportHTML;
exports.createAIQualityAssessmentCommand = createAIQualityAssessmentCommand;
const llm_1 = require("./llm");
const vscode = require("vscode");
async function assessCodeQuality(options) {
    const { code, language, issues = [], filePath, lineCount } = options;
    try {
        // 创建LLM服务实例
        const llmService = await (0, llm_1.createLLMService)();
        if (!llmService) {
            throw new Error('无法创建AI服务实例');
        }
        // 构建系统提示
        const systemPrompt = `你是一名专业的代码质量评估专家，请分析以下${language}代码的质量。

          评估要求：
          1. 首先给出总体评分（1-10分）
          2. 提供简要的整体评估摘要
          3. 列出代码的主要优点（3-5点）
          4. 列出代码的主要缺点（3-5点）
          5. 提供具体的改进建议（3-5点）

          请使用结构化的中文输出，保持专业、客观，并提供具体的改进建议。`;
        // 构建用户提示
        const userPrompt = `文件路径：${filePath || '未知'}
          代码行数：${lineCount || code.split('\n').length}

          代码内容：
          ${code}

          已发现的问题：
          ${issues.length > 0 ?
            issues.map((issue, index) => `${index + 1}. ${issue.message} (第${issue.line}行)`).join('\n') :
            '未发现明显问题'}

          请按照要求评估这段代码的质量：`;
        // 调用LLM生成评估
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        const response = await llmService.generateResponse(messages);
        // 解析AI响应
        return parseAIResponse(response.content, response.content);
    }
    catch (error) {
        console.error('AI代码质量评估失败:', error);
        throw error instanceof Error ? error : new Error('AI评估失败');
    }
}
async function generateCodeImprovements(code, language, specificIssue) {
    try {
        const llmService = await (0, llm_1.createLLMService)();
        if (!llmService) {
            throw new Error('无法创建AI服务实例');
        }
        const systemPrompt = `你是一名专业的${language}代码优化专家，请提供具体的代码改进建议。`;
        const userPrompt = specificIssue ?
            `请针对以下${language}代码中关于"${specificIssue}"的问题提供改进建议：\n${code}` :
            `请提供以下${language}代码的优化建议：\n${code}`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        const response = await llmService.generateResponse(messages);
        return response.content;
    }
    catch (error) {
        console.error('AI代码改进建议生成失败:', error);
        throw error instanceof Error ? error : new Error('AI改进建议生成失败');
    }
}
function parseAIResponse(aiResponse, rawResponse) {
    // 默认解析，如果AI响应格式不标准则使用默认值
    try {
        // 标准化响应格式（处理不同AI模型的输出差异）
        let normalizedResponse = aiResponse.trim();
        // 尝试从响应中提取评分（支持多种格式：1-10分、10分制、评分：X等）
        const scoreMatch = normalizedResponse.match(/(?:总体)?评分(?:：|\s*)(\d+)(?:\s*分|\s*分制)?/i);
        const overallScore = scoreMatch ? Math.max(1, Math.min(10, parseInt(scoreMatch[1], 10))) : 5;
        // 提取摘要
        const summaryPatterns = [
            /(?:摘要|总体评估|整体评价)：([\s\S]*?)(?=优点|缺点|改进建议|$)/i,
            /^([\s\S]*?)(?=优点|缺点|改进建议|$)/i
        ];
        let summary = 'AI评估摘要。';
        for (const pattern of summaryPatterns) {
            const match = normalizedResponse.match(pattern);
            if (match) {
                summary = match[1].trim();
                break;
            }
        }
        // 提取优点
        const strengthsPattern = /(?:优点|优势)：([\s\S]*?)(?=缺点|劣势|改进建议|$)/i;
        const strengthsMatch = normalizedResponse.match(strengthsPattern);
        const strengths = strengthsMatch ?
            strengthsMatch[1].split('\n')
                .map(s => s.replace(/^(?:\d+\.|-|\*|\•)\s*/, '').trim())
                .filter(s => s.length > 5) // 过滤掉太短的无效条目
                .slice(0, 5) : // 最多保留5个优点
            ['代码结构清晰', '语法正确', '功能实现完整'];
        // 提取缺点
        const weaknessesPattern = /(?:缺点|劣势)：([\s\S]*?)(?=改进建议|优化建议|$)/i;
        const weaknessesMatch = normalizedResponse.match(weaknessesPattern);
        const weaknesses = weaknessesMatch ?
            weaknessesMatch[1].split('\n')
                .map(s => s.replace(/^(?:\d+\.|-|\*|\•)\s*/, '').trim())
                .filter(s => s.length > 5)
                .slice(0, 5) :
            [];
        // 提取改进建议
        const improvementsPattern = /(?:改进建议|优化建议)：([\s\S]*?)$/i;
        const improvementsMatch = normalizedResponse.match(improvementsPattern);
        const improvements = improvementsMatch ?
            improvementsMatch[1].split('\n')
                .map(s => s.replace(/^(?:\d+\.|-|\*|\•)\s*/, '').trim())
                .filter(s => s.length > 5)
                .slice(0, 5) :
            [];
        return {
            overallScore,
            summary,
            strengths,
            weaknesses,
            improvements,
            aiResponse: rawResponse
        };
    }
    catch (error) {
        console.error('AI响应解析失败:', error);
        // 如果解析失败，尝试从原始响应中提取有用信息
        return {
            overallScore: 5,
            summary: 'AI评估完成',
            strengths: rawResponse.includes('优点') ? ['已识别到优点'] : [],
            weaknesses: rawResponse.includes('缺点') ? ['已识别到改进空间'] : [],
            improvements: rawResponse.includes('改进') ? ['AI已提供改进建议'] : [],
            aiResponse: rawResponse
        };
    }
}
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
async function createAIQualityAssessmentCommand() {
    return vscode.commands.registerCommand('codeQualityAnalyzer.assessWithAI', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }
        const document = editor.document;
        const code = document.getText();
        const language = document.languageId;
        const filePath = document.uri.fsPath;
        try {
            const progress = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AI代码质量评估',
                cancellable: true
            }, async (progress, token) => {
                progress.report({ message: '正在分析代码...', increment: 0 });
                // 这里可以先运行代码质量分析获取现有问题
                // const qualityScore = calculateQualityScore([], code);
                progress.report({ message: '正在生成AI评估...', increment: 50 });
                progress.report({ message: 'AI评估可能需要1-2分钟...', increment: 30 });
                const assessment = await assessCodeQuality({
                    code,
                    language,
                    filePath,
                    lineCount: document.lineCount
                });
                progress.report({ message: '评估完成', increment: 100 });
                // 显示评估结果
                const panel = vscode.window.createWebviewPanel('codeQualityAIReport', 'AI代码质量评估报告', vscode.ViewColumn.Beside, { enableScripts: true });
                panel.webview.html = generateAIReportHTML(assessment);
                return assessment;
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`AI评估失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });
}
//# sourceMappingURL=code-annotation-AI.js.map