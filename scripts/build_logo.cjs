const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function generateLogo() {
  console.log("Fetching WOFF2 fonts...");
  const gvRes = await fetch("https://fonts.gstatic.com/s/greatvibes/v21/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2");
  const gvB64 = Buffer.from(await gvRes.arrayBuffer()).toString("base64");

  const cinzelRes = await fetch("https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgfY3lDQ.woff2");
  const cinzelB64 = Buffer.from(await cinzelRes.arrayBuffer()).toString("base64");

  console.log("Building refined SVG...");
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Gold Metallic Gradients -->
    <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bf953f" />
      <stop offset="20%" stop-color="#fcf6ba" />
      <stop offset="45%" stop-color="#b38728" />
      <stop offset="70%" stop-color="#fbf5b7" />
      <stop offset="85%" stop-color="#aa771c" />
      <stop offset="100%" stop-color="#d4af37" />
    </linearGradient>
    
    <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fad074" />
      <stop offset="50%" stop-color="#fff4cc" />
      <stop offset="100%" stop-color="#d4af37" />
    </linearGradient>

    <radialGradient id="badgeBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1c1d22" />
      <stop offset="65%" stop-color="#0a0b0e" />
      <stop offset="100%" stop-color="#020304" />
    </radialGradient>

    <!-- Orange/Amber 3D M Gradient -->
    <linearGradient id="orangeM" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fdba74" />
      <stop offset="30%" stop-color="#fb923c" />
      <stop offset="65%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#9a3412" />
    </linearGradient>

    <!-- Chrome / Silver Gradient for Radical -->
    <linearGradient id="chromeRadical" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#64748b" />
      <stop offset="30%" stop-color="#cbd5e1" />
      <stop offset="50%" stop-color="#94a3b8" />
      <stop offset="70%" stop-color="#f1f5f9" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <filter id="yellowGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="bulbGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="whiteSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <style>
      @font-face {
        font-family: 'Great Vibes';
        font-style: normal;
        font-weight: 400;
        src: url(data:font/woff2;base64,${gvB64}) format('woff2');
      }
      @font-face {
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 700;
        src: url(data:font/woff2;base64,${cinzelB64}) format('woff2');
      }

      .gold-border-outer {
        fill: none;
        stroke: url(#goldRim);
        stroke-width: 14;
      }
      .gold-border-inner {
        fill: none;
        stroke: #d4af37;
        stroke-width: 2.5;
        opacity: 0.85;
      }
      .gold-border-ring3 {
        fill: none;
        stroke: #fcf6ba;
        stroke-width: 1;
        opacity: 0.4;
      }
      .math-serif {
        font-family: 'Cinzel', 'Times New Roman', Georgia, serif;
        fill: url(#goldText);
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 12px;
        text-anchor: middle;
      }
      /* خط اليد المائل الأصيل والراقي للاستاذ */
      .handwritten-prof {
        font-family: 'Great Vibes', 'Alex Brush', cursive;
        font-size: 58px;
        font-weight: 400;
        fill: #ffffff;
        font-style: italic;
        filter: url(#whiteSoftGlow);
      }
      .handwritten-kouziber {
        font-family: 'Great Vibes', 'Alex Brush', cursive;
        font-size: 78px;
        font-weight: 400;
        fill: #fde047;
        font-style: italic;
        filter: url(#yellowGlow);
      }
      .handwritten-brahim {
        font-family: 'Great Vibes', 'Alex Brush', cursive;
        font-size: 74px;
        font-weight: 400;
        fill: #ffffff;
        font-style: italic;
        filter: url(#whiteSoftGlow);
      }
    </style>
  </defs>

  <!-- Background Circle with Luxury Gold Borders -->
  <circle cx="256" cy="256" r="252" fill="#020304" />
  <circle cx="256" cy="256" r="244" class="gold-border-outer" />
  <circle cx="256" cy="256" r="234" class="gold-border-inner" />
  <circle cx="256" cy="256" r="231" class="gold-border-ring3" />
  <circle cx="256" cy="256" r="228" fill="url(#badgeBg)" />

  <!-- Upper Stylized 3D "M" for MATHEMATICS -->
  <g transform="translate(256, 125)">
    <!-- Deep Drop Shadow -->
    <path d="M -26 55 L -14 -68 L -1 15 L 12 -68 L 24 55" fill="none" stroke="#431407" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
    <path d="M -28 55 L -16 -69 L -1 15 L 14 -69 L 26 55" fill="none" stroke="#9a3412" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <!-- Main 3D Orange Body of M -->
    <path d="M -29 55 L -17 -71 L -1 13 L 15 -71 L 27 55" fill="none" stroke="url(#orangeM)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Core Golden/Amber Highlight -->
    <path d="M -17 -71 L -1 13 L 15 -71" fill="none" stroke="#fef08a" stroke-width="1.8" opacity="0.95"/>
  </g>

  <!-- MATHEMATICS Spaced Gold Serif (ATHE on left, ATICS on right) -->
  <text x="162" y="166" class="math-serif">ATHE</text>
  <text x="352" y="166" class="math-serif">ATICS</text>

  <!-- Sleek Chrome/Silver Square Root Radical Symbol (√) -->
  <g>
    <!-- Dark bevel shadow -->
    <path d="M 80 323 L 138 323 L 202 443 L 258 201 L 476 201" 
          fill="none" stroke="#0f172a" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
    <!-- Main Metallic Radical Bar -->
    <path d="M 80 320 L 138 320 L 202 440 L 258 198 L 476 198" 
          fill="none" stroke="url(#chromeRadical)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Bright Top Specular Reflection Highlight -->
    <path d="M 82 318 L 138 318 L 202 437 L 258 196 L 476 196" 
          fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />
  </g>

  <!-- اسم الأستاذ بخط اليد المائل الأنيق: "Prof" (أبيض مائل) -->
  <g transform="translate(74, 298)">
    <text x="0" y="0" class="handwritten-prof">Prof</text>
  </g>

  <!-- "Kouziber" بخط اليد المائل المتصل والمذهب مع المصباح المضيء على حرف i -->
  <g transform="translate(178, 282)">
    <text x="0" y="0" class="handwritten-kouziber">Kouziber</text>
    
    <!-- Glowing lightbulb above the 'i' of Kouziber (exact center 180, -48) -->
    <g transform="translate(180, -48) scale(0.86)" filter="url(#bulbGlow)">
      <!-- Light rays -->
      <path d="M 0 -14 L 0 -20 M -10 -10 L -15 -15 M 10 -10 L 15 -15 M -13 0 L -19 0 M 13 0 L 19 0 M -8 8 L -13 13 M 8 8 L 13 13" 
            stroke="#fef08a" stroke-width="2" stroke-linecap="round" />
      <!-- Bulb dome with radiant yellow fill -->
      <path d="M -7 -2 C -7 -10 7 -10 7 -2 C 7 3 4 5 4 8 L -4 8 C -4 5 -7 3 -7 -2 Z" 
            fill="#fef08a" stroke="#eab308" stroke-width="1.6" />
      <!-- Screw base -->
      <path d="M -3 8 L 3 8 M -2.5 10.5 L 2.5 10.5 M -1.5 12.5 L 1.5 12.5" 
            stroke="#ca8a04" stroke-width="1.6" stroke-linecap="round" />
      <!-- Glowing filament -->
      <path d="M -2.5 3 L 0 -3 L 2.5 3" fill="none" stroke="#b45309" stroke-width="1.2" stroke-linecap="round" />
      <circle cx="0" cy="-3" r="1.5" fill="#ffffff" />
    </g>
  </g>

  <!-- "Brahim" بخط اليد المائل الأبيض المتوهج مع المصباح المضيء على حرف i -->
  <g transform="translate(232, 370)">
    <text x="0" y="0" class="handwritten-brahim">Brahim</text>
    
    <!-- Glowing lightbulb above the 'i' of Brahim (exact center 154, -45) -->
    <g transform="translate(154, -45) scale(0.86)" filter="url(#bulbGlow)">
      <!-- Light rays -->
      <path d="M 0 -14 L 0 -20 M -10 -10 L -15 -15 M 10 -10 L 15 -15 M -13 0 L -19 0 M 13 0 L 19 0 M -8 8 L -13 13 M 8 8 L 13 13" 
            stroke="#fef08a" stroke-width="2" stroke-linecap="round" />
      <!-- Bulb dome -->
      <path d="M -7 -2 C -7 -10 7 -10 7 -2 C 7 3 4 5 4 8 L -4 8 C -4 5 -7 3 -7 -2 Z" 
            fill="#fef08a" stroke="#eab308" stroke-width="1.6" />
      <!-- Screw base -->
      <path d="M -3 8 L 3 8 M -2.5 10.5 L 2.5 10.5 M -1.5 12.5 L 1.5 12.5" 
            stroke="#ca8a04" stroke-width="1.6" stroke-linecap="round" />
      <!-- Glowing filament -->
      <path d="M -2.5 3 L 0 -3 L 2.5 3" fill="none" stroke="#b45309" stroke-width="1.2" stroke-linecap="round" />
      <circle cx="0" cy="-3" r="1.5" fill="#ffffff" />
    </g>
  </g>
</svg>`;

  fs.writeFileSync("public/logo.svg", svgContent);
  console.log("Written public/logo.svg successfully!");

  // Launch puppeteer to render crisp PNG
  console.log("Rendering high-res PNG with Puppeteer...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 1024px; height: 1024px; }
        svg { width: 1024px; height: 1024px; }
      </style>
    </head>
    <body>
      ${svgContent.replace('width="512" height="512"', 'width="1024" height="1024"')}
    </body>
    </html>
  `, { waitUntil: "networkidle0" });

  await page.evaluateHandle("document.fonts.ready");
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: "public/logo.png", omitBackground: true });
  console.log("public/logo.png rendered with crisp 1024x1024 resolution!");

  await browser.close();
  console.log("Done successfully!");
}

generateLogo().catch(err => {
  console.error("Error generating logo:", err);
  process.exit(1);
});
