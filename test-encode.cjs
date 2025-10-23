const zlib = require("zlib");

const BASE_ID = 30_000_000;

function encodeRawBitPacked(items) {
  let maxOffset = 0;
  for (const { Id, Type } of items) {
    const off = Id - BASE_ID;
    if (off < 0) throw new Error("Id < BaseId");
    if (off > maxOffset) maxOffset = off;
  }
  let k = Math.max(1, 32 - Math.clz32(maxOffset >>> 0));

  const header = Buffer.alloc(4);
  header[0] = 1;
  header[1] = k;
  header.writeUInt16BE(items.length, 2);

  const bw = new BitWriter();
  for (const { Id, Type } of items) {
    const off = Id - BASE_ID;
    bw.writeBits(off >>> 0, k);
    bw.writeBits(Type & 0b11, 2);
  }
  const payload = bw.finish();

  return Buffer.concat([header, payload]);
}

class BitWriter {
  constructor() {
    this._bytes = [];
    this._cur = 0;
    this._bits = 0;
  }
  writeBits(value, bitCount) {
    for (let i = bitCount - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      this._cur = (this._cur << 1) | bit;
      this._bits++;
      if (this._bits === 8) {
        this._bytes.push(this._cur);
        this._cur = 0;
        this._bits = 0;
      }
    }
  }
  finish() {
    if (this._bits > 0) {
      this._cur = this._cur << (8 - this._bits);
      this._bytes.push(this._cur & 0xff);
      this._cur = 0;
      this._bits = 0;
    }
    return Buffer.from(this._bytes);
  }
}

function toBase64Url(buf) {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// Test route 1: Simple 3 waypoints
const waypoints1 = [
  {Id: 30000142, Type: 1},
  {Id: 30002187, Type: 0},
  {Id: 30000144, Type: 1}
];

const raw1 = encodeRawBitPacked(waypoints1);
const gz1 = zlib.gzipSync(raw1, { level: zlib.constants.Z_BEST_COMPRESSION });
const token1 = toBase64Url(gz1);

console.log('Simple 3-waypoint route token:', token1);
console.log('');

// Test route 2: User-provided 17 waypoint route from Strym
const waypoints2 = [
  {Id: 30009542, Type: 0},  // Strym - Start
  {Id: 30009551, Type: 2},  // Z:2V39 - NPC Gate
  {Id: 30009547, Type: 2},  // Q:374K - NPC Gate
  {Id: 30009538, Type: 2},  // Mandr - NPC Gate
  {Id: 30009554, Type: 2},  // G:2TV3 - NPC Gate
  {Id: 30009555, Type: 2},  // G:34SV - NPC Gate
  {Id: 30009557, Type: 2},  // Q:13N6 - NPC Gate
  {Id: 30009570, Type: 2},  // U:39A3 - NPC Gate
  {Id: 30009569, Type: 2},  // Z:3N5K - NPC Gate
  {Id: 30009571, Type: 2},  // B:37EI - NPC Gate
  {Id: 30009302, Type: 1},  // OKK-0PH - Jump
  {Id: 30009299, Type: 1},  // I4F-MCH - Jump
  {Id: 30009301, Type: 1},  // OCC-L8H - Jump
  {Id: 30009297, Type: 1},  // EBG-P8H - Jump
  {Id: 30009260, Type: 2},  // E4N-48H - NPC Gate
  {Id: 30009263, Type: 2},  // IVK-HJH - NPC Gate
  {Id: 30011605, Type: 1},  // IGJ-PSH - Jump
];

const raw2 = encodeRawBitPacked(waypoints2);
const gz2 = zlib.gzipSync(raw2, { level: zlib.constants.Z_BEST_COMPRESSION });
const token2 = toBase64Url(gz2);

console.log('17-waypoint Strym route token:', token2);
console.log('Token length:', token2.length);
console.log('Gzipped size:', gz2.length, 'bytes');
console.log('Uncompressed size:', raw2.length, 'bytes');
console.log('');
console.log('Test URL:');
console.log(`http://localhost:3000/public/?debug=true&route=${token2}`);
