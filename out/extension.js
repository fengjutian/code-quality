"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const analyzer_1 = require("./analyzer");
const reportPanel_1 = require("./reportPanel");
const qualityScore_1 = require("./utils/qualityScore");
const qualityScoreWithAI_1 = require("./qualityScoreWithAI");
const code_annotation_AI_1 = require("./llm/code-annotation-AI");
const ai_template_1 = require("./view-template/ai-template");
const config_1 = require("./llm/config");
const quailty_check_1 = require("./utils/quailty-check");
class AISelectedCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        // 检查是否有选中的代码
        if (range.isEmpty) {
            console.log('CodeOracle: 没有选中代码，不提供AI分析选项');
            return;
        }
        console.log('CodeOracle: 检测到选中的代码，提供AI分析选项');
        const action = new vscode.CodeAction('CodeOracle: 分析选中代码 (AI)', vscode.CodeActionKind.Refactor);
        action.command = {
            command: 'extension.analyzeSelectedCodeWithAI',
            title: '分析选中代码',
            arguments: [document, range]
        };
        return [action];
    }
}
/**
 * 根据 qualityScore 生成所有 issues
 */
function generateIssuesFromQualityScore(qualityScore, codeText, filePath) {
    const { lineCount, functionCount, commentLines } = qualityScore.details;
    const testScore = qualityScore.breakdown.testScore;
    return [
        ...(0, quailty_check_1.checkLineCount)(lineCount, filePath),
        ...(0, quailty_check_1.checkFunctionCount)(functionCount, codeText, filePath),
        ...(0, quailty_check_1.checkCommentRatio)(commentLines, lineCount, filePath),
        ...(0, quailty_check_1.checkDuplicateBlocks)(codeText, filePath),
        ...(0, quailty_check_1.checkTestScore)(testScore, filePath),
        ...(0, quailty_check_1.checkWhitespaceIssues)(codeText, filePath),
        ...(0, quailty_check_1.checkNamingConvention)(codeText, filePath)
    ];
}
/**
 * 文件分析 pipeline：ESLint + qualityScore
 */
function analyzeFileAndGenerateIssues(codeText, diagnostics, filePath) {
    const eslintIssues = diagnostics.map(d => ({
        message: d.message,
        line: d.range.start.line + 1,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 2 : 1,
        filePath
    }));
    const qualityScore = (0, qualityScore_1.calculateQualityScore)(diagnostics, codeText);
    const otherIssues = generateIssuesFromQualityScore(qualityScore, codeText, filePath);
    return { allIssues: [...eslintIssues, ...otherIssues], qualityScore };
}
/**
 * ======== VS Code 插件激活 ========
 */
async function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, new AISelectedCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }));
    // 通用错误处理
    function handleError(err, collection) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        vscode.window.showErrorMessage(`Analyze Code Quality 出错: ${errorMessage}`);
        console.error(err);
        const outputChannel = vscode.window.createOutputChannel("Code Quality Analysis");
        outputChannel.appendLine(`Analysis failed: ${errorMessage}`);
        outputChannel.show();
        const errorDiagnostic = new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `代码分析失败: ${errorMessage}`, vscode.DiagnosticSeverity.Error);
        collection.clear();
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            collection.set(editor.document.uri, [errorDiagnostic]);
        }
    }
    // 文件保存时自动分析
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        try {
            const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(document.getText(), document.languageId, cwd, document.fileName);
            diagnosticCollection.set(document.uri, diagnostics);
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
    // 手动分析当前文件
    const disposable = vscode.commands.registerCommand('extension.analyzeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage('没有打开任何文件');
        const filePath = editor.document.uri.fsPath;
        try {
            // 使用传统分析方法（不依赖AI）
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(editor.document.getText(), editor.document.languageId, cwd, editor.document.fileName);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            const { allIssues, qualityScore } = analyzeFileAndGenerateIssues(editor.document.getText(), diagnostics, editor.document.fileName);
            (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
            vscode.window.showInformationMessage('代码分析完成！');
            // 可选：使用AI增强分析（如果配置了API密钥）
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (openaiApiKey) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在使用AI进行深度代码分析...',
                    cancellable: false,
                }, async () => {
                    try {
                        const scorer = new qualityScoreWithAI_1.QualityScorerAI(openaiApiKey);
                        const aiResult = await scorer.analyzeFile(filePath);
                        // 将AI分析结果与现有结果结合
                        const aiEnhancedIssues = [...allIssues];
                        aiResult.issues.forEach(issue => {
                            if (issue.line && issue.suggestion) {
                                aiEnhancedIssues.push({
                                    message: `${issue.message} (AI建议: ${issue.suggestion})`,
                                    line: issue.line,
                                    severity: 1, // warning
                                    filePath: filePath
                                });
                            }
                        });
                        // 重新显示报告，包含AI建议
                        (0, reportPanel_1.showQualityReport)(context, qualityScore, aiEnhancedIssues);
                        vscode.window.showInformationMessage('AI增强分析完成！');
                    }
                    catch (aiErr) {
                        const errorMessage = aiErr instanceof Error ? aiErr.message : 'AI分析失败';
                        vscode.window.showWarningMessage(`AI分析失败: ${errorMessage}`);
                        console.error('AI分析失败:', aiErr);
                    }
                });
            }
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
    // 分析整个项目
    const projectDisposable = vscode.commands.registerCommand('extension.analyzeProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0)
            return vscode.window.showErrorMessage('没有打开任何工作区');
        const rootPath = workspaceFolders[0].uri.fsPath;
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '分析整个项目的代码质量',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: '开始分析...' });
                const results = await (0, analyzer_1.analyzeDirectory)(rootPath);
                progress.report({ increment: 50, message: '分析完成，生成报告...' });
                diagnosticCollection.clear();
                let allIssues = [];
                for (const result of results) {
                    diagnosticCollection.set(vscode.Uri.file(result.filePath), result.diagnostics);
                    const { allIssues: fileIssues } = analyzeFileAndGenerateIssues(result.codeText, result.diagnostics, result.filePath);
                    allIssues.push(...fileIssues);
                }
                // Calculate average scores across all files using the new weighted system
                if (results.length > 0) {
                    let totalWeightedScore = 0;
                    let totalEslintScore = 0;
                    let totalComplexityScore = 0;
                    let totalCommentScore = 0;
                    let totalDuplicateScore = 0;
                    let totalTestScore = 0;
                    results.forEach(result => {
                        const score = (0, qualityScore_1.calculateQualityScore)(result.diagnostics, result.codeText);
                        totalWeightedScore += score.score;
                        totalEslintScore += score.breakdown.eslintScore;
                        totalComplexityScore += score.breakdown.complexityScore;
                        totalCommentScore += score.breakdown.commentScore;
                        totalDuplicateScore += score.breakdown.duplicateScore;
                        totalTestScore += score.breakdown.testScore;
                    });
                    const avgWeightedScore = Math.round(totalWeightedScore / results.length);
                    const avgEslintScore = Math.round(totalEslintScore / results.length);
                    const avgComplexityScore = Math.round(totalComplexityScore / results.length);
                    const avgCommentScore = Math.round(totalCommentScore / results.length);
                    const avgDuplicateScore = Math.round(totalDuplicateScore / results.length);
                    const avgTestScore = Math.round(totalTestScore / results.length);
                    const qualityScore = {
                        score: avgWeightedScore,
                        breakdown: {
                            eslintScore: avgEslintScore,
                            complexityScore: avgComplexityScore,
                            commentScore: avgCommentScore,
                            duplicateScore: avgDuplicateScore,
                            testScore: avgTestScore
                        }
                    };
                    progress.report({ increment: 100, message: '报告生成完成' });
                    (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                    vscode.window.showInformationMessage(`项目分析完成！共分析了 ${results.length} 个文件，发现 ${allIssues.length} 个问题。`);
                }
                else {
                    // Handle empty project case
                    const qualityScore = {
                        score: 100,
                        breakdown: {
                            eslintScore: 100,
                            complexityScore: 100,
                            commentScore: 100,
                            duplicateScore: 100,
                            testScore: 80 // Default test score
                        }
                    };
                    progress.report({ increment: 100, message: '报告生成完成' });
                    (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                    vscode.window.showInformationMessage('项目分析完成！未找到可分析的文件。');
                }
            });
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
    // 注册AI质量评估命令
    const aiAssessmentDisposable = await (0, code_annotation_AI_1.createAIQualityAssessmentCommand)();
    context.subscriptions.push(aiAssessmentDisposable);
    // 在analyzeCode命令中集成AI质量评估功能
    const analyzeWithAIDisposable = vscode.commands.registerCommand('extension.analyzeWithAI', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage('没有打开任何文件');
        const filePath = editor.document.uri.fsPath;
        const code = editor.document.getText();
        const language = editor.document.languageId;
        try {
            // 先运行传统分析获取基础问题
            const cwd = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            const diagnostics = await (0, analyzer_1.analyzeCode)(code, language, cwd, filePath);
            diagnosticCollection.set(editor.document.uri, diagnostics);
            const { allIssues, qualityScore } = analyzeFileAndGenerateIssues(code, diagnostics, filePath);
            // 检查AI配置是否启用
            const llmConfig = (0, config_1.getLLMConfig)();
            if (llmConfig.enabled) {
                // 运行AI质量评估
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在使用AI评估代码质量...',
                    cancellable: true
                }, async (progress) => {
                    progress.report({ message: '正在生成AI评估...', increment: 0 });
                    try {
                        progress.report({ message: 'AI评估可能需要1-2分钟...', increment: 30 });
                        const aiAssessment = await (0, code_annotation_AI_1.assessCodeQuality)({
                            code,
                            language,
                            issues: allIssues,
                            filePath,
                            lineCount: editor.document.lineCount
                        });
                        progress.report({ message: 'AI评估完成', increment: 100 });
                        // 显示AI评估报告
                        const panel = vscode.window.createWebviewPanel('codeQualityAIReport', 'AI代码质量评估报告', vscode.ViewColumn.Beside, { enableScripts: true });
                        panel.webview.html = (0, ai_template_1.generateAIReportHTML)(aiAssessment);
                        vscode.window.showInformationMessage('AI代码质量评估完成！');
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`AI评估失败: ${error instanceof Error ? error.message : '未知错误'}`);
                        // 继续显示传统报告
                        (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                    }
                });
            }
            else {
                // AI功能未启用，仅显示传统报告
                (0, reportPanel_1.showQualityReport)(context, qualityScore, allIssues);
                vscode.window.showInformationMessage('代码分析完成！(AI功能未启用)');
            }
        }
        catch (err) {
            handleError(err, diagnosticCollection);
        }
    });
    // 注册命令，处理用户输入 + 调用 LLM
    const analyzeSelectedCodeWithAIDisposable = vscode.commands.registerCommand('extension.analyzeSelectedCodeWithAI', async (document, range) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage('没有打开任何文件');
        // 处理直接调用命令的情况（没有参数传递）
        let selectedCode;
        let language;
        let filePath;
        if (document && range) {
            selectedCode = document.getText(range);
            language = document.languageId;
            filePath = document.uri.fsPath;
        }
        else {
            // 直接调用命令，使用当前编辑器的选中内容
            selectedCode = editor.document.getText(editor.selection);
            language = editor.document.languageId;
            filePath = editor.document.uri.fsPath;
        }
        if (!selectedCode)
            return vscode.window.showErrorMessage('没有选中任何代码');
        // 1️⃣ 弹出输入框，让用户输入想让 AI 分析的内容
        const userPrompt = await vscode.window.showInputBox({
            prompt: '请输入你希望AI分析的额外信息或问题（可选）',
            placeHolder: '例如：请检查性能问题、潜在BUG或优化建议'
        });
        if (userPrompt === undefined)
            return; // 用户取消
        // 2️⃣ 检查 LLM 配置
        const llmConfig = (0, config_1.getLLMConfig)();
        if (!llmConfig.enabled) {
            return vscode.window.showInformationMessage('AI功能未启用，请在设置中启用后重试！');
        }
        try {
            // 3️⃣ 调用大模型分析
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在使用AI分析选中代码...',
                cancellable: true
            }, async (progress) => {
                progress.report({ message: '发送代码到AI分析...', increment: 20 });
                const aiResult = await (0, code_annotation_AI_1.assessCodeQuality)({
                    code: selectedCode,
                    language,
                    filePath,
                    lineCount: range.end.line - range.start.line + 1,
                    userPrompt // 用户输入附加信息
                });
                progress.report({ message: 'AI分析完成，生成报告...', increment: 100 });
                // 4️⃣ 显示 Webview 报告
                const panel = vscode.window.createWebviewPanel('codeQualityAIReport', 'AI选中代码分析报告', vscode.ViewColumn.Beside, { enableScripts: true });
                panel.webview.html = (0, ai_template_1.generateAIReportHTML)(aiResult);
                vscode.window.showInformationMessage('AI选中代码分析完成！');
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'AI分析失败';
            vscode.window.showErrorMessage(msg);
        }
    });
    // 注册配置命令
    const configureLLMDisposable = vscode.commands.registerCommand('extension.configureLLM', () => {
        // 打开设置页面并定位到我们的扩展配置
        vscode.commands.executeCommand('workbench.action.openSettings', 'codeQualityAnalyzer.llm');
    });
    context.subscriptions.push(disposable, projectDisposable, analyzeWithAIDisposable, analyzeSelectedCodeWithAIDisposable, configureLLMDisposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map