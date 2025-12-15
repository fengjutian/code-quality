// Sample file with various issues to test line number reporting
function firstFunction() {
  console.log("This is the first function");
}

function secondFunction() {
  console.log("This is the second function");
}

function thirdFunction() {
  console.log("This is the third function");
}

function fourthFunction() {
  console.log("This is the fourth function");
}

function fifthFunction() {
  console.log("This is the fifth function");
}

function sixthFunction() {
  console.log("This is the sixth function");
}

function seventhFunction() {
  console.log("This is the seventh function");
}

function eighthFunction() {
  console.log("This is the eighth function");
}

function ninthFunction() {
  console.log("This is the ninth function");
}

function tenthFunction() {
  console.log("This is the tenth function");
}

function eleventhFunction() {
  console.log("This is the eleventh function - should trigger function count warning");
}

// Duplicate code to trigger duplication warning
console.log("This is a duplicate line");
console.log("This is a duplicate line");
console.log("This is a duplicate line");
console.log("This is a duplicate line");
console.log("This is a duplicate line");

// More duplicate code
console.log("This is another duplicate line");
console.log("This is another duplicate line");
console.log("This is another duplicate line");
console.log("This is another duplicate line");
console.log("This is another duplicate line");