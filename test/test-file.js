// 这是一个包含多个代码质量问题的测试文件

// 未使用的变量 (no-unused-vars)
let unusedVariable = 10;
var anotherUnused = 'hello';

// 未定义的变量 (no-undef)
console.log(undefinedVariable);

// 缺少分号 (semi)
let missingSemicolon = 20

// 使用双引号而不是单引号 (quotes)
const wrongQuote = "double quotes";

// 空的条件块 (no-empty)
if (true) {
    // empty block
}

// 缺少大括号 (curly)
if (false)
    console.log('missing curly braces');

// 使用 == 而不是 === (eqeqeq)
if (1 == "1") {
    console.log('using == instead of ===');
}

// 控制台输出 (no-console)
console.log('this is a console.log');

function testFunction() {
    // 这个函数没有返回值
    let x = 5;
    let y = 10;
}

// 箭头函数
const arrowFunc = () => {
    return 42;
};

// 重复的代码行
console.log('重复行');
console.log('重复行');
console.log('重复行');
console.log('重复行');
console.log('重复行');

// 没有注释的代码块
let a = 1;
let b = 2;
let c = a + b;
let d = c * 2;
let e = d / 3;
let f = e - 1;
