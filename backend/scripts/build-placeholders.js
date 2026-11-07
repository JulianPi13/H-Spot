// Genera las imágenes PROVISIONALES del sitio (hero, editorial, banner, categorías).
// Son SVG livianos, rotulados "IMAGEN PROVISIONAL". Reemplázalas desde el panel
// (Ajustes > Inicio) subiendo fotografías reales.
// Uso: node scripts/build-placeholders.js
const fs = require('fs');
const path = require('path');
const { garment, productSvg } = require('../prisma/demo-images');

const OUT = path.join(__dirname, '..', '..', 'frontend', 'assets', 'img');

const defs = `<defs>
  <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  <filter id="c"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="4" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer></filter>
  <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
const label = (x, y, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="monospace" font-size="18" letter-spacing="4" fill="#8a8a8a">IMAGEN PROVISIONAL — REEMPLAZAR</text>`;

function scene(w, h, content, bg = '#1a1a1a') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${defs}
<rect width="${w}" height="${h}" fill="${bg}"/>
<rect width="${w}" height="${h}" filter="url(#c)" opacity=".55"/>
${content}
<rect width="${w}" height="${h}" filter="url(#g)" opacity=".09"/>
</svg>`;
}

// Hero: muro de concreto con juntas, haz de luz y dos prendas colgadas
const hero = scene(1920, 1080, `
  ${[0, 1, 2, 3].map((i) => `<line x1="0" y1="${270 * i + 260}" x2="1920" y2="${270 * i + 260}" stroke="#0f0f0f" stroke-width="3"/>`).join('')}
  ${[0, 1, 2, 3, 4].map((i) => `<line x1="${480 * i + 240}" y1="0" x2="${480 * i + 240}" y2="1080" stroke="#0f0f0f" stroke-width="3"/>`).join('')}
  <circle cx="${480 * 1 + 240 - 30}" cy="230" r="9" fill="#0d0d0d"/><circle cx="${480 * 3 + 240 - 30}" cy="230" r="9" fill="#0d0d0d"/>
  <polygon points="1100,0 1920,0 1920,1080 520,1080" fill="url(#light)"/>
  <line x1="980" y1="150" x2="1660" y2="150" stroke="#777" stroke-width="5"/>
  <g transform="translate(940 120) scale(.62)">${garment('hoodie', '#0f0f0f', '#3a3a3a')}</g>
  <g transform="translate(1280 150) scale(.56)">${garment('tee', '#d9d5cd', '#9a968f')}</g>
  <rect x="0" y="960" width="1920" height="120" fill="#121212"/>
  ${label(1880, 1040, 'end')}`);

const editorial = scene(1200, 1400, `
  <polygon points="0,0 1200,0 1200,500 0,900" fill="#202020"/>
  <polygon points="300,0 1200,0 1200,1400 900,1400" fill="url(#light)"/>
  <g transform="translate(180 260) scale(.72)">${garment('pants', '#5B5E4A', '#2c2e22')}</g>
  <g transform="translate(560 160) scale(.6)">${garment('jacket', '#2E3A4D', '#141b26')}</g>
  ${label(40, 1360)}`, '#171717');

const promo = scene(1920, 800, `
  ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 150 - 40}" y="${(i % 3) * 40 + 80}" width="110" height="${560 - (i % 4) * 40}" fill="#202020"/>`).join('')}
  <polygon points="0,800 1920,300 1920,800" fill="#0f0f0f" opacity=".7"/>
  ${label(1880, 770, 'end')}`, '#141414');

const authSide = scene(1000, 1400, `
  <polygon points="0,1400 1000,600 1000,1400" fill="#101010"/>
  <polygon points="200,0 1000,0 1000,900" fill="url(#light)"/>
  <g transform="translate(160 250) scale(.68)">${garment('hoodie', '#8A8A86', '#4f4f4c')}</g>
  ${label(40, 1360)}`, '#1b1b1b');

fs.writeFileSync(path.join(OUT, 'hero-provisional.svg'), hero);
fs.writeFileSync(path.join(OUT, 'editorial-provisional.svg'), editorial);
fs.writeFileSync(path.join(OUT, 'promo-provisional.svg'), promo);
fs.writeFileSync(path.join(OUT, 'auth-provisional.svg'), authSide);

const cats = { camisetas: ['tee', '#E8E4DC'], hoodies: ['hoodie', '#151515'], pantalones: ['pants', '#5B5E4A'], conjuntos: ['set', '#8A8A86'], accesorios: ['cap', '#2A2A2A'] };
for (const [slug, [type, hex]] of Object.entries(cats)) {
  fs.writeFileSync(path.join(OUT, `cat-${slug}.svg`), productSvg({ type, colorHex: hex, label: slug.toUpperCase() }));
}
console.log('Imágenes provisionales generadas en frontend/assets/img');
