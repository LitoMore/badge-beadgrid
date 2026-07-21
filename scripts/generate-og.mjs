import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const colors = {
  ink: "#332f2a",
  muted: "#827a70",
  paper: "#f7f2e8",
  cream: "#fffaf0",
  board: "#d9d0c4",
  coral: "#f27059",
  yellow: "#f9dc5c",
  mint: "#67d5b5",
  purple: "#8a5cf5",
  blue: "#1597bb",
};

const fontWeights = [500, 600, 700, 800, 900];
const fontFaces = (await Promise.all(fontWeights.map(async (weight) => {
  const source = await readFile(
    new URL(`../node_modules/@fontsource/nunito/files/nunito-latin-${weight}-normal.woff2`, import.meta.url),
    "base64",
  );
  return `@font-face{font-family:Nunito;font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${source}) format('woff2')}`;
}))).join("");

function bead(x, y, color, radius = 7.5, hole = 2.35, surface = colors.board) {
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"/><circle cx="${x}" cy="${y}" r="${hole}" fill="${surface}"/>`;
}

const logoBeads = [
  [86, 66, colors.coral],
  [119, 78, colors.yellow],
  [152, 66, colors.mint],
  [101, 112, colors.purple],
  [134, 100, colors.blue],
].map(([x, y, color]) => bead(x, y, color, 16, 5, colors.paper)).join("");

const simplePattern = [
  ".11.11.",
  "1111111",
  "1111111",
  ".11111.",
  "..111..",
  "...1...",
];
const patternOrigin = { x: 795, y: 255 };
const patternUnit = 30;
const patternBeads = [];
simplePattern.forEach((line, row) => {
  [...line].forEach((cell, column) => {
    if (cell !== "1") return;
    patternBeads.push(bead(
      patternOrigin.x + column * patternUnit,
      patternOrigin.y + row * patternUnit,
      colors.coral,
      12.5,
      4,
    ));
  });
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>${fontFaces} text{font-family:Nunito,sans-serif}</style>
    <pattern id="page-grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#554936" stroke-opacity=".045" stroke-width="1"/>
    </pattern>
    <pattern id="peg-dots" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="1.6" fill="#655b50" fill-opacity=".32"/>
    </pattern>
    <filter id="card-shadow" x="-20%" y="-20%" width="150%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="13" result="blur"/>
      <feOffset in="blur" dx="12" dy="14" result="offset"/>
      <feFlood flood-color="#55432f" flood-opacity=".13" result="color"/>
      <feComposite in="color" in2="offset" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="${colors.paper}"/>
  <circle cx="80" cy="585" r="205" fill="${colors.coral}" opacity=".055"/>
  <circle cx="1140" cy="38" r="235" fill="${colors.mint}" opacity=".075"/>
  <rect width="1200" height="630" fill="url(#page-grid)"/>

  <g>${logoBeads}</g>
  <text x="182" y="82" fill="${colors.ink}" font-size="26" font-weight="900" letter-spacing="-.5">BADGE</text>
  <text x="182" y="111" fill="${colors.coral}" font-size="26" font-weight="900" letter-spacing="-.5">BEADGRID</text>
  <text x="86" y="183" fill="${colors.muted}" font-size="14" font-weight="700" letter-spacing="2.6">SHIELDS.IO → FUSE BEADS</text>

  <text x="82" y="273" fill="${colors.ink}" font-size="68" font-weight="900" letter-spacing="-2.4">BADGES,</text>
  <text x="82" y="344" fill="${colors.coral}" font-size="68" font-weight="900" letter-spacing="-2.4">MADE BEAD</text>
  <text x="82" y="415" fill="${colors.ink}" font-size="68" font-weight="900" letter-spacing="-2.4">BY BEAD.</text>

  <text x="86" y="473" fill="#655d55" font-size="22" font-weight="600">Turn any Shields.io badge into a colorful,</text>
  <text x="86" y="505" fill="#655d55" font-size="22" font-weight="600">ready-to-make fuse bead pattern.</text>
  <g transform="translate(86 548)">
    <rect width="338" height="43" rx="21.5" fill="${colors.cream}" stroke="#cfc5b7"/>
    ${bead(23, 21.5, colors.purple, 8, 2.5, colors.cream)}
    <text x="42" y="27" fill="#655d55" font-size="12" font-weight="800" letter-spacing="1.2">PASTE · PREVIEW · EXPORT</text>
  </g>

  <g filter="url(#card-shadow)">
    <rect x="641" y="59" width="500" height="512" rx="30" fill="${colors.cream}" stroke="#cfc5b7" stroke-width="2"/>
    <rect x="651" y="69" width="500" height="512" rx="30" fill="none" stroke="${colors.coral}" stroke-opacity=".16" stroke-width="5"/>
  </g>
  ${bead(673, 91, colors.purple, 9, 2.8, colors.cream)}
  ${bead(1110, 91, colors.mint, 9, 2.8, colors.cream)}
  <text x="685" y="122" fill="${colors.muted}" font-size="12" font-weight="800" letter-spacing="2">BEAD BY BEAD</text>
  <text x="685" y="151" fill="${colors.ink}" font-size="23" font-weight="900">One URL. Every bead.</text>
  <g transform="translate(973 115)">
    <rect width="127" height="32" rx="16" fill="#f0e9de"/>
    <text x="63.5" y="21" fill="${colors.muted}" text-anchor="middle" font-size="10" font-weight="800">SIMPLE BY DESIGN</text>
  </g>

  <rect x="669" y="177" width="448" height="323" rx="18" fill="${colors.board}" stroke="#a99e90" stroke-width="2"/>
  <rect x="677" y="185" width="432" height="307" rx="12" fill="none" stroke="#ede7dc" stroke-width="7"/>
  <rect x="685" y="193" width="416" height="291" rx="8" fill="url(#peg-dots)"/>
  <g>${patternBeads.join("")}</g>

  <g transform="translate(685 526)">
    ${bead(8, 8, colors.coral, 7, 2.2, colors.cream)}
    <text x="25" y="12" fill="${colors.muted}" font-size="11" font-weight="700" letter-spacing="1">ROUND · HOLLOW · SOLID</text>
    <line x1="248" y1="8" x2="416" y2="8" stroke="#cfc5b7"/>
  </g>
  <g transform="translate(965 538)">
    <rect width="135" height="28" rx="14" fill="#f0e9de"/>
    <text x="67.5" y="18" fill="#655d55" text-anchor="middle" font-size="9" font-weight="800">PNG · SVG · CSV</text>
  </g>
</svg>`;

await writeFile(new URL("../public/og.svg", import.meta.url), svg);
