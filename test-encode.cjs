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

const waypoints = [
  {Id: 30000142, Type: 1},
  {Id: 30002187, Type: 0},
  {Id: 30000144, Type: 1}
];

const raw = encodeRawBitPacked(waypoints);
const gz = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
const token = toBase64Url(gz);

console.log('Valid token:', token);
