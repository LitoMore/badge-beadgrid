import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  Grid3X3,
  ImageDown,
  Link,
  LoaderCircle,
  Monitor,
  Moon,
  RefreshCcw,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRO_FONT, proFontPixel } from "./profont";

const DEFAULT_URL = "https://img.shields.io/badge/build-passing-brightgreen";
const DEFAULT_ROWS = 16;

const EXAMPLES = [
  ["BUILD", DEFAULT_URL],
  ["COVERAGE", "https://img.shields.io/badge/coverage-100%25-brightgreen"],
  ["VERSION", "https://img.shields.io/badge/version-v2.4.1-blue"],
  ["JSR", "https://jsr.io/badges/@std/path"],
] as const;

type Rgb = { r: number; g: number; b: number };
type ColorTheme = "system" | "light" | "dark";
type ColorCount = { color: string; name: string; count: number };
type BadgeTextRun = {
  content: string;
  x: number;
  textLength: number;
  fontSize: number;
  scaleX: number;
  scaleY: number;
  anchor: string;
  color: string;
  gridX?: number;
  gridMaxWidth?: number;
};
type BadgeSegment = { x: number; width: number };
type BackgroundSlice = BadgeSegment & { gridX: number; gridWidth: number };
type BadgeLogo = {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
};
type Pattern = {
  columns: number;
  rows: number;
  cells: Array<string | null>;
  colors: ColorCount[];
  beadCount: number;
};

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value.slice(0, 6);
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex(color: Rgb) {
  return `#${[color.r, color.g, color.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function toOklab(color: Rgb) {
  const [red, green, blue] = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const light = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return {
    l: 0.2104542553 * light + 0.793617785 * medium - 0.0040720468 * short,
    a: 1.9779984951 * light - 2.428592205 * medium + 0.4505937099 * short,
    b: 0.0259040371 * light + 0.7827717662 * medium - 0.808675766 * short,
  };
}

function colorDistance(a: Rgb, b: Rgb) {
  const first = toOklab(a);
  const second = toOklab(b);
  return (first.l - second.l) ** 2
    + (first.a - second.a) ** 2
    + (first.b - second.b) ** 2;
}

function readableColorName(index: number) {
  return `Badge ${String(index + 1).padStart(2, "0")}`;
}

async function fetchBadgeSvg(requestedUrl: string) {
  const parsed = new URL(requestedUrl);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Please use an HTTP or HTTPS badge URL.");
  const response = await fetch(parsed.toString(), { headers: { Accept: "image/svg+xml" } });
  if (!response.ok) throw new Error(`Shields.io returned ${response.status}. Check the badge URL and try again.`);
  const svg = await response.text();
  if (!svg.trim().startsWith("<svg") && !svg.includes("<svg")) throw new Error("That URL did not return an SVG badge.");
  return { svg, url: parsed.toString() };
}

function normalizeCssColor(value: string) {
  if (!value || value === "none" || value.startsWith("url(") || value === "currentColor") return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#010203";
  context.fillStyle = value;
  const normalized = context.fillStyle;
  if (!normalized.startsWith("#")) return null;
  return normalized.length === 4
    ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized.slice(0, 7);
}

function sourcePalette(svg: string) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const colors = new Set<string>();
  documentNode.querySelectorAll("[fill]").forEach((node) => {
    const normalized = normalizeCssColor(node.getAttribute("fill") ?? "");
    if (normalized) colors.add(normalized);
  });
  if (documentNode.querySelector("text") && colors.size === 0) colors.add("#ffffff");
  return [...colors].slice(0, 24);
}

function svgDimensions(svg: string) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("The response is not a valid SVG badge.");
  const root = documentNode.documentElement;
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
  const width = viewBox?.[2] || Number.parseFloat(root.getAttribute("width") || "0");
  const height = viewBox?.[3] || Number.parseFloat(root.getAttribute("height") || "0");
  if (!width || !height) throw new Error("This badge does not include valid dimensions.");
  return { width, height };
}

function inheritedAttribute(node: Element, name: string) {
  let current: Element | null = node;
  while (current) {
    const value = current.getAttribute(name);
    if (value) return value;
    current = current.parentElement;
  }
  return "";
}

function cumulativeScale(node: Element) {
  let scaleX = 1;
  let scaleY = 1;
  let current: Element | null = node;
  while (current) {
    const transform = current.getAttribute("transform") ?? "";
    for (const match of transform.matchAll(/scale\(\s*([\d.]+)(?:[ ,]+([\d.]+))?\s*\)/g)) {
      scaleX *= Number.parseFloat(match[1]);
      scaleY *= Number.parseFloat(match[2] ?? match[1]);
    }
    current = current.parentElement;
  }
  return { scaleX, scaleY };
}

function stripShadowEffects(root: ParentNode) {
  root.querySelectorAll("[filter]").forEach((node) => node.removeAttribute("filter"));
  root.querySelectorAll("[style]").forEach((node) => {
    const style = node.getAttribute("style") ?? "";
    const cleanStyle = style
      .split(";")
      .filter((declaration) => !/^\s*(?:filter|text-shadow|box-shadow)\s*:/i.test(declaration))
      .join(";");
    if (cleanStyle) node.setAttribute("style", cleanStyle);
    else node.removeAttribute("style");
  });
  root.querySelectorAll("filter").forEach((node) => node.remove());
}

function decodeBase64Utf8(value: string) {
  const binary = window.atob(value);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function stripEmbeddedLogoShadows(root: ParentNode) {
  root.querySelectorAll("image").forEach((image) => {
    const href = image.getAttribute("href") ?? image.getAttribute("xlink:href") ?? "";
    const match = href.match(/^data:image\/svg\+xml((?:;[^,]*)?),(.*)$/s);
    if (!match) return;
    try {
      const isBase64 = /;base64(?:;|$)/i.test(match[1]);
      const source = isBase64 ? decodeBase64Utf8(match[2]) : decodeURIComponent(match[2]);
      const logoDocument = new DOMParser().parseFromString(source, "image/svg+xml");
      if (logoDocument.querySelector("parsererror")) return;
      stripShadowEffects(logoDocument);
      const cleanSource = new XMLSerializer().serializeToString(logoDocument.documentElement);
      const cleanHref = isBase64
        ? `data:image/svg+xml;base64,${encodeBase64Utf8(cleanSource)}`
        : `data:image/svg+xml,${encodeURIComponent(cleanSource)}`;
      if (image.hasAttribute("href")) image.setAttribute("href", cleanHref);
      else image.setAttribute("xlink:href", cleanHref);
    } catch {
      // Keep an unusual logo data URI intact if it cannot be decoded safely.
    }
  });
}

function prepareBadgeSvg(svg: string) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) {
    return {
      renderSvg: svg,
      paletteSvg: svg,
      textRuns: [] as BadgeTextRun[],
      segments: [] as BadgeSegment[],
      logos: [] as BadgeLogo[],
    };
  }
  stripShadowEffects(documentNode);
  stripEmbeddedLogoShadows(documentNode);
  documentNode.querySelectorAll('[aria-hidden="true"]').forEach((node) => {
    if (node.matches("text") || node.querySelector("text")) node.remove();
  });
  const textNodes = Array.from(documentNode.querySelectorAll("text"));
  const textRuns = textNodes.flatMap((node): BadgeTextRun[] => {
    const content = node.textContent ?? "";
    const color = normalizeCssColor(inheritedAttribute(node, "fill")) ?? "#ffffff";
    if (!content) return [];
    const { scaleX, scaleY } = cumulativeScale(node);
    return [{
      content,
      x: Number.parseFloat(node.getAttribute("x") || "0"),
      textLength: Number.parseFloat(node.getAttribute("textLength") || "0"),
      fontSize: Number.parseFloat(inheritedAttribute(node, "font-size") || "11"),
      scaleX,
      scaleY,
      anchor: inheritedAttribute(node, "text-anchor") || "start",
      color,
    }];
  });
  const logoNodes = Array.from(documentNode.querySelectorAll("image"));
  const logos = logoNodes.flatMap((node): BadgeLogo[] => {
    const href = node.getAttribute("href") ?? node.getAttribute("xlink:href") ?? "";
    if (!href) return [];
    const { scaleX, scaleY } = cumulativeScale(node);
    return [{
      href,
      x: Number.parseFloat(node.getAttribute("x") || "0"),
      y: Number.parseFloat(node.getAttribute("y") || "0"),
      width: Number.parseFloat(node.getAttribute("width") || "0"),
      height: Number.parseFloat(node.getAttribute("height") || "0"),
      scaleX,
      scaleY,
    }];
  });
  const segments = Array.from(documentNode.querySelectorAll(
    "g[clip-path] > rect[fill], g[shape-rendering] > rect[fill]",
  ))
    .filter((node) => !(node.getAttribute("fill") ?? "").startsWith("url("))
    .map((node): BadgeSegment => ({
      x: Number.parseFloat(node.getAttribute("x") || "0"),
      width: Number.parseFloat(node.getAttribute("width") || "0"),
    }))
    .filter((segment) => segment.width > 0)
    .sort((left, right) => left.x - right.x);
  const paletteSvg = new XMLSerializer().serializeToString(documentNode.documentElement);
  textNodes.forEach((node) => node.remove());
  logoNodes.forEach((node) => node.remove());
  return {
    renderSvg: new XMLSerializer().serializeToString(documentNode.documentElement),
    paletteSvg,
    textRuns,
    segments,
    logos,
  };
}

function proFontPixelScale(run: BadgeTextRun, rows: number, svgHeight: number) {
  return Math.max(
    1,
    Math.round((run.fontSize * run.scaleY * rows) / svgHeight / PRO_FONT.height),
  );
}

function proFontGlyphs(content: string, pixelScale: number) {
  return Array.from(content).map((character) => {
    let left: number = PRO_FONT.width;
    let right: number = -1;
    for (let glyphY = 0; glyphY < PRO_FONT.height; glyphY += 1) {
      for (let glyphX = 0; glyphX < PRO_FONT.width; glyphX += 1) {
        if (!proFontPixel(character, glyphX, glyphY)) continue;
        left = Math.min(left, glyphX);
        right = Math.max(right, glyphX);
      }
    }
    const isBlank = right < left;
    const sourceWidth = isBlank ? 3 : right - left + 1;
    return {
      character,
      left: isBlank ? 0 : left,
      sourceWidth,
      naturalWidth: sourceWidth * pixelScale,
    };
  });
}

function proFontTextWidth(run: BadgeTextRun, rows: number, svgHeight: number) {
  const glyphs = proFontGlyphs(run.content, proFontPixelScale(run, rows, svgHeight));
  return glyphs.reduce((width, glyph) => width + glyph.naturalWidth, 0)
    + Math.max(0, glyphs.length - 1);
}

function layoutBadge(
  textRuns: BadgeTextRun[],
  segments: BadgeSegment[],
  rows: number,
  svgWidth: number,
  svgHeight: number,
) {
  const sourceScale = rows / svgHeight;
  const fallbackColumns = Math.max(1, Math.round(svgWidth * sourceScale));
  const hasSegmentLayout = segments.length === textRuns.length
    && segments.length > 0
    && textRuns.every((run) => run.textLength > 0 && run.anchor === "middle");
  if (!hasSegmentLayout) {
    return { columns: fallbackColumns, textRuns, slices: [] as BackgroundSlice[] };
  }

  let gridCursor = 0;
  const slices: BackgroundSlice[] = [];
  const laidOutRuns = textRuns.map((run, index) => {
    const segment = segments[index];
    const textWidth = proFontTextWidth(run, rows, svgHeight);
    const sourceTextWidth = run.textLength * run.scaleX;
    const sourceTextLeft = run.x * run.scaleX - sourceTextWidth / 2;
    const sourceTextRight = sourceTextLeft + sourceTextWidth;
    const sourceSegmentRight = segment.x + segment.width;
    const sourceLeftWidth = Math.max(0, sourceTextLeft - segment.x);
    const sourceRightWidth = Math.max(0, sourceSegmentRight - sourceTextRight);
    const leftWidth = Math.round(sourceLeftWidth * sourceScale);
    const rightWidth = Math.round(sourceRightWidth * sourceScale);
    const segmentGridWidth = leftWidth + textWidth + rightWidth;
    if (sourceLeftWidth > 0 && leftWidth > 0) {
      slices.push({ x: segment.x, width: sourceLeftWidth, gridX: gridCursor, gridWidth: leftWidth });
    }
    slices.push({
      x: sourceTextLeft,
      width: sourceTextWidth,
      gridX: gridCursor + leftWidth,
      gridWidth: textWidth,
    });
    if (sourceRightWidth > 0 && rightWidth > 0) {
      slices.push({
        x: sourceTextRight,
        width: sourceRightWidth,
        gridX: gridCursor + leftWidth + textWidth,
        gridWidth: rightWidth,
      });
    }
    const laidOutRun = {
      ...run,
      gridX: gridCursor + leftWidth + textWidth / 2,
      gridMaxWidth: textWidth,
    };
    gridCursor += segmentGridWidth;
    return laidOutRun;
  });

  return { columns: gridCursor, textRuns: laidOutRuns, slices };
}

function sourceXToGrid(
  sourceX: number,
  slices: BackgroundSlice[],
  columns: number,
  svgWidth: number,
) {
  const slice = slices.find((candidate, index) => (
    sourceX >= candidate.x
    && (sourceX < candidate.x + candidate.width || index === slices.length - 1)
  ));
  if (!slice) return (sourceX * columns) / svgWidth;
  return slice.gridX + ((sourceX - slice.x) * slice.gridWidth) / slice.width;
}

async function renderLogoPixels(
  logos: BadgeLogo[],
  slices: BackgroundSlice[],
  columns: number,
  rows: number,
  svgWidth: number,
  svgHeight: number,
  verticalOffset: number,
) {
  const logoPixels: Array<Rgb | undefined> = new Array(columns * rows);
  if (logos.length === 0) return logoPixels;
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return logoPixels;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  await Promise.all(logos.map(async (logo) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("A badge logo could not be rendered."));
      image.src = logo.href;
    });
    const sourceLeft = logo.x * logo.scaleX;
    const sourceRight = (logo.x + logo.width) * logo.scaleX;
    const gridLeft = sourceXToGrid(sourceLeft, slices, columns, svgWidth);
    const gridRight = sourceXToGrid(sourceRight, slices, columns, svgWidth);
    context.drawImage(
      image,
      gridLeft,
      (logo.y * logo.scaleY * rows) / svgHeight + verticalOffset,
      gridRight - gridLeft,
      (logo.height * logo.scaleY * rows) / svgHeight,
    );
  }));

  const data = context.getImageData(0, 0, columns, rows).data;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    logoPixels[index / 4] = { r: data[index], g: data[index + 1], b: data[index + 2] };
  }
  return logoPixels;
}

function renderProFont(
  textRuns: BadgeTextRun[],
  columns: number,
  rows: number,
  svgWidth: number,
  svgHeight: number,
  verticalOffset: number,
) {
  const pixels: Array<Rgb | undefined> = new Array(columns * rows);
  const runLayouts = textRuns.map((run) => {
    const pixelScale = proFontPixelScale(run, rows, svgHeight);
    const glyphs = proFontGlyphs(run.content, pixelScale);
    return { run, pixelScale, glyphs };
  });
  const layoutScale = Math.max(1, Math.round(rows / PRO_FONT.referenceRows));
  const layoutTop = (PRO_FONT.layoutTop - PRO_FONT.baseline) * layoutScale;
  const layoutBottom = (PRO_FONT.layoutBottom - PRO_FONT.baseline) * layoutScale
    + layoutScale - 1;
  const layoutHeight = layoutBottom - layoutTop + 1;
  const baselineY = (rows - layoutHeight) / 2 - layoutTop;

  runLayouts.forEach(({ run, pixelScale, glyphs }) => {
    const letterGap = 1;
    const gapWidth = Math.max(0, glyphs.length - 1) * letterGap;
    const naturalInkWidth = glyphs.reduce((width, glyph) => width + glyph.naturalWidth, 0);
    const naturalWidth = naturalInkWidth + gapWidth;
    const requestedWidth = run.gridMaxWidth ?? (run.textLength > 0
      ? Math.round((run.textLength * run.scaleX * columns) / svgWidth)
      : naturalWidth);
    const minimumWidth = glyphs.length + gapWidth;
    // Expanding a bitmap glyph duplicates columns and turns one-cell stems into two-cell stems.
    // Keep its natural width unless it must be reduced to stay inside the badge's text box.
    const fittedTextWidth = Math.min(
      columns,
      naturalWidth,
      Math.max(minimumWidth, requestedWidth),
    );
    let remainingInkWidth = fittedTextWidth - gapWidth;
    let remainingNaturalWidth = naturalInkWidth;
    const fittedGlyphs = glyphs.map((glyph, index) => {
      const remainingGlyphs = glyphs.length - index - 1;
      const fittedWidth = index === glyphs.length - 1
        ? Math.min(glyph.naturalWidth, remainingInkWidth)
        : Math.max(
            1,
            Math.min(
              glyph.naturalWidth,
              remainingInkWidth - remainingGlyphs,
              Math.round((remainingInkWidth * glyph.naturalWidth) / remainingNaturalWidth),
            ),
          );
      remainingInkWidth -= fittedWidth;
      remainingNaturalWidth -= glyph.naturalWidth;
      return { ...glyph, fittedWidth };
    });
    const renderedWidth = fittedGlyphs.reduce(
      (width, glyph) => width + glyph.fittedWidth,
      gapWidth,
    );
    const anchorX = run.gridX ?? (run.x * run.scaleX * columns) / svgWidth;
    const anchoredStartX = run.anchor === "middle"
      ? anchorX - renderedWidth / 2
      : run.anchor === "end"
        ? anchorX - renderedWidth
        : anchorX;
    const startX = Math.min(
      Math.max(0, anchoredStartX),
      Math.max(0, columns - renderedWidth),
    );
    const startY = baselineY - PRO_FONT.baseline * pixelScale + verticalOffset;
    const color = hexToRgb(run.color);

    let characterX = startX;
    fittedGlyphs.forEach((glyph) => {
      for (let glyphY = 0; glyphY < PRO_FONT.height; glyphY += 1) {
        for (let fittedX = 0; fittedX < glyph.fittedWidth; fittedX += 1) {
          const sourceX = glyph.left + Math.min(
            glyph.sourceWidth - 1,
            Math.floor((fittedX * glyph.sourceWidth) / glyph.fittedWidth),
          );
          if (!proFontPixel(glyph.character, sourceX, glyphY)) continue;
          for (let offsetY = 0; offsetY < pixelScale; offsetY += 1) {
            const x = Math.round(characterX + fittedX);
            const y = Math.round(startY + glyphY * pixelScale + offsetY);
            if (x >= 0 && x < columns && y >= 0 && y < rows) {
              pixels[y * columns + x] = color;
            }
          }
        }
      }
      characterX += glyph.fittedWidth + letterGap;
    });
  });
  return pixels;
}

async function makePattern(
  svg: string,
  rows: number,
  textVerticalOffset: number,
  logoVerticalOffset: number,
): Promise<Pattern> {
  const { renderSvg, paletteSvg, textRuns, segments, logos } = prepareBadgeSvg(svg);
  const { width, height } = svgDimensions(renderSvg);
  const layout = layoutBadge(textRuns, segments, rows, width, height);
  const { columns } = layout;
  const blobUrl = URL.createObjectURL(new Blob([renderSvg], { type: "image/svg+xml" }));
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The badge artwork could not be rendered."));
      image.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not supported in this browser.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (layout.slices.length > 0) {
    layout.slices.forEach((slice) => {
      context.drawImage(
        image,
        slice.x,
        0,
        slice.width,
        height,
        slice.gridX,
        0,
        slice.gridWidth,
        rows,
      );
    });
  } else {
    context.drawImage(image, 0, 0, columns, rows);
  }
  const pixels = context.getImageData(0, 0, columns, rows).data;
  const textPixels = renderProFont(
    layout.textRuns,
    columns,
    rows,
    width,
    height,
    textVerticalOffset,
  );
  const logoPixels = await renderLogoPixels(
    logos,
    layout.slices,
    columns,
    rows,
    width,
    height,
    logoVerticalOffset,
  );
  const paletteColors = sourcePalette(paletteSvg);
  logoPixels.forEach((pixel) => {
    if (!pixel) return;
    const color = rgbToHex(pixel);
    if (!paletteColors.includes(color)) paletteColors.push(color);
  });
  if (!paletteColors.length) paletteColors.push("#555555", "#ffffff");
  const paletteRgb = paletteColors.map(hexToRgb);
  const cells: Array<string | null> = [];
  const counts = new Map<string, number>();

  for (let index = 0; index < pixels.length; index += 4) {
    const cellIndex = index / 4;
    const textPixel = textPixels[cellIndex];
    const logoPixel = logoPixels[cellIndex];
    if (!textPixel && !logoPixel && pixels[index + 3] < 80) {
      cells.push(null);
      continue;
    }
    const source = textPixel ?? logoPixel
      ?? { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] };
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    paletteRgb.forEach((candidate, candidateIndex) => {
      const distance = colorDistance(source, candidate);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = candidateIndex;
      }
    });
    const color = paletteColors[closestIndex].toLowerCase();
    cells.push(color);
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  const colors = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([color, count], index) => ({ color, count, name: readableColorName(index) }));
  return { columns, rows, cells, colors, beadCount: cells.filter(Boolean).length };
}

function paintBeads(
  context: CanvasRenderingContext2D,
  pattern: Pattern,
  cellSize: number,
  originX = cellSize / 2,
  originY = cellSize / 2,
) {
  pattern.cells.forEach((color, index) => {
    if (!color) return;
    const column = index % pattern.columns;
    const row = Math.floor(index / pattern.columns);
    const x = originX + column * cellSize;
    const y = originY + row * cellSize;
    const radius = cellSize * 0.43;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, cellSize * 0.12, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawPattern(canvas: HTMLCanvasElement, pattern: Pattern, cellSize = 34) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = pattern.columns * cellSize * ratio;
  canvas.height = pattern.rows * cellSize * ratio;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, pattern.columns * cellSize, pattern.rows * cellSize);
  paintBeads(context, pattern, cellSize);
}

function drawPreview(
  canvas: HTMLCanvasElement,
  pattern: Pattern,
  width: number,
  height: number,
) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  const inset = 2;
  const cellSize = Math.min(
    (width - inset * 2) / (pattern.columns + 2),
    (height - inset * 2) / (pattern.rows + 2),
  );
  let gridColumns = Math.max(
    pattern.columns,
    Math.floor((width - inset * 2) / cellSize) - 1,
  );
  let gridRows = Math.max(
    pattern.rows,
    Math.floor((height - inset * 2) / cellSize) - 1,
  );
  if ((gridColumns - pattern.columns) % 2 !== 0) gridColumns -= 1;
  if ((gridRows - pattern.rows) % 2 !== 0) gridRows -= 1;

  const frameWidth = (gridColumns + 1) * cellSize;
  const frameHeight = (gridRows + 1) * cellSize;
  const frameLeft = (width - frameWidth) / 2;
  const frameTop = (height - frameHeight) / 2;
  const firstDotX = frameLeft + cellSize;
  const firstDotY = frameTop + cellSize;
  const patternOffsetX = (gridColumns - pattern.columns) / 2;
  const patternOffsetY = (gridRows - pattern.rows) / 2;
  const originX = firstDotX + patternOffsetX * cellSize;
  const originY = firstDotY + patternOffsetY * cellSize;

  context.fillStyle = "rgba(92, 81, 68, .3)";
  for (let row = 0; row < gridRows; row += 1) {
    for (let column = 0; column < gridColumns; column += 1) {
      const x = firstDotX + column * cellSize;
      const y = firstDotY + row * cellSize;
      context.beginPath();
      context.arc(x, y, Math.max(0.75, cellSize * 0.055), 0, Math.PI * 2);
      context.fill();
    }
  }

  paintBeads(context, pattern, cellSize, originX, originY);
}

function patternSvg(pattern: Pattern) {
  const size = 24;
  const circles = pattern.cells.map((color, index) => {
    if (!color) return "";
    const x = (index % pattern.columns) * size + size / 2;
    const y = Math.floor(index / pattern.columns) * size + size / 2;
    return `<path d="M ${x - 10.5} ${y}a 10.5 10.5 0 1 0 21 0a 10.5 10.5 0 1 0-21 0M ${x - 2.9} ${y}a 2.9 2.9 0 1 0 5.8 0a 2.9 2.9 0 1 0-5.8 0" fill="${color}" fill-rule="evenodd"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pattern.columns * size} ${pattern.rows * size}" width="${pattern.columns * size}" height="${pattern.rows * size}">${circles}</svg>`;
}

function patternCsv(pattern: Pattern) {
  const lines = Array.from({ length: pattern.rows }, (_, row) => {
    const start = row * pattern.columns;
    return pattern.cells
      .slice(start, start + pattern.columns)
      .map((color) => color ?? "")
      .join(",");
  });
  return lines.join("\r\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BeadLogo() {
  const colors = ["#f27059", "#f9dc5c", "#67d5b5", "#8a5cf5", "#1597bb"];
  return <span className="bead-logo" aria-hidden="true">{colors.map((color, index) => <i key={color} style={{ "--bead": color, "--i": index } as React.CSSProperties} />)}</span>;
}

export function BeadgridApp() {
  const [initialBadgeUrl] = useState(() => (
    new URLSearchParams(window.location.search).get("badgeUrl")?.trim() || DEFAULT_URL
  ));
  const [input, setInput] = useState(initialBadgeUrl);
  const [activeUrl, setActiveUrl] = useState(initialBadgeUrl);
  const [shareFeedback, setShareFeedback] = useState({ url: "", message: "" });
  const shareMessage = shareFeedback.url === input ? shareFeedback.message : "";
  const [badgeSource, setBadgeSource] = useState<{ svg: string } | null>(null);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [textVerticalOffset, setTextVerticalOffset] = useState(0);
  const [logoVerticalOffset, setLogoVerticalOffset] = useState(0);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ColorTheme>(() => {
    const savedTheme = window.localStorage.getItem("badge-beadgrid-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system";
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pegboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#1f1b19" : "#f7f2e8",
      );
    };
    applyTheme();
    window.localStorage.setItem("badge-beadgrid-theme", theme);
    if (theme === "system") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const loadBadge = useCallback(async (requestedUrl: string) => {
    setStatus("loading");
    setError("");
    try {
      const result = await fetchBadgeSvg(requestedUrl);
      setBadgeSource(result);
      setActiveUrl(result.url);
      setStatus("crafting");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The badge could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("badgeUrl")) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.hash,
      );
    }
    let current = true;
    void fetchBadgeSvg(initialBadgeUrl)
      .then((result) => {
        if (!current) return;
        setBadgeSource(result);
        setActiveUrl(result.url);
        setStatus("crafting");
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "The badge could not be loaded.");
      });
    return () => { current = false; };
  }, [initialBadgeUrl]);

  useEffect(() => {
    if (shareFeedback.message !== "Link copied!") return;
    const timeout = window.setTimeout(
      () => setShareFeedback({ url: "", message: "" }),
      2000,
    );
    return () => window.clearTimeout(timeout);
  }, [shareFeedback]);

  useEffect(() => {
    if (!badgeSource) return;
    let current = true;
    // Each successful fetch creates a new source, even when its SVG is unchanged.
    void makePattern(badgeSource.svg, rows, textVerticalOffset, logoVerticalOffset)
      .then((nextPattern) => {
        if (!current) return;
        setPattern(nextPattern);
        setStatus("ready");
        setError("");
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "The pattern could not be created.");
      });
    return () => { current = false; };
  }, [badgeSource, rows, textVerticalOffset, logoVerticalOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pegboard = pegboardRef.current;
    if (!canvas || !pegboard || !pattern) return;
    let animationFrame = 0;
    let previousWidth = -1;
    let previousHeight = -1;
    const redraw = () => {
      const bounds = pegboard.getBoundingClientRect();
      if (
        Math.abs(bounds.width - previousWidth) < 0.5
        && Math.abs(bounds.height - previousHeight) < 0.5
      ) return;
      previousWidth = bounds.width;
      previousHeight = bounds.height;
      drawPreview(canvas, pattern, bounds.width, bounds.height);
    };
    redraw();
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(redraw);
    });
    observer.observe(pegboard);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [pattern, theme]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void loadBadge(input.trim());
  };

  const copyShareableLink = async () => {
    try {
      const parsed = new URL(input.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("Invalid protocol");
    } catch {
      setShareFeedback({ url: input, message: "Enter an HTTP or HTTPS badge URL to share." });
      return;
    }
    const shareUrl = new URL(window.location.pathname, window.location.origin);
    shareUrl.searchParams.set("badgeUrl", input.trim());
    try {
      await navigator.clipboard.writeText(shareUrl.href);
      setShareFeedback({ url: input, message: "Link copied!" });
    } catch {
      setShareFeedback({ url: input, message: "Unable to copy. Please try again." });
    }
  };

  const chooseExample = (url: string) => {
    setInput(url);
    void loadBadge(url);
  };

  const exportPng = () => {
    if (!pattern) return;
    const exportCanvas = document.createElement("canvas");
    drawPattern(exportCanvas, pattern, 42);
    exportCanvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `badge-beadgrid-${pattern.columns}x${pattern.rows}.png`);
    }, "image/png");
  };

  const exportSvg = () => {
    if (!pattern) return;
    downloadBlob(new Blob([patternSvg(pattern)], { type: "image/svg+xml" }), `badge-beadgrid-${pattern.columns}x${pattern.rows}.svg`);
  };

  const exportCsv = () => {
    if (!pattern) return;
    downloadBlob(
      new Blob([patternCsv(pattern)], { type: "text/csv;charset=utf-8" }),
      `badge-beadgrid-${pattern.columns}x${pattern.rows}.csv`,
    );
  };

  const colorSummary = useMemo(() => pattern?.colors ?? [], [pattern]);
  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Badge Beadgrid home"><BeadLogo /><span>Badge<br /><b>Beadgrid</b></span></a>
        <p>BADGES, MADE BEAD BY BEAD.</p>
        <div className="header-actions">
          <div className="theme-switcher" role="group" aria-label="Color theme">
            <button type="button" className={theme === "system" ? "selected system" : "system"} onClick={() => setTheme("system")} title="Use system theme"><Monitor size={13} /><span>SYSTEM</span></button>
            <button type="button" className={theme === "light" ? "selected light" : "light"} onClick={() => setTheme("light")} title="Use light theme"><Sun size={13} /><span>LIGHT</span></button>
            <button type="button" className={theme === "dark" ? "selected dark" : "dark"} onClick={() => setTheme("dark")} title="Use dark theme"><Moon size={13} /><span>DARK</span></button>
          </div>
          <a className="github-link" href="https://github.com/LitoMore/badge-beadgrid" target="_blank" rel="noreferrer"><Code2 size={18} /><span>GITHUB</span></a>
        </div>
      </header>

      <section className="workbench">
        <div className="input-panel panel">
          <div className="source-intro">
            <div className="panel-heading"><span><small>START WITH A BADGE</small><b>Shields.io source</b></span></div>
            <p>Paste a badge URL and turn its original colors into a fuse-bead pattern.</p>
          </div>
          <form className="badge-form" onSubmit={submit}>
            <div className="url-label-row">
              <label htmlFor="badge-url">YOUR SHIELDS.IO BADGE URL</label>
            </div>
            <div className="url-control">
              <input id="badge-url" value={input} onChange={(event) => setInput(event.target.value)} spellCheck="false" aria-describedby={error ? "url-error" : undefined} />
              <button type="submit" disabled={status === "loading" || status === "crafting"}>
                <span aria-live="polite">{status === "loading" ? "FETCHING" : status === "crafting" ? "CRAFTING" : "MAKE IT"}</span>
                {status === "loading" || status === "crafting" ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <ChevronRight size={19} aria-hidden="true" />}
              </button>
            </div>
            <div className="form-meta">
              <div className="examples"><span>TRY ONE:</span>{EXAMPLES.map(([label, url]) => <button key={label} type="button" className={activeUrl === url ? "active" : ""} onClick={() => chooseExample(url)}>{label}</button>)}</div>
              <div className="share-link-row">
                <button
                  type="button"
                  onClick={copyShareableLink}
                  disabled={!input.trim()}
                  aria-describedby={shareMessage ? "share-feedback" : undefined}
                >
                  {shareMessage === "Link copied!" ? (
                    <Check aria-hidden="true" size={12} />
                  ) : shareMessage ? (
                    <TriangleAlert aria-hidden="true" size={12} />
                  ) : (
                    <Link aria-hidden="true" size={12} />
                  )}
                  Copy shareable link
                </button>
                {shareMessage && shareMessage !== "Link copied!" && (
                  <div className="share-tooltip" role="tooltip">{shareMessage}</div>
                )}
              </div>
            </div>
            <div className="share-feedback" id="url-error" role="alert">{error}</div>
            <div id="share-feedback" className="share-feedback" role="status">{shareMessage}</div>
          </form>
        </div>

        <div className="preview-panel panel">
          <div className="panel-heading preview-heading">
            <div><span><small>YOUR PATTERN</small><b>Beadboard preview</b></span></div>
            {error ? (
              <div className="preview-error">
                <button type="button" aria-label="Badge error details" aria-describedby="url-error">
                  <TriangleAlert size={15} aria-hidden="true" />
                  <span>{error}</span>
                </button>
                <div className="preview-error-tooltip" role="tooltip">{error}</div>
              </div>
            ) : pattern && <span className="grid-size"><Grid3X3 size={14} /> {pattern.columns} × {pattern.rows} GRID</span>}
          </div>
          <div className="pegboard-wrap">
            <div className="pegboard" ref={pegboardRef}>
              {pattern ? <canvas ref={canvasRef} aria-label={`Fuse bead pattern with ${pattern.beadCount} beads`} /> : <div className="preview-empty"><LoaderCircle className="spin" /><span>PLACING BEADS…</span></div>}
            </div>
            <div className="board-note"><span /><span>Each circle = one 5 mm bead</span><span /></div>
          </div>
        </div>

        <aside className="tools-panel panel">
          <div className="tool-group settings-group">
            <div className="panel-heading">
              <div><span><small>MAKE IT YOURS</small><b>Pattern settings</b></span></div>
              <button className="icon-button" type="button" title="Reset settings" onClick={() => { setRows(DEFAULT_ROWS); setTextVerticalOffset(0); setLogoVerticalOffset(0); }}><RefreshCcw size={15} /></button>
            </div>
            <div className="settings-grid">
              <div className="setting-block">
                <label htmlFor="detail"><span>DETAIL</span><output>{rows} rows</output></label>
                <input id="detail" type="range" min="12" max="32" value={rows} onChange={(event) => setRows(Number(event.target.value))} style={{ "--progress": `${((rows - 12) / 20) * 100}%` } as React.CSSProperties} />
                <div className="range-ends"><span>chunky</span><span>detailed</span></div>
              </div>
              <div className="setting-block offset-settings-block">
                <div className="offset-setting-row">
                  <span>TEXT</span>
                  <div className="offset-control" role="group" aria-label="Adjust text vertical position">
                    <button
                      type="button"
                      onClick={() => setTextVerticalOffset((offset) => Math.max(-6, offset - 1))}
                      disabled={textVerticalOffset <= -6}
                      aria-label="Move all text up one unit"
                      title="Move all text up one unit"
                    ><ArrowUp size={14} /></button>
                    <strong aria-live="polite">{textVerticalOffset > 0 ? `+${textVerticalOffset}` : textVerticalOffset}</strong>
                    <button
                      type="button"
                      onClick={() => setTextVerticalOffset((offset) => Math.min(6, offset + 1))}
                      disabled={textVerticalOffset >= 6}
                      aria-label="Move all text down one unit"
                      title="Move all text down one unit"
                    ><ArrowDown size={14} /></button>
                  </div>
                </div>
                <div className="offset-setting-row">
                  <span>LOGO</span>
                  <div className="offset-control" role="group" aria-label="Adjust logo vertical position">
                    <button
                      type="button"
                      onClick={() => setLogoVerticalOffset((offset) => Math.max(-6, offset - 1))}
                      disabled={logoVerticalOffset <= -6}
                      aria-label="Move the logo up one unit"
                      title="Move the logo up one unit"
                    ><ArrowUp size={14} /></button>
                    <strong aria-live="polite">{logoVerticalOffset > 0 ? `+${logoVerticalOffset}` : logoVerticalOffset}</strong>
                    <button
                      type="button"
                      onClick={() => setLogoVerticalOffset((offset) => Math.min(6, offset + 1))}
                      disabled={logoVerticalOffset >= 6}
                      aria-label="Move the logo down one unit"
                      title="Move the logo down one unit"
                    ><ArrowDown size={14} /></button>
                  </div>
                </div>
                <div className="offset-note">1 row / step</div>
              </div>
            </div>
            <div className="bead-style-note"><i /><span><b>Original badge colors</b><small>Solid beads with a hollow center</small></span></div>
          </div>

          <div className="tool-group colors-group">
            <div className="tool-label"><span>SOURCE COLORS</span><b>{pattern?.colors.length ?? 0} colors · {pattern?.beadCount.toLocaleString() ?? 0} beads</b></div>
            <div className="color-list">
              {colorSummary.map((item) => <div className="color-row" key={item.color}><i style={{ background: item.color }} /><span><b>{item.name}</b><small>{item.color.toUpperCase()}</small></span><strong>{item.count}</strong></div>)}
            </div>
          </div>

          <div className="tool-group export-group">
            <div className="panel-heading"><div><span><small>TAKE IT WITH YOU</small><b>Save your pattern</b></span></div></div>
            <button className="download-main" type="button" onClick={exportPng} disabled={!pattern}><ImageDown size={20} /><span><b>DOWNLOAD PNG</b><small>TRANSPARENT · HIGH RES</small></span><Download size={17} /></button>
            <div className="export-secondary">
              <button type="button" onClick={exportSvg} disabled={!pattern}>SVG <span>VECTOR</span></button>
              <button type="button" onClick={exportCsv} disabled={!pattern}>CSV <span>GRID</span></button>
              <a href={activeUrl} target="_blank" rel="noreferrer">ORIGINAL <ExternalLink size={13} /></a>
            </div>
          </div>
        </aside>
      </section>

      <footer>
        <span>Crafted and maintained with <span className="footer-bead" aria-label="love" /> by <a href="https://github.com/LitoMore">LitoMore</a>, a member of the <a href="https://shields.io">Shields.io</a> team.</span>
        <span>Like badges? Check out another fun project - <a href="https://3d.shields.io" target="_blank" rel="noreferrer">Badge<span className="badge3d-accent">3D</span></a>.</span>
      </footer>
    </main>
  );
}
