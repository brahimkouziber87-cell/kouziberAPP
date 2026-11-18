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

const PUBLIC_DIR = path.join(__dirname, 'public');

function safeResolveStaticPath(rootDir, reqPath) {
    const cleanRel = String(reqPath || '').replace(/^\/+/, '');
    const resolved = path.resolve(rootDir, cleanRel);
    const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
    if (resolved !== rootDir && !resolved.startsWith(rootWithSep)) {
        return null;
    }
    return resolved;
}

const server = http.createServer((req, res) => {
    // Security & CORS headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url || '/', true);
    let pathname = '/';
    try {
        pathname = decodeURIComponent(parsedUrl.pathname || '/');
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('400 Bad Request');
        return;
    }

    // API route mock / fallback with 5MB body cap
    if (pathname === '/api/analyze-class' && req.method === 'POST') {
        let body = '';
        let aborted = false;
        req.on('data', chunk => {
            if (aborted) return;
            body += chunk;
            if (body.length > 5 * 1024 * 1024) {
                aborted = true;
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'حجم الطلب كبير جداً' }));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (aborted) return;
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

    // Serve strictly from dist/ or public/ (never expose project root or data/)
    let filePath = safeResolveStaticPath(DIST_DIR, pathname);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = safeResolveStaticPath(PUBLIC_DIR, pathname);
    }

    // SPA fallback to dist/index.html or root index.html only
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const distIndex = path.join(DIST_DIR, 'index.html');
        const rootIndex = path.join(BASE_DIR, 'index.html');
        filePath = fs.existsSync(distIndex) ? distIndex : rootIndex;
    }

    if (!filePath || !fs.existsSync(filePath)) {
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
