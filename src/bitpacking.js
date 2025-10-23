// node >=14
const zlib = require("zlib");

// ======== Public API ========

function encodeToBase64UrlGzip(items) {
  const raw = encodeRawBitPacked(items);
  const gz = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
  return toBase64Url(gz);
}

function decodeFromBase64UrlGzip(token) {
  const gz = fromBase64Url(token);
  const raw = zlib.gunzipSync(gz);
  return decodeRawBitPacked(raw);
}

// ======== Bit-tight encoding (Option B) ========

const BASE_ID = 30_000_000;

function encodeRawBitPacked(items) {
  let maxOffset = 0;
  for (const { Id, Type } of items) {
    const off = Id - BASE_ID;
    if (off < 0) throw new Error("Id < BaseId");
    if (off > maxOffset) maxOffset = off;
  }
  let k = Math.max(1, 32 - Math.clz32(maxOffset >>> 0));

  // Header: [1][k][count u16 BE]
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

function decodeRawBitPacked(buf) {
  if (buf.length < 4) throw new Error("Too short");
  if (buf[0] !== 1) throw new Error("Unsupported version");
  const k = buf[1];
  if (k <= 0 || k > 30) throw new Error("Invalid k");

  const count = buf.readUInt16BE(2);
  const br = new BitReader(buf.subarray(4));

  const items = [];
  for (let i = 0; i < count; i++) {
    const off = br.readBits(k) >>> 0;
    const type = br.readBits(2) >>> 0;
    items.push({ Id: BASE_ID + off, Type: type });
  }
  return items;
}

// ======== Helpers: Bit I/O ========

class BitWriter {
  constructor() {
    this._bytes = [];
    this._cur = 0;
    this._bits = 0; // number of bits currently in _cur (0..8)
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

class BitReader {
  constructor(buf) {
    this._buf = buf;
    this._i = 0;
    this._cur = 0;
    this._bits = 0; // bits remaining in _cur (0..8)
  }
  readBits(bitCount) {
    let v = 0 >>> 0;
    for (let i = 0; i < bitCount; i++) {
      if (this._bits === 0) {
        if (this._i >= this._buf.length) throw new Error("Unexpected EOF");
        this._cur = this._buf[this._i++];
        this._bits = 8;
      }
      const msb = (this._cur & 0x80) ? 1 : 0;
      v = (v << 1) | msb;
      this._cur = (this._cur << 1) & 0xff;
      this._bits--;
    }
    return v >>> 0;
  }
}

// ======== Helpers: base64url ========

function toBase64Url(buf) {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromBase64Url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  return Buffer.from(s, "base64");
}

module.exports = { encodeToBase64UrlGzip, decodeFromBase64UrlGzip };
