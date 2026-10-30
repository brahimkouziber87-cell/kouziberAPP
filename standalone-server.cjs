const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = path.join(__dirname);
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.cjs': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.pdf': 'application/pdf',
    '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // API route mock / fallback
    if (pathname === '/api/analyze-class' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ 
                result: '<div style="padding:15px; background:#f0fdf4; border:1px solid #86efac; border-radius:8px;"><h4 style="color:#15803d; margin:0 0 8px 0;">تحليل تربوي آلي</h4><p style="margin:0; font-size:0.85rem; color:#334155;">تم تحليل بيانات القسم بنجاح. أداء المجموعة مستقر ومعظم التلاميذ يحققون نتائج إيجابية في فروض المراقبة المستمرة.</p></div>' 
            }));
        });
        return;
    }

    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    // Try finding the file in dist first, then in public, then in root
    let filePath = path.join(DIST_DIR, pathname);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(BASE_DIR, 'public', pathname);
    }
    if (!fs.existsSync(filePath)) {
        filePath = path.join(BASE_DIR, pathname);
    }

    // If still not found and pathname looks like an SPA route, fallback to dist/index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
        if (!fs.existsSync(filePath)) {
            filePath = path.join(BASE_DIR, 'index.html');
        }
    }

    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('500 Internal Server Error: ' + err.message);
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`✅ منظومة التدبير التربوي لمادة الرياضيات تعمل الآن على: http://localhost:${PORT}`);
    console.log(`خادم محلي فائق السرعة بدون أي حزم خارجية (Zero Dependencies)!`);
});
