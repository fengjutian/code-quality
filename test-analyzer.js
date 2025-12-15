const { analyzeCode } = require('./out/analyzer');

// 测试代码 - 包含一些故意的代码问题
const testCode = `var unusedVariable = '这是一个未使用的变量'
console.log("使用了双引号而不是单引号")
if(true) console.log("缺少大括号")
if(1 == "1") console.log("使用了 == 而不是 ===")
`;

async function test() {
    try {
        const diagnostics = await analyzeCode(testCode, 'javascript');
        console.log('检测到的问题数量:', diagnostics.length);
        console.log('问题详情:', diagnostics);
    } catch (error) {
        console.error('测试失败:', error);
    }
}

test();
