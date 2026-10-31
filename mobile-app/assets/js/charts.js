/**
 * charts.js — dependency-free SVG charts sized to their container via viewBox.
 * Deterministic: same data → same chart. No animation tricks, no fake data.
 */

const NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

function wrap(viewBox, children) {
  const svg = svgEl("svg", { viewBox, preserveAspectRatio: "none" });
  for (const c of children) svg.append(c);
  return svg;
}

/** Area line chart. data: numbers[] */
export function lineChart(data, { height = 120, stroke = "#fbbf24", fill = "rgba(251,191,36,0.14)" } = {}) {
  const W = 320, H = height, P = 8;
  const wrapEl = h_wrap();
  function h_wrap() { return document.createElement("div"); }
  if (!data || data.length === 0) {
    wrapEl.className = "chart-wrap muted small";
    wrapEl.textContent = "No data yet.";
    return wrapEl;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const px = (i) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1);
  const py = (v) => H - P - ((v - min) / span) * (H - 2 * P);

  const points = data.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const area = `${P},${H - P} ${points} ${px(data.length - 1)},${H - P}`;

  const svg = wrap(`0 0 ${W} ${H}`, [
    svgEl("polygon", { points: area, fill }),
    svgEl("polyline", { points, fill: "none", stroke, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    svgEl("circle", { cx: px(data.length - 1), cy: py(data[data.length - 1]), r: 3.2, fill: stroke }),
  ]);
  wrapEl.className = "chart-wrap";
  wrapEl.append(svg);
  return wrapEl;
}

/** Bar chart. bars: {label, value}[] */
export function barChart(bars, { height = 130, palette = ["#4c1d95", "#be185d", "#fbbf24", "#60a5fa", "#34d399"] } = {}) {
  const container = document.createElement("div");
  container.className = "chart-wrap";
  if (!bars || bars.length === 0) {
    container.classList.add("muted", "small");
    container.textContent = "No data yet.";
    return container;
  }
  const W = 320, H = height, P = 10;
  const max = Math.max(...bars.map((b) => b.value)) || 1;
  const slot = (W - 2 * P) / bars.length;
  const bw = Math.min(30, slot * 0.55);
  const children = [];
  bars.forEach((b, i) => {
    const bh = Math.max(3, (b.value / max) * (H - 2 * P));
    const x = P + i * slot + (slot - bw) / 2;
    children.push(svgEl("rect", { x, y: H - P - bh, width: bw, height: bh, rx: 5, fill: palette[i % palette.length] }));
  });
  children.push(svgEl("line", { x1: P, y1: H - P, x2: W - P, y2: H - P, stroke: "currentColor", "stroke-opacity": 0.25, "stroke-width": 1 }));
  container.append(wrap(`0 0 ${W} ${H}`, children));

  const legend = document.createElement("div");
  legend.className = "legend";
  bars.forEach((b, i) => {
    const item = document.createElement("span");
    item.className = "item";
    const sw = document.createElement("span");
    sw.className = "sw";
    sw.style.background = palette[i % palette.length];
    item.append(sw, document.createTextNode(`${b.label} · ${b.value.toLocaleString()}`));
    legend.append(item);
  });
  container.append(legend);
  return container;
}

/** Donut. segments: {label, value, color}[] */
export function donutChart(segments) {
  const container = document.createElement("div");
  container.className = "chart-wrap";
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!segments.length || total <= 0) {
    container.classList.add("muted", "small");
    container.textContent = "No data yet.";
    return container;
  }
  const R = 15.915; // circumference 100
  let offset = 25;
  const children = [];
  for (const seg of segments) {
    const frac = (seg.value / total) * 100;
    children.push(svgEl("circle", {
      cx: "21", cy: "21", r: R, fill: "none",
      stroke: seg.color, "stroke-width": 6.5,
      "stroke-dasharray": `${frac} ${100 - frac}`,
      "stroke-dashoffset": offset,
      "stroke-linecap": "butt",
    }));
    offset -= frac;
  }
  children.push(svgEl("circle", { cx: "21", cy: "21", r: R, fill: "none", stroke: "transparent", "stroke-width": 6.5 }));
  container.append(wrap("0 0 42 42", children));

  const legend = document.createElement("div");
  legend.className = "legend";
  for (const seg of segments) {
    const item = document.createElement("span");
    item.className = "item";
    const sw = document.createElement("span");
    sw.className = "sw";
    sw.style.background = seg.color;
    item.append(sw, document.createTextNode(`${seg.label} · ${Math.round((seg.value / total) * 100)}%`));
    legend.append(item);
  }
  container.append(legend);
  return container;
}

/** Horizontal funnel. stages: {name, count}[] */
export function funnel(stages) {
  const container = document.createElement("div");
  container.className = "funnel";
  const max = Math.max(...stages.map((s) => s.count), 1);
  for (const s of stages) {
    const row = document.createElement("div");
    row.className = "stage";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = s.name;
    const track = document.createElement("span");
    track.className = "bar-track";
    const fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(3, (s.count / max) * 100)}%`;
    track.append(fill);
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(s.count);
    row.append(name, track, num);
    container.append(row);
  }
  return container;
}
