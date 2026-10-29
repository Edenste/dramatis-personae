type Rgba = [r: number, g: number, b: number, a: number];

function parse(colour: string): Rgba {
  const value = colour.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).concat(1) as Rgba;
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value)?.[1];
  if (rgba) {
    const [r = 0, g = 0, b = 0, a = 1] = rgba.split(",").map((part) => Number(part.trim()));
    return [r, g, b, a];
  }
  throw new Error(`Not a colour: ${colour}`);
}

function luminance([r, g, b]: Rgba): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG 2 contrast ratio of a colour over a background; a translucent colour is blended first. */
export function contrastRatio(colour: string, background: string): number {
  const bg = parse(background);
  const [r, g, b, a] = parse(colour);
  const blended: Rgba = [
    r * a + bg[0] * (1 - a),
    g * a + bg[1] * (1 - a),
    b * a + bg[2] * (1 - a),
    1,
  ];
  const [light, dark] = [luminance(blended), luminance(bg)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}
