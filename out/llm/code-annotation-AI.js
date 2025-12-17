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
        // 尝试从响应中提取评分（1-10分）
        const scoreMatch = aiResponse.match(/总体评分：(\d+)\s*分/);
        const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 5;
        // 提取摘要
        const summaryMatch = aiResponse.match(/摘要：([\s\S]*?)(?=优点|缺点|改进建议|$)/);
        const summary = summaryMatch ? summaryMatch[1].trim() : 'AI评估摘要。';
        // 提取优点
        const strengthsMatch = aiResponse.match(/优点：([\s\S]*?)(?=缺点|改进建议|$)/);
        const strengths = strengthsMatch ?
            strengthsMatch[1].split('\n')
                .map(s => s.replace(/^\d+\./, '').trim())
                .filter(s => s) :
            ['代码结构清晰', '语法正确', '功能实现完整'];
        // 提取缺点
        const weaknessesMatch = aiResponse.match(/缺点：([\s\S]*?)(?=改进建议|$)/);
        const weaknesses = weaknessesMatch ?
            weaknessesMatch[1].split('\n')
                .map(s => s.replace(/^\d+\./, '').trim())
                .filter(s => s) :
            [];
        // 提取改进建议
        const improvementsMatch = aiResponse.match(/改进建议：([\s\S]*?)$/);
        const improvements = improvementsMatch ?
            improvementsMatch[1].split('\n')
                .map(s => s.replace(/^\d+\./, '').trim())
                .filter(s => s) :
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
        // 如果解析失败，返回原始响应
        return {
            overallScore: 5,
            summary: 'AI评估完成',
            strengths: [],
            weaknesses: [],
            improvements: [],
            aiResponse: rawResponse
        };
    }
}
function generateAIReportHTML(assessment) {
    return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI代码质量评估报告</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 20px; }
                h1 { color: #2c3e50; }
                h2 { color: #34495e; margin-top: 20px; }
                .score { font-size: 36px; font-weight: bold; color: #27ae60; margin: 10px 0; }
                .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .section { margin: 20px 0; }
                ul { padding-left: 20px; }
                li { margin: 5px 0; }
                .strengths { color: #27ae60; }
                .weaknesses { color: #e74c3c; }
                .improvements { color: #3498db; }
                .raw-response { background: #f0f0f0; padding: 15px; border-radius: 5px; margin-top: 30px; font-family: monospace; white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <h1>AI代码质量评估报告</h1>
            <div class="score">总体评分：${assessment.overallScore}/10</div>
            
            <div class="section">
                <h2>评估摘要</h2>
                <div class="summary">${assessment.summary}</div>
            </div>
            
            <div class="section">
                <h2>优点</h2>
                <ul class="strengths">
                    ${assessment.strengths.map(strength => `<li>${strength}</li>`).join('')}
                </ul>
            </div>
            
            <div class="section">
                <h2>缺点</h2>
                <ul class="weaknesses">
                    ${assessment.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                </ul>
            </div>
            
            <div class="section">
                <h2>改进建议</h2>
                <ul class="improvements">
                    ${assessment.improvements.map(improvement => `<li>${improvement}</li>`).join('')}
                </ul>
            </div>
            
            <div class="section">
                <h2>AI原始响应</h2>
                <div class="raw-response">${assessment.aiResponse}</div>
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