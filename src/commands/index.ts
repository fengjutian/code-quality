import * as vscode from 'vscode';
import { registerAnalyzeCodeCommand } from './analyzeCode';
import { registerAnalyzeProjectCommand } from './analyzeProject';
import { registerAnalyzeSelectedCodeWithAICommand } from './analyzeSelectedCodeWithAI';
import { registerAnalyzeWithAICommand } from './analyzeWithAI';
import { registerConfigureLLMCommand } from './configureLLM';
import { registerAnalyzeImportsCommand } from './analyzeImports';

export function registerCommands(context: vscode.ExtensionContext, diagnosticCollection: vscode.DiagnosticCollection): void {
    const commands = [
        registerAnalyzeCodeCommand(context, diagnosticCollection),
        registerAnalyzeProjectCommand(context, diagnosticCollection),
        registerAnalyzeSelectedCodeWithAICommand(context),
        registerAnalyzeWithAICommand(context, diagnosticCollection),
        registerConfigureLLMCommand(),
        registerAnalyzeImportsCommand()
    ];

    commands.forEach(command => {
        context.subscriptions.push(command);
    });
}
