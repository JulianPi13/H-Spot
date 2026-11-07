// Genera imágenes PROVISIONALES de producto (siluetas de prendas en el color real
// de la variante). Llevan el rótulo "FOTO PROVISIONAL" y se marcan con isDemo = true
// en la base de datos para reemplazarlas por fotografías reales desde el panel.
const sharp = require('sharp');

const W = 1200;
const H = 1500;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Siluetas simples de prendas (coordenadas en un lienzo de 1200 x 1500)
const SHAPES = {
  tee: (c, d) => `
    <path d="M370 330 L505 278 Q600 330 695 278 L830 330 L1010 520 L895 625 L845 575 L845 1185 L355 1185 L355 575 L305 625 L190 520 Z" fill="${c}"/>
    <path d="M505 278 Q600 360 695 278" fill="none" stroke="${d}" stroke-width="10"/>
    <path d="M355 575 L355 600 M845 575 L845 600" stroke="${d}" stroke-width="6"/>
    <path d="M300 615 L190 520" stroke="${d}" stroke-width="5" opacity=".6"/>
    <path d="M900 615 L1010 520" stroke="${d}" stroke-width="5" opacity=".6"/>
    <path d="M355 1150 L845 1150" stroke="${d}" stroke-width="5" opacity=".5"/>`,
  hoodie: (c, d) => `
    <path d="M480 320 Q465 160 600 140 Q735 160 720 320 Z" fill="${shade(c, -12)}"/>
    <path d="M375 360 L500 300 Q600 360 700 300 L825 360 Q950 520 995 1040 L895 1075 L845 640 L845 1170 L355 1170 L355 640 L305 1075 L205 1040 Q250 520 375 360 Z" fill="${c}"/>
    <path d="M500 300 Q600 400 700 300" fill="none" stroke="${d}" stroke-width="10"/>
    <path d="M575 360 L565 520 M625 360 L635 520" stroke="${d}" stroke-width="7" stroke-linecap="round"/>
    <path d="M440 860 L760 860 L800 1040 L400 1040 Z" fill="none" stroke="${d}" stroke-width="7"/>
    <rect x="355" y="1110" width="490" height="60" fill="${shade(c, -10)}"/>
    <rect x="200" y="1020" width="100" height="55" transform="rotate(8 250 1047)" fill="${shade(c, -10)}"/>
    <rect x="900" y="1020" width="100" height="55" transform="rotate(-8 950 1047)" fill="${shade(c, -10)}"/>`,
  jacket: (c, d) => `
    <path d="M375 340 L520 290 L600 330 L680 290 L825 340 Q950 520 990 1030 L890 1060 L845 630 L845 1160 L355 1160 L355 630 L310 1060 L210 1030 Q250 520 375 340 Z" fill="${c}"/>
    <path d="M520 290 L560 420 L600 330 L640 420 L680 290" fill="${shade(c, -18)}" stroke="${d}" stroke-width="5"/>
    <path d="M600 330 L600 1160" stroke="${d}" stroke-width="8"/>
    <circle cx="600" cy="520" r="10" fill="${d}"/><circle cx="600" cy="700" r="10" fill="${d}"/><circle cx="600" cy="880" r="10" fill="${d}"/>
    <path d="M410 840 L520 840 M680 840 L790 840" stroke="${d}" stroke-width="8" stroke-linecap="round"/>`,
  pants: (c, d) => `
    <rect x="410" y="240" width="380" height="70" fill="${shade(c, -12)}"/>
    <path d="M410 310 L370 1280 L575 1280 L600 560 L625 1280 L830 1280 L790 310 Z" fill="${c}"/>
    <path d="M600 310 L600 560" stroke="${d}" stroke-width="7"/>
    <rect x="360" y="700" width="120" height="170" rx="8" fill="${shade(c, -10)}" stroke="${d}" stroke-width="5"/>
    <rect x="720" y="700" width="120" height="170" rx="8" fill="${shade(c, -10)}" stroke="${d}" stroke-width="5"/>
    <path d="M370 1240 L575 1240 M625 1240 L830 1240" stroke="${d}" stroke-width="6" opacity=".6"/>
    <rect x="460" y="252" width="20" height="46" fill="${d}" opacity=".5"/><rect x="720" y="252" width="20" height="46" fill="${d}" opacity=".5"/>`,
  shorts: (c, d) => `
    <rect x="390" y="430" width="420" height="70" fill="${shade(c, -12)}"/>
    <path d="M390 500 L340 1000 L585 1010 L600 700 L615 1010 L860 1000 L810 500 Z" fill="${c}"/>
    <path d="M600 500 L600 700" stroke="${d}" stroke-width="7"/>
    <path d="M560 440 L545 600 M640 440 L655 600" stroke="${d}" stroke-width="6" stroke-linecap="round"/>
    <path d="M345 960 L585 970 M615 970 L855 960" stroke="${d}" stroke-width="6" opacity=".6"/>`,
  cap: (c, d) => `
    <path d="M330 860 Q330 520 600 500 Q870 520 870 860 Z" fill="${c}"/>
    <path d="M300 860 Q600 820 900 860 Q980 880 1000 930 Q800 900 600 905 Q400 905 300 900 Z" fill="${shade(c, -18)}"/>
    <path d="M600 500 L600 860 M470 520 Q440 700 460 860 M730 520 Q760 700 740 860" stroke="${d}" stroke-width="5" fill="none"/>
    <circle cx="600" cy="505" r="16" fill="${shade(c, -18)}"/>`,
  bag: (c, d) => `
    <path d="M470 520 Q470 300 600 300 Q730 300 730 520" fill="none" stroke="${shade(c, -15)}" stroke-width="30"/>
    <rect x="360" y="500" width="480" height="640" fill="${c}"/>
    <path d="M360 560 L840 560" stroke="${d}" stroke-width="6" opacity=".6"/>
    <rect x="500" y="760" width="200" height="120" fill="none" stroke="${d}" stroke-width="5"/>`,
};

function garment(type, c, d) {
  if (type === 'set') {
    return `<g transform="translate(240 20) scale(0.6)">${SHAPES.tee(c, d)}</g><g transform="translate(150 480) scale(0.75)">${SHAPES.shorts(c, d)}</g>`;
  }
  return SHAPES[type](c, d);
}

function productSvg({ type, colorHex, label, variant = 'front' }) {
  const isDark = parseInt(colorHex.slice(1), 16) < 0x333333;
  const bg1 = variant === 'front' ? '#d8d5cf' : '#c6c2bb';
  const bg2 = variant === 'front' ? '#bdb9b1' : '#aaa59d';
  const detail = isDark ? shade(colorHex, 45) : shade(colorHex, -45);
  const zoom = variant === 'detail' ? 'translate(-300 -230) scale(1.5)' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.18"/>
  <ellipse cx="600" cy="1300" rx="360" ry="40" fill="#000" opacity="0.18" filter="url(#soft)"/>
  <g transform="${zoom}">${garment(type, colorHex, detail)}</g>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.06"/>
  <text x="60" y="1440" font-family="monospace" font-size="30" letter-spacing="4" fill="#3a3a3a">H-SPOT / FOTO PROVISIONAL</text>
  <text x="1140" y="90" text-anchor="end" font-family="monospace" font-size="26" letter-spacing="3" fill="#4a4a4a">${label}</text>
</svg>`;
}

// Devuelve la imagen provisional ya convertida a WebP (para guardarla en disco o en Vercel Blob)
async function renderProductWebp(opts) {
  return sharp(Buffer.from(productSvg(opts))).resize(900, 1125).webp({ quality: 80 }).toBuffer();
}

module.exports = { renderProductWebp, productSvg, garment };
