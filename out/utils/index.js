"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllFiles = getAllFiles;
const fs = require("fs");
const path = require("path");
function getAllFiles(dir, fileList = []) {
    const excludeFiles = ['node_modules', '.git', 'out', 'dist', '.vite'];
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (excludeFiles.includes(file)) {
                return;
            }
            if (!excludeFiles.includes(file)) {
                getAllFiles(fullPath, fileList);
            }
        }
        else if (/(\.js|\.ts|\.jsx|\.tsx|\.vue|\.py|\.go|\.cpp)$/.test(file)) {
            fileList.push(fullPath);
        }
    });
    return fileList;
}
//# sourceMappingURL=index.js.map