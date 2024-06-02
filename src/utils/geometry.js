export function plane(width, height, color) {
  const w = width / 2;
  const h = height / 2;
  const pos = [-w, h, 0.0, w, h, 0.0, -w, -h, 0.0, w, -h, 0.0];
  const nor = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0];
  const col = [
    color[0],
    color[1],
    color[2],
    color[3],
    color[0],
    color[1],
    color[2],
    color[3],
    color[0],
    color[1],
    color[2],
    color[3],
    color[0],
    color[1],
    color[2],
    color[3],
  ];
  const st = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0];
  const idx = [0, 2, 1, 1, 2, 3];
  return { position: pos, normal: nor, color: col, texCoord: st, index: idx };
}
