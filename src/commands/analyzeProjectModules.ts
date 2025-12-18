import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeFileImports, ModuleInfo } from '../utils/analyzeImports';

/**
 * 递归遍历目录，分析所有文件的导入
 */
function analyzeProjectModules(rootPath: string): ModuleInfo[] {
    const modules: ModuleInfo[] = [];
    const visitedFiles = new Set<string>();
    
    // 忽略的目录和文件
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', 'out'];
    const ignoredExts = ['.json', '.md', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    
    function traverseDirectory(dir: string) {
        try {
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    // 忽略指定目录
                    if (!ignoredDirs.includes(file)) {
                        traverseDirectory(filePath);
                    }
                } else if (stat.isFile()) {
                    // 只分析代码文件
                    const ext = path.extname(file);
                    if ([ '.ts', '.tsx', '.js', '.jsx' ].includes(ext) && !ignoredExts.includes(ext)) {
                        if (!visitedFiles.has(filePath)) {
                            visitedFiles.add(filePath);
                            const fileModules = analyzeFileImports(filePath);
                            modules.push(...fileModules);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('遍历目录时出错:', error);
        }
    }
    
    traverseDirectory(rootPath);
    return modules;
}

/**
 * 注册整个项目模块分析命令
 */
export function registerAnalyzeProjectModulesCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('extension.analyzeProjectModules', () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('没有打开任何工作区');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '分析整个项目的模块组件',
            cancellable: false
        }, (progress) => {
            progress.report({ increment: 0, message: '开始扫描项目文件...' });
            
            // 分析项目模块
            const allModules = analyzeProjectModules(rootPath);
            
            // 去重模块
            const uniqueModules = new Map<string, ModuleInfo>();
            allModules.forEach(module => {
                if (!uniqueModules.has(module.name)) {
                    uniqueModules.set(module.name, module);
                }
            });
            
            const modulesArray = Array.from(uniqueModules.values());
            
            progress.report({ increment: 100, message: '分析完成，生成可视化报告...' });
            
            // 创建Webview面板
            const panel = vscode.window.createWebviewPanel(
                'projectModulesVisualization',
                '项目模块可视化',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            
            // 统计各类模块数量
            const stats = {
                thirdParty: modulesArray.filter(m => m.type === 'third-party').length,
                local: modulesArray.filter(m => m.type === 'local').length,
                builtin: modulesArray.filter(m => m.type === 'builtin').length
            };
            
            // 准备可视化数据
            const moduleData = modulesArray.map((module, index) => ({
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
                    <title>项目模块可视化</title>
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
                            max-height: 500px;
                            overflow-y: auto;
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
                            cursor: pointer;
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
                    <h1>项目模块可视化</h1>
                    <div class="stats-card">
                        <div class="stats-title">项目模块统计</div>
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
                            <span class="stat-value">${modulesArray.length}</span>
                        </div>
                    </div>
                    
                    <div class="modules-list">
                        <div class="modules-title">模块列表</div>
                        <div id="modulesContainer">
                            ${moduleData.map(module => `
                                <div class="module-item" data-module-id="${module.id}">
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
                        // 处理模块点击事件
                        const vscode = acquireVsCodeApi();
                        
                        document.querySelectorAll('.module-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const moduleId = parseInt(item.getAttribute('data-module-id') || '0');
                                vscode.postMessage({
                                    type: 'openModule',
                                    moduleId: moduleId
                                });
                            });
                        });
                    </script>
                </body>
                </html>
            `;
            
            // 添加消息处理
            panel.webview.onDidReceiveMessage(
                message => {
                    if (message.type === 'openModule') {
                        const module = moduleData[message.moduleId];
                        if (module && module.type === 'third-party') {
                            // 第三方模块：查找node_modules中的文件
                            const modulePath = path.join(rootPath, 'node_modules', module.name);
                            
                            // 简单的路径处理，实际项目中可能需要更复杂的逻辑
                            if (!path.extname(modulePath)) {
                                const possibleExts = ['.ts', '.tsx', '.js', '.jsx'];
                                let foundPath = '';
                                
                                // 尝试直接添加扩展名
                                for (const ext of possibleExts) {
                                    const testPath = `${modulePath}${ext}`;
                                    if (fs.existsSync(testPath)) {
                                        foundPath = testPath;
                                        break;
                                    }
                                }
                                
                                // 如果是目录，查找index文件
                                if (!foundPath) {
                                    for (const ext of possibleExts) {
                                        const indexPath = path.join(modulePath, `index${ext}`);
                                        if (fs.existsSync(indexPath)) {
                                            foundPath = indexPath;
                                            break;
                                        }
                                    }
                                }
                                
                                if (foundPath) {
                                    vscode.workspace.openTextDocument(vscode.Uri.file(foundPath))
                                        .then(doc => vscode.window.showTextDocument(doc));
                                } else {
                                    vscode.window.showErrorMessage(`无法找到模块文件: ${module.name}`);
                                }
                            } else if (fs.existsSync(modulePath)) {
                                vscode.workspace.openTextDocument(vscode.Uri.file(modulePath))
                                    .then(doc => vscode.window.showTextDocument(doc));
                            } else {
                                vscode.window.showErrorMessage(`无法找到模块文件: ${module.name}`);
                            }
                        }
                    }
                },
                undefined,
                []
            );
            
            return Promise.resolve();
        });
    });
}
