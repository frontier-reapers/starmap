using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;

public static class UrlBitPack
{
    private const int BaseId = 30_000_000;

    // ======== Public API ========

    public static string EncodeToBase64UrlGzip(IReadOnlyList<(int Id, int Type)> items)
    {
        var raw = EncodeRawBitPacked(items);
        var gz = Gzip(raw);
        return ToBase64Url(gz);
    }

    public static List<(int Id, int Type)> DecodeFromBase64UrlGzip(string base64Url)
    {
        var gz = FromBase64Url(base64Url);
        var raw = Gunzip(gz);
        return DecodeRawBitPacked(raw);
    }

    // ======== Bit-tight encoding (Option B) ========

    private static byte[] EncodeRawBitPacked(IReadOnlyList<(int Id, int Type)> items)
    {
        // compute k
        int maxOffset = 0;
        foreach (var (Id, _) in items)
        {
            int off = Id - BaseId;
            if (off < 0) throw new ArgumentOutOfRangeException(nameof(items), "Id < BaseId");
            if (off > maxOffset) maxOffset = off;
        }
        int k = Math.Max(1, 32 - BitOperations.LeadingZeroCount((uint)maxOffset)); // ceil(log2(maxOffset+1))

        using var ms = new MemoryStream();

        // header: [version=1][k][count u16 BE]
        ms.WriteByte(1);
        ms.WriteByte((byte)k);
        Span<byte> hdr = stackalloc byte[2];
        BinaryPrimitives.WriteUInt16BigEndian(hdr, (ushort)items.Count);
        ms.Write(hdr);

        var bw = new BitWriter(ms);
        foreach (var (Id, Type) in items)
        {
            int off = Id - BaseId;
            bw.WriteBits((uint)off, k);
            bw.WriteBits((uint)(Type & 0b11), 2);
        }
        bw.FlushFinalByte();

        return ms.ToArray();
    }

    private static List<(int Id, int Type)> DecodeRawBitPacked(byte[] data)
    {
        if (data.Length < 4) throw new FormatException("Too short");
        if (data[0] != 1) throw new FormatException("Unsupported version");

        int k = data[1];
        if (k <= 0 || k > 30) throw new FormatException("Invalid k");

        ushort count = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(2, 2));
        var items = new List<(int Id, int Type)>(count);

        using var ms = new MemoryStream(data, 4, data.Length - 4, writable: false);
        var br = new BitReader(ms);

        for (int i = 0; i < count; i++)
        {
            uint off = br.ReadBits(k);
            uint type = br.ReadBits(2);
            items.Add((BaseId + (int)off, (int)type));
        }

        return items;
    }

    // ======== Helpers: Bit I/O ========

    private sealed class BitWriter
    {
        private readonly Stream _s;
        private int _bitPos = 8; // when 8 => empty
        private byte _cur;

        public BitWriter(Stream s) => _s = s;

        // Writes 'bitCount' bits from 'value', MSB-first.
        public void WriteBits(uint value, int bitCount)
        {
            for (int i = bitCount - 1; i >= 0; i--)
            {
                int bit = (int)((value >> i) & 1);
                if (_bitPos == 8) { _cur = 0; _bitPos = 0; }
                _cur = (byte)((_cur << 1) | bit);
                _bitPos++;
                if (_bitPos == 8)
                {
                    _s.WriteByte(_cur);
                    _bitPos = 8;
                }
            }
        }

        public void FlushFinalByte()
        {
            if (_bitPos > 0 && _bitPos < 8)
            {
                _cur = (byte)(_cur << (8 - _bitPos));
                _s.WriteByte(_cur);
                _bitPos = 8;
            }
        }
    }

    private sealed class BitReader
    {
        private readonly Stream _s;
        private int _bitsLeft = 0;
        private int _cur = 0;

        public BitReader(Stream s) => _s = s;

        // Reads 'bitCount' bits, MSB-first, returns as uint.
        public uint ReadBits(int bitCount)
        {
            uint v = 0;
            for (int i = 0; i < bitCount; i++)
            {
                if (_bitsLeft == 0)
                {
                    int b = _s.ReadByte();
                    if (b < 0) throw new EndOfStreamException();
                    _cur = b;
                    _bitsLeft = 8;
                }
                int msb = (_cur & 0x80) != 0 ? 1 : 0;
                v = (v << 1) | (uint)msb;
                _cur = (_cur << 1) & 0xFF;
                _bitsLeft--;
            }
            return v;
        }
    }

    // ======== Helpers: gzip + base64url ========

    private static byte[] Gzip(byte[] input)
    {
        using var ms = new MemoryStream();
        using (var gz = new GZipStream(ms, CompressionLevel.SmallestSize, leaveOpen: true))
            gz.Write(input, 0, input.Length);
        return ms.ToArray();
    }

    private static byte[] Gunzip(byte[] input)
    {
        using var src = new MemoryStream(input);
        using var gz = new GZipStream(src, CompressionMode.Decompress);
        using var dst = new MemoryStream();
        gz.CopyTo(dst);
        return dst.ToArray();
    }

    private static string ToBase64Url(byte[] data)
        => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string s)
    {
        string b64 = s.Replace('-', '+').Replace('_', '/');
        switch (b64.Length % 4) { case 2: b64 += "=="; break; case 3: b64 += "="; break; }
        return Convert.FromBase64String(b64);
    }
}
