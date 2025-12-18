import { createLLMService } from './llm';
import * as vscode from 'vscode';
import { generateAIReportHTML, type CodeQualityAssessment} from '../view-template/ai-template'

export interface AIAnnotationOptions {
    code: string;
    language: string;
    issues?: any[];
    filePath?: string;
    lineCount?: number;
    userPrompt?: string;
}

export async function assessCodeQuality(options: AIAnnotationOptions): Promise<CodeQualityAssessment> {
    const { code, language, issues = [], filePath, lineCount, userPrompt } = options;
    
    try {
        // 创建LLM服务实例
        const llmService = await createLLMService();
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
          let userPromptContent = `文件路径：${filePath || '未知'}
          代码行数：${lineCount || code.split('\n').length}

          代码内容：
          ${code}

          已发现的问题：
          ${issues.length > 0 ? 
              issues.map((issue, index) => `${index + 1}. ${issue.message} (第${issue.line}行)`).join('\n') : 
              '未发现明显问题'
          }`;
          
          // 如果有用户输入的附加信息，添加到提示中
          if (userPrompt) {
              userPromptContent += `

          用户附加信息：
          ${userPrompt}`;
          }
          
          userPromptContent += `

          请按照要求评估这段代码的质量：`;
        
        // 调用LLM生成评估
        const messages: import('./llm').LLMMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPromptContent }
        ];
        
        const response = await llmService.generateResponse(messages);
        
        // 解析AI响应
        return parseAIResponse(response.content, response.content);
        
    } catch (error) {
        console.error('AI代码质量评估失败:', error);
        throw error instanceof Error ? error : new Error('AI评估失败');
    }
}

export async function generateCodeImprovements(code: string, language: string, specificIssue?: string): Promise<string> {
    try {
        const llmService = await createLLMService();
        if (!llmService) {
            throw new Error('无法创建AI服务实例');
        }
        
        const systemPrompt = `你是一名专业的${language}代码优化专家，请提供具体的代码改进建议。`;
        const userPrompt = specificIssue ? 
            `请针对以下${language}代码中关于"${specificIssue}"的问题提供改进建议：\n${code}` :
            `请提供以下${language}代码的优化建议：\n${code}`;
        
        const messages: import('./llm').LLMMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        const response = await llmService.generateResponse(messages);
        return response.content;
        
    } catch (error) {
        console.error('AI代码改进建议生成失败:', error);
        throw error instanceof Error ? error : new Error('AI改进建议生成失败');
    }
}

function parseAIResponse(aiResponse: string, rawResponse: string): CodeQualityAssessment {
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
                .map(s => s.replace(/^(?:\d+\.|-|\*|•)\s*/, '').trim())
                .filter(s => s.length > 5) // 过滤掉太短的无效条目
                .slice(0, 5) : // 最多保留5个优点
            ['代码结构清晰', '语法正确', '功能实现完整'];
        
        // 提取缺点
        const weaknessesPattern = /(?:缺点|劣势)：([\s\S]*?)(?=改进建议|优化建议|$)/i;
        const weaknessesMatch = normalizedResponse.match(weaknessesPattern);
        const weaknesses = weaknessesMatch ? 
            weaknessesMatch[1].split('\n')
                .map(s => s.replace(/^(?:\d+\.|-|\*|•)\s*/, '').trim())
                .filter(s => s.length > 5)
                .slice(0, 5) :
            [];
        
        // 提取改进建议
        const improvementsPattern = /(?:改进建议|优化建议)：([\s\S]*?)$/i;
        const improvementsMatch = normalizedResponse.match(improvementsPattern);
        const improvements = improvementsMatch ? 
            improvementsMatch[1].split('\n')
                .map(s => s.replace(/^(?:\d+\.|-|\*|•)\s*/, '').trim())
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
    } catch (error) {
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

export async function createAIQualityAssessmentCommand() {
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
                const panel = vscode.window.createWebviewPanel(
                    'codeQualityAIReport',
                    'AI代码质量评估报告',
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );
                
                panel.webview.html = generateAIReportHTML(assessment);
                
                return assessment;
            });
            
        } catch (error) {
            vscode.window.showErrorMessage(`AI评估失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });
}
