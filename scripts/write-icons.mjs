import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const INK = [63, 42, 29, 255];
const PAPER = [246, 241, 232, 255];
const COPPER = [154, 67, 24, 255];

export function writeIcons(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    fs.writeFileSync(path.join(directory, `icon${size}.png`), png(size, draw(size)));
  }
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  const radius = Math.max(2, Math.round(size * 0.22));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!insideRoundRect(x, y, size, radius)) continue;
      set(pixels, size, x, y, INK);
    }
  }
  const margin = Math.round(size * 0.28);
  const thickness = Math.max(1, Math.round(size * 0.08));
  for (let i = 0; i < 3; i += 1) {
    const y = margin + i * Math.round((size - margin * 2) / 2.4);
    for (let t = 0; t < thickness; t += 1) {
      for (let x = margin; x < size - margin; x += 1) {
        const yy = Math.min(size - 1, y + t);
        set(pixels, size, x, yy, i === 0 ? COPPER : PAPER);
      }
    }
  }
  return pixels;
}

function insideRoundRect(x, y, size, radius) {
  const max = size - 1;
  const dx = x < radius ? radius - x : x > max - radius ? x - (max - radius) : 0;
  const dy = y < radius ? radius - y : y > max - radius ? y - (max - radius) : 0;
  return dx * dx + dy * dy <= radius * radius;
}

function set(pixels, size, x, y, color) {
  const offset = (y * size + x) * 4;
  pixels.set(color, offset);
}

function png(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ~crc >>> 0;
}
