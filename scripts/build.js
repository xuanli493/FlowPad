/**
 * FlowPad 前端构建脚本
 * 将 frontend/ 下的多文件 SPA 合并为单个 HTML → data/www/index.html
 * 用法: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BASE = path.join(__dirname, '..', 'frontend');
const OUT  = path.join(__dirname, '..', 'data', 'www', 'index.html');
const OUT_GZ = path.join(__dirname, '..', 'data', 'www', 'index.html.gz');

// 读取文件
let html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

// 内联 CSS: <link rel="stylesheet" href="xxx"> → <style>...</style>
html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>/gi, (match, href) => {
    const filePath = path.join(BASE, href);
    if (fs.existsSync(filePath)) {
        const css = fs.readFileSync(filePath, 'utf-8');
        return '<style>\n' + compressCSS(css) + '\n</style>';
    }
    console.warn('[WARN] CSS not found:', href);
    return match;
});

// 内联 JS: <script src="xxx"></script> → <script>...</script>
html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/gi, (match, href) => {
    const filePath = path.join(BASE, href);
    if (fs.existsSync(filePath)) {
        const js = fs.readFileSync(filePath, 'utf-8');
        return '<script>\n' + compressJS(js) + '\n</script>';
    }
    console.warn('[WARN] JS not found:', href);
    return match;
});

// 压缩 CSS: 移除注释和多余空白
function compressCSS(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')   // 移除注释
        .replace(/\s+/g, ' ')                // 合并空白
        .replace(/\s*([{}:;,>+~])\s*/g, '$1') // 移除选择器周围的空白
        .replace(/;}/g, '}')                 // 移除最后一个分号
        .trim();
}

// 压缩 JS: 移除注释和多余空白
function compressJS(js) {
    return js
        .replace(/\/\*[\s\S]*?\*\//g, '')   // 移除块注释
        .replace(/\/\/.*$/gm, '')            // 移除行注释
        .replace(/^\s+/gm, '')               // 移除行首空白
        .replace(/\n\s*\n/g, '\n')           // 移除空行
        .trim();
}

// 移除 HTML 注释
html = html.replace(/<!--[\s\S]*?-->/g, '');

// 写入输出
fs.writeFileSync(OUT, html, 'utf-8');

// gzip 压缩
const gzipped = zlib.gzipSync(html, { level: 9 });
fs.writeFileSync(OUT_GZ, gzipped);

const origSize = getDirSize(BASE);
const outSize = Buffer.byteLength(html, 'utf-8');
const gzipSize = gzipped.length;

console.log('========================================');
console.log('  FlowPad Frontend Build');
console.log('========================================');
console.log(`  Source:   frontend/  (${fmtSize(origSize)})`);
console.log(`  Output:   index.html  (${fmtSize(outSize)})`);
console.log(`  Gzipped:  index.html.gz  (${fmtSize(gzipSize)} · ${(gzipSize / outSize * 100).toFixed(1)}%)`);
console.log('========================================');

function getDirSize(dir) {
    let total = 0;
    const files = fs.readdirSync(dir, { recursive: true });
    for (const f of files) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isFile()) total += fs.statSync(fp).size;
    }
    return total;
}

function fmtSize(bytes) {
    return bytes < 1024 ? bytes + ' B'
         : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB'
         : (bytes / 1048576).toFixed(1) + ' MB';
}
