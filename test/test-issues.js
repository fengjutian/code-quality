// Test file with intentional issues to verify issue display
var unusedVar = "This variable is not used";
console.log("Using double quotes instead of single");
if(true) console.log("Missing curly braces");
if(1 == "1") console.log("Using == instead of ===");
// Missing semicolon