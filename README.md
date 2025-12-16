# VSCode 代码质量分析器

一个 Visual Studio Code 扩展，用于分析代码质量并提供关于潜在问题和改进建议的详细报告。

## 功能特性

- 实时代码质量分析
- 集成 ESLint 用于 JavaScript 和 TypeScript 代码检查
- 详细的质量评分系统
- 可视化问题报告
- 项目范围的分析能力

## 安装方法

1. 克隆此仓库
2. 运行 `npm install` 安装依赖
3. 在 VSCode 中打开项目
4. 按 `F5` 在新的扩展开发主机窗口中启动扩展

## 使用说明

### 命令

- `TT Analyze Code Quality (当前文件)` - 分析当前打开的文件
- `TT Analyze Code Quality (整个项目)` - 分析整个项目

### 质量指标

扩展基于以下几个因素评估代码质量：

1. **ESLint 问题** - 传统的代码检查错误和警告
2. **复杂度** - 基于函数数量和文件大小
3. **注释** - 注释行占总行数的比例
4. **重复代码** - 检测重复的代码模式
5. **测试覆盖率** - (当前为模拟数据，可自定义)

## 配置

扩展使用 ESLint 并为 JavaScript 和 TypeScript 文件预定义了一组规则。您可以通过修改 `analyzer.ts` 中的配置来自定义这些规则。

## 开发

### 构建

```bash
npm run compile
```

### 打包

```bash
npm run vscode:prepublish
```

## 贡献

1. Fork 本仓库
2. 创建功能分支
3. 提交您的更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT
