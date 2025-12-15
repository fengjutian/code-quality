const { analyzeDirectory } = require('./out/analyzer');

// 测试整个项目分析功能
async function testProjectAnalysis() {
    try {
        console.log('开始分析项目...');
        const results = await analyzeDirectory('.');
        
        console.log(`\n分析完成，共处理了 ${results.length} 个文件`);
        
        let totalIssues = 0;
        results.forEach(result => {
            const issueCount = result.diagnostics.length;
            totalIssues += issueCount;
            if (issueCount > 0) {
                console.log(`\n${result.filePath}:`);
                console.log(`  发现 ${issueCount} 个问题`);
                result.diagnostics.slice(0, 3).forEach((diag, index) => {
                    console.log(`    ${index + 1}. [${diag.severity === 0 ? '信息' : diag.severity === 1 ? '警告' : '错误'}] ${diag.message}`);
                });
                if (issueCount > 3) {
                    console.log(`    ... 还有 ${issueCount - 3} 个问题`);
                }
            }
        });
        
        console.log(`\n总计发现 ${totalIssues} 个问题`);
        console.log('项目分析测试完成！');
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testProjectAnalysis();
