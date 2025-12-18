import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeFileImports, ModuleInfo } from '../utils/analyzeImports';

/**
 * 模块依赖关系接口
 */
interface ModuleDependency {
    from: string; // 依赖模块
    to: string;   // 被依赖模块
}

/**
 * 递归遍历目录，分析所有文件的导入和依赖关系
 */
function analyzeProjectModules(rootPath: string): { modules: ModuleInfo[], dependencies: ModuleDependency[] } {
    const modules: ModuleInfo[] = [];
    const dependencies: ModuleDependency[] = [];
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
                            
                            // 提取文件的相对路径作为模块标识
                            const fileRelativePath = path.relative(rootPath, filePath);
                            
                            // 记录依赖关系
                            fileModules.forEach(module => {
                                dependencies.push({
                                    from: fileRelativePath,
                                    to: module.name
                                });
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('遍历目录时出错:', error);
        }
    }
    
    traverseDirectory(rootPath);
    return { modules, dependencies };
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
            
            // 分析项目模块和依赖关系
            const { modules: allModules, dependencies } = analyzeProjectModules(rootPath);
            
            // 去重模块
            const uniqueModules = new Map<string, ModuleInfo>();
            allModules.forEach(module => {
                if (!uniqueModules.has(module.name)) {
                    uniqueModules.set(module.name, module);
                }
            });
            
            const modulesArray = Array.from(uniqueModules.values());
            
            // 去重依赖关系
            const uniqueDependencies = new Set<string>();
            const filteredDependencies = dependencies.filter(dep => {
                const key = `${dep.from}->${dep.to}`;
                if (uniqueDependencies.has(key)) {
                    return false;
                }
                uniqueDependencies.add(key);
                return true;
            });
            
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
            
            // 准备vis-network数据
            const nodes = [];
            const edges = [];
            const nodeIds = new Map<string, number>();
            let nodeIdCounter = 0;
            
            // 添加所有模块作为节点
            modulesArray.forEach(module => {
                nodeIds.set(module.name, nodeIdCounter);
                nodes.push({
                    id: nodeIdCounter,
                    label: module.name,
                    color: module.type === 'builtin' ? '#4ec9b0' : 
                          module.type === 'third-party' ? '#c586c0' : '#9cdcfe',
                    shape: module.type === 'builtin' ? 'box' : 
                          module.type === 'third-party' ? 'triangle' : 'circle'
                });
                nodeIdCounter++;
            });
            
            // 添加所有依赖关系作为边
            filteredDependencies.forEach(dep => {
                const fromId = nodeIds.get(dep.from);
                const toId = nodeIds.get(dep.to);
                if (fromId !== undefined && toId !== undefined) {
                    edges.push({
                        from: fromId,
                        to: toId,
                        arrows: 'to',
                        color: '#888',
                        width: 1
                    });
                }
            });
            
            // 生成HTML内容
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>项目模块可视化</title>
                    <!-- 引入vis-network库 -->
                    <script src="https://unpkg.com/vis-network@9.1.6/dist/vis-network.min.js"></script>
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
                        #network {
                            height: 600px;
                            border: 1px solid #444;
                            border-radius: 4px;
                            background: #1e1e1e;
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
                        <div class="stat-item">
                            <span>依赖关系数</span>
                            <span class="stat-value">${filteredDependencies.length}</span>
                        </div>
                    </div>
                    
                    <div class="visualization-container">
                        <div id="network"></div>
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
                        
                        // 初始化vis-network
                        const nodes = ${JSON.stringify(nodes)};
                        const edges = ${JSON.stringify(edges)};
                        
                        const container = document.getElementById('network');
                        const data = {
                            nodes: nodes,
                            edges: edges
                        };
                        
                        const options = {
                            layout: {
                                hierarchical: {
                                    enabled: false,
                                    direction: 'LR',
                                    sortMethod: 'hubsize'
                                },
                                randomSeed: 42
                            },
                            interaction: {
                                dragNodes: true,
                                zoomView: true,
                                panView: true
                            },
                            nodes: {
                                font: {
                                    size: 12,
                                    color: '#fff'
                                },
                                shadow: true
                            },
                            edges: {
                                font: {
                                    size: 8,
                                    color: '#888'
                                },
                                smooth: {
                                    enabled: true,
                                    type: 'cubicBezier'
                                }
                            }
                        };
                        
                        // 创建网络图表
                        const network = new vis.Network(container, data, options);
                        
                        // 监听节点点击事件
                        network.on('click', function(params) {
                            if (params.nodes.length > 0) {
                                const nodeId = params.nodes[0];
                                vscode.postMessage({
                                    type: 'openModule',
                                    moduleId: nodeId
                                });
                            }
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
