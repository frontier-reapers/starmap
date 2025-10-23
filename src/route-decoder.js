/**
 * Browser-compatible bitpacking decoder for route data
 * Decodes base64url-gzipped route tokens into {Id, Type} waypoints
 */

const BASE_ID = 30_000_000;

// ======== Public API ========

/**
 * Decode a base64url-gzipped route token
 * @param {string} token - Base64url encoded gzipped route data
 * @returns {Promise<Array<{Id: number, Type: number}>>} Array of waypoints
 */
export async function decodeRouteToken(token) {
  try {
    const gz = fromBase64Url(token);
    const raw = await gunzip(gz);
    return decodeRawBitPacked(raw);
  } catch (err) {
    // Provide more specific error messages
    if (err.message && err.message.includes('invalid code lengths')) {
      throw new Error('Route token contains corrupted gzip data. The token may be incomplete or damaged.');
    } else if (err.message && err.message.includes('incorrect header check')) {
      throw new Error('Route token has invalid gzip header. Ensure the token is copied completely.');
    } else if (err.message && err.message.includes('DecompressionStream')) {
      throw new Error('Browser does not support route decompression. Please use a modern browser (Chrome 80+, Firefox 113+, Safari 16.4+).');
    }
    // Re-throw with original message if we don't recognize it
    throw new Error(`Failed to decode route token: ${err.message}`);
  }
}

// ======== Bit-tight decoding ========

function decodeRawBitPacked(buf) {
  if (buf.length < 4) throw new Error('Route data too short');
  
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  
  if (buf[0] !== 1) throw new Error('Unsupported route version');
  const k = buf[1];
  if (k <= 0 || k > 30) throw new Error('Invalid route bit width');

  const count = view.getUint16(2, false); // big-endian
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
        if (this._i >= this._buf.length) throw new Error('Unexpected EOF in route data');
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

function fromBase64Url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  
  // Decode base64 to binary string
  const binaryString = atob(s);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ======== Helpers: gzip decompression ========

/**
 * Decompress gzip data using browser DecompressionStream API
 * @param {Uint8Array} gzData - Gzipped data
 * @returns {Promise<Uint8Array>} Decompressed data
 */
async function gunzip(gzData) {
  // Use DecompressionStream API (available in modern browsers)
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not supported in this browser');
  }
  
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(gzData);
      controller.close();
    }
  });
  
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressedStream.getReader();
  const chunks = [];
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  // Concatenate all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

// ======== Waypoint type labels ========

export const WAYPOINT_TYPES = {
  0: 'Start',
  1: 'Jump',
  2: 'NPC Gate',
  3: 'Smart Gate',
  4: 'Set Destination'
};

export function getWaypointTypeLabel(type) {
  return WAYPOINT_TYPES[type] || 'Unknown';
}
