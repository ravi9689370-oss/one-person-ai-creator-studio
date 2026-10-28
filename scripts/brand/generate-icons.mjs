#!/usr/bin/env node
/**
 * Generator for the complete app icon + splash branding set.
 *
 * Pure Node implementation (no image libraries): renders the brand mark —
 * an amber lightning bolt with white sparks on a deep navy → violet →
 * magenta gradient — into every Android launcher density, the Play Store
 * 512 icon, and every splash size already present in the android/ res tree.
 * 4x supersampling provides anti-aliasing; adaptive-icon layering and the
 * legacy round/square masks are generated here, so CI never needs designer
 * tooling to rebuild the identity.
 *
 * Outputs:
 *   res/mipmap-[density]/ic_launcher.png            rounded-square legacy tile
 *   res/mipmap-[density]/ic_launcher_round.png      circle legacy tile
 *   res/mipmap-[density]/ic_launcher_foreground.png adaptive-foreground layer
 *   res/drawable[qualifiers]/splash.png             every pre-existing splash size
 *   branding/play-store-icon-512.png                store listing icon
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const RES = join(ROOT, "android", "app", "src", "main", "res");

/* ------------------------------------------------------------------ *
 * Geometry — shared 108-unit space (adaptive-icon grid).
 * ------------------------------------------------------------------ */
const CANVAS = 108;
const SAFE_SCALE = 0.62; // adaptive content within the 66dp safe zone
const LEGACY_SCALE = 0.98;

/** Lightning bolt (classic double-cut), clockwise. */
const BOLT = [
  [44, 14], [74, 14], [58, 45], [73, 45], [39, 95], [49, 58], [34, 58],
];
const SPARK_A = [[24, 26], [31, 33], [24, 40], [17, 33]];
const SPARK_B = [[80, 68], [85, 73], [80, 78], [75, 73]];

const AMBER = [251, 191, 36]; // #FBBF24
const WHITE = [255, 255, 255];

const GRAD_A = [14, 20, 46]; // #0E142E deep navy
const GRAD_B = [76, 29, 149]; // #4C1D95 violet
const GRAD_C = [190, 24, 93]; // #BE185D magenta

function gradientAt(px, py, w, h) {
  const t = 0.62 * (px / Math.max(1, w)) + 0.38 * (py / Math.max(1, h));
  const [c1, c2, k] =
    t < 0.55 ? [GRAD_A, GRAD_B, t / 0.55] : [GRAD_B, GRAD_C, (t - 0.55) / 0.45];
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * k),
    Math.round(c1[1] + (c2[1] - c1[1]) * k),
    Math.round(c1[2] + (c2[2] - c1[2]) * k),
  ];
}

/* ------------------------------------------------------------------ *
 * PNG encoding (RGBA, filter 0, zlib).
 * ------------------------------------------------------------------ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function pngDims(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/* ------------------------------------------------------------------ *
 * Rasterizer — 4x supersampling.
 * ------------------------------------------------------------------ */
const SUBS = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function render(w, h, opts) {
  const rgba = Buffer.alloc(w * h * 4, 0);
  const u = opts.unitScale; // device px per unit
  const cx = w / 2;
  const cy = h / 2;
  const corner = (opts.corner ?? 24) * u; // rounded-mask radius in px
  const feather = Math.max(0.75, 1.5 / u); // AA band in px
  const markTransform =
    opts.markTransform ?? ((ux, uy) => [ux, uy]); // unit-space → unit-space

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const [ox, oy] of SUBS) {
        const fx = x + ox;
        const fy = y + oy;

        /* tile coverage — signed distance to the tile shape */
        let cov = 1;
        if (opts.mask === "rounded" || opts.mask === "circle") {
          let sd;
          if (opts.mask === "rounded") {
            const qx = Math.abs(fx - w / 2) - (w / 2 - corner);
            const qy = Math.abs(fy - h / 2) - (h / 2 - corner);
            sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner;
          } else {
            sd = Math.sqrt((fx - cx) ** 2 + (fy - cy) ** 2) - (w / 2 - 1);
          }
          cov = clamp01(0.5 - sd / feather);
        }
        if (cov <= 0.001) continue;

        /* base layer */
        let pr = 0, pg = 0, pb = 0, pa = 0;
        if (opts.bg) {
          const [gr, gg, gb] = gradientAt(fx, fy, w, h);
          pr = gr; pg = gg; pb = gb; pa = 255;
        }

        /* brand mark (shapes overwrite the gradient where covered) */
        const sx = fx / u;
        const sy = fy / u;
        const m = markTransform(sx, sy);
        let color = null;
        if (pointInPoly(m[0], m[1], BOLT)) color = AMBER;
        else if (pointInPoly(m[0], m[1], SPARK_A) || pointInPoly(m[0], m[1], SPARK_B)) color = WHITE;
        if (color) {
          pr = color[0]; pg = color[1]; pb = color[2]; pa = 255;
        }

        r += pr * cov; g += pg * cov; b += pb * cov; a += pa * cov;
      }
      const i = (y * w + x) * 4;
      rgba[i] = Math.min(255, Math.round(r / SUBS.length));
      rgba[i + 1] = Math.min(255, Math.round(g / SUBS.length));
      rgba[i + 2] = Math.min(255, Math.round(b / SUBS.length));
      rgba[i + 3] = Math.min(255, Math.round(a / SUBS.length));
    }
  }
  return rgba;
}

/* ------------------------------------------------------------------ *
 * Producers
 * ------------------------------------------------------------------ */
function writePng(path, w, h, rgba) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, encodePng(w, h, rgba));
}

function iconTiles() {
  const densities = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ];
  for (const [dir, size] of densities) {
    const base = size / CANVAS;
    writePng(join(RES, dir, "ic_launcher.png"), size, size,
      render(size, size, { mask: "rounded", bg: true, corner: 24, unitScale: base * LEGACY_SCALE }));
    writePng(join(RES, dir, "ic_launcher_round.png"), size, size,
      render(size, size, { mask: "circle", bg: true, unitScale: base * LEGACY_SCALE }));
    /* adaptive foreground layer: full 108-grid canvas, mark drawn at SAFE_SCALE.
       note: the sample is mapped into "bolt space" with /k — drawn visual size
       is exactly k of the bolt's native extents (drawn visual_x = 54+(bx-54)*k). */
    const fg = Math.round(size * (108 / 48));
    const k = SAFE_SCALE;
    const fgRgba = render(fg, fg, {
      mask: "none",
      bg: false,
      unitScale: fg / CANVAS,
      markTransform: (ux, uy) => [54 + (ux - 54) / k, 54 + (uy - 54) / k],
    });
    writePng(join(RES, dir, "ic_launcher_foreground.png"), fg, fg, fgRgba);
    console.log(`icons: ${dir} tile=${size} round=${size} foreground=${fg}`);
  }
}

function splashImages() {
  const paths = [];
  for (const dir of readdirSync(RES).sort()) {
    if (!dir.startsWith("drawable")) continue;
    const p = join(RES, dir, "splash.png");
    try {
      readFileSync(p);
      paths.push({ p, ...pngDims(p) });
    } catch { /* no splash in this bucket */ }
  }
  for (const { p, w, h } of paths) {
    const rgba = render(w, h, {
      mask: "none",
      bg: true,
      unitScale: (0.3 * Math.min(w, h)) / 85, // bolt spans ~81 units tall
      markTransform: (ux, uy) => {
        /* recentre: unit grid center → canvas center; bolt mass ~ (55, 54) */
        const ox = w / 2 / ((0.3 * Math.min(w, h)) / 85) - 55;
        const oy = h / 2 / ((0.3 * Math.min(w, h)) / 85) - 54;
        return [ux - ox, uy - oy];
      },
    });
    /* translucent disc + ring behind the mark */
    const cx = w / 2, cy = h / 2;
    const discR = 0.19 * Math.min(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        let alpha = 0;
        if (d <= discR) alpha = 0.1;
        else if (d >= discR * 1.28 && d <= discR * 1.38) alpha = 0.22;
        if (alpha > 0) {
          const i = (y * w + x) * 4;
          rgba[i] = Math.round(rgba[i] * (1 - alpha) + 255 * alpha);
          rgba[i + 1] = Math.round(rgba[i + 1] * (1 - alpha) + 255 * alpha);
          rgba[i + 2] = Math.round(rgba[i + 2] * (1 - alpha) + 255 * alpha);
        }
      }
    }
    writePng(p, w, h, rgba);
    console.log(`splash: ${relative(ROOT, p)} ${w}x${h}`);
  }
}

function playStoreIcon() {
  writePng(join(ROOT, "branding", "play-store-icon-512.png"), 512, 512,
    render(512, 512, { mask: "rounded", bg: true, corner: 24, unitScale: 512 / CANVAS }));
  console.log("store: branding/play-store-icon-512.png");
}

export { render, encodePng, pointInPoly };

iconTiles();
splashImages();
playStoreIcon();
console.log("brand assets generated.");
