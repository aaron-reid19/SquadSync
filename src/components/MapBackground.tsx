// Google-Maps-style background built from a street grid, using the SquadSync palette.
const XS = [-20, 160, 400, 620, 880, 1110, 1330, 1460]; // vertical street positions
const YS = [-20, 150, 330, 520, 700, 920]; // horizontal street positions
const STREET = 22;
const PARKS = new Set(["5-1", "2-4"]);
const WATER = new Set(["0-3", "0-4", "1-4"]);
const MAIN_X = [880]; // yellow main roads
const MAIN_Y = [520];
// Route A -> B follows real streets: east along the main road, north, east, north into the park.
const ROUTE = "M160 520 L880 520 L880 330 L1110 330 L1110 240 L1190 240";

// Tiny seeded random so the buildings look the same on every render.
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface Rect { x: number; y: number; w: number; h: number; fill: string }

function buildBlocks() {
  const buildings: Rect[] = [];
  const parks: Rect[] = [];
  const water: Rect[] = [];
  const inset = STREET / 2 + 8;

  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < YS.length - 1; j++) {
      const x = XS[i] + inset, y = YS[j] + inset;
      const w = XS[i + 1] - XS[i] - inset * 2, h = YS[j + 1] - YS[j] - inset * 2;
      const key = `${i}-${j}`;
      if (PARKS.has(key)) { parks.push({ x, y, w, h, fill: "#8fd84d" }); continue; }
      if (WATER.has(key)) { water.push({ x, y, w, h, fill: "#59bfdf" }); continue; }

      const rnd = seeded(i * 97 + j * 31 + 7);
      const cols = w > 200 ? 3 : 2;
      const rows = h > 170 ? 2 : 1;
      const gap = 7;
      const bw = (w - gap * (cols - 1)) / cols;
      const bh = (h - gap * (rows - 1)) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() < 0.12) continue; // leave an occasional gap
          const shrinkW = bw * (0.08 + rnd() * 0.22);
          const shrinkH = bh * (0.08 + rnd() * 0.22);
          buildings.push({
            x: x + c * (bw + gap) + shrinkW / 2,
            y: y + r * (bh + gap) + shrinkH / 2,
            w: bw - shrinkW,
            h: bh - shrinkH,
            fill: rnd() > 0.5 ? "#e3e0d7" : "#d9d6cb",
          });
        }
      }
    }
  }
  return { buildings, parks, water };
}

const { buildings, parks, water } = buildBlocks();

function roads(width: number, color: string, xs = XS, ys = YS) {
  return (
    <g stroke={color} strokeWidth={width} strokeLinecap="round">
      {xs.map((x) => <line key={`v${x}`} x1={x} y1={-60} x2={x} y2={960} />)}
      {ys.map((y) => <line key={`h${y}`} x1={-60} y1={y} x2={1500} y2={y} />)}
    </g>
  );
}

export default function MapBackground() {
  return (
    <svg className="login__map" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="-60" y="-60" width="1560" height="1020" fill="#f6f3ea" />

      {water.map((r, k) => <rect key={`w${k}`} {...r} rx="14" opacity=".35" />)}
      {parks.map((r, k) => <rect key={`p${k}`} {...r} rx="14" opacity=".4" />)}
      {buildings.map((r, k) => <rect key={`b${k}`} {...r} rx="3" />)}

      {roads(STREET + 4, "#dcd7ca")}
      {roads(STREET, "#ffffff")}
      {roads(STREET + 10, "#e3c93a", MAIN_X, MAIN_Y)}
      {roads(STREET + 4, "#f8de52", MAIN_X, MAIN_Y)}

      <path d={ROUTE} fill="none" stroke="#eb3c37" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 16" />

      {/* A: start */}
      <circle cx="160" cy="520" r="20" fill="#59bfdf" stroke="#fff" strokeWidth="6" />
      <circle cx="160" cy="520" r="7" fill="#fff" />

      {/* B: destination pin in the park */}
      <path d="M1190 240 C 1168 214, 1156 198, 1156 180 A 34 34 0 1 1 1224 180 C 1224 198, 1212 214, 1190 240 Z" fill="#eb3c37" stroke="#fff" strokeWidth="5" />
      <circle cx="1190" cy="180" r="12" fill="#fff" />
    </svg>
  );
}
