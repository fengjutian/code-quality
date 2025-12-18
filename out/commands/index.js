"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const analyzeCode_1 = require("./analyzeCode");
const analyzeProject_1 = require("./analyzeProject");
const analyzeProjectModules_1 = require("./analyzeProjectModules");
const analyzeSelectedCodeWithAI_1 = require("./analyzeSelectedCodeWithAI");
const analyzeWithAI_1 = require("./analyzeWithAI");
const configureLLM_1 = require("./configureLLM");
const analyzeImports_1 = require("./analyzeImports");
function registerCommands(context, diagnosticCollection) {
    const commands = [
        (0, analyzeCode_1.registerAnalyzeCodeCommand)(context, diagnosticCollection),
        (0, analyzeProject_1.registerAnalyzeProjectCommand)(context, diagnosticCollection),
        (0, analyzeProjectModules_1.registerAnalyzeProjectModulesCommand)(),
        (0, analyzeSelectedCodeWithAI_1.registerAnalyzeSelectedCodeWithAICommand)(context),
        (0, analyzeWithAI_1.registerAnalyzeWithAICommand)(context, diagnosticCollection),
        (0, configureLLM_1.registerConfigureLLMCommand)(),
        (0, analyzeImports_1.registerAnalyzeImportsCommand)()
    ];
    commands.forEach(command => {
        context.subscriptions.push(command);
    });
}
//# sourceMappingURL=index.js.map