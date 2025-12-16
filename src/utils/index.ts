import * as fs from 'fs';
import * as path from 'path';

export function getAllFiles(dir: string, fileList: string[] = []): string[] {
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
        } else if (/(\.js|\.ts|\.jsx|\.tsx|\.vue|\.py|\.go|\.cpp)$/.test(file)) {
            fileList.push(fullPath);
        }
    });
    return fileList;
}