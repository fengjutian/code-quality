# VSCode Code Quality Analyzer

A Visual Studio Code extension that analyzes code quality and provides detailed reports on potential issues and improvements.

## Features

- Real-time code quality analysis
- ESLint integration for JavaScript and TypeScript
- Detailed quality scoring system
- Visual reporting of issues
- Project-wide analysis capability

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open the project in VSCode
4. Press `F5` to launch the extension in a new Extension Development Host window

## Usage

### Commands

- `TT Analyze Code Quality (当前文件)` - Analyze the currently open file
- `TT Analyze Code Quality (整个项目)` - Analyze the entire project

### Quality Metrics

The extension evaluates code quality based on several factors:

1. **ESLint Issues** - Traditional linting errors and warnings
2. **Complexity** - Based on function count and file size
3. **Comments** - Ratio of commented lines to total lines
4. **Duplication** - Detection of repeated code patterns
5. **Test Coverage** - (Currently simulated, customizable)

## Configuration

The extension uses ESLint with a predefined set of rules for JavaScript and TypeScript files. You can customize these rules by modifying the configuration in `analyzer.ts`.

## Development

### Building

```bash
npm run compile
```

### Packaging

```bash
npm run vscode:prepublish
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT