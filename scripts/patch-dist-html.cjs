const fs = require('fs');
const path = require('path');

const distHtmlPath = path.join(__dirname, '../dist/index.html');
if (!fs.existsSync(distHtmlPath)) {
    console.error('dist/index.html not found!');
    process.exit(1);
}

let html = fs.readFileSync(distHtmlPath, 'utf8');

// Replace root-absolute paths with relative paths
// 1. src="/..." -> src="./..." (excluding http/https/data:)
html = html.replace(/src="\/(?!\/)/g, 'src="./');

// 2. href="/..." -> href="./..." (excluding http/https/data:)
html = html.replace(/href="\/(?!\/)/g, 'href="./');

// 3. Special icons / manifests
html = html.replace(/content="\/(?!\/)/g, 'content="./');

// Save patched HTML
fs.writeFileSync(distHtmlPath, html, 'utf8');
console.log('✅ Successfully patched dist/index.html with relative paths for standalone offline use!');
