/**
 * A minimal MP4 box reader — just enough to answer "how long is this video and
 * how big is the picture?" without shipping ffmpeg to a Vercel function.
 *
 * Why this exists (MEDIA.md §3 G8): today the only thing standing between a
 * user and an arbitrarily long upload is a BYTE cap. A 50MB ten-minute video at
 * a low bitrate sails straight through. Bytes are not duration, and the 120s
 * product cap has to be enforced on the thing it is actually about.
 *
 * Why not just believe the client: the duration the app reports is an
 * attacker-controlled number in a JSON body. This reads it out of the file.
 *
 * Scope: ISO-BMFF (MP4/MOV/M4V), which is what both platforms produce and the
 * only container our upload allowlist admits for the composer path. Deliberately
 * NOT a general-purpose demuxer -- it walks the box tree for `mvhd` (duration)
 * and the first video `tkhd` (dimensions) and ignores everything else.
 */

const MOOV = 0x6d6f6f76; // 'moov'
const MVHD = 0x6d766864; // 'mvhd'
const TRAK = 0x7472616b; // 'trak'
const TKHD = 0x746b6864; // 'tkhd'

export type Mp4Header = {
  durationMs: number;
  width: number;
  height: number;
};

/**
 * Walks the boxes in `buf` between [start, end) looking for `moov`, then reads
 * `mvhd` and the largest `tkhd` inside it.
 *
 * Returns null when the moov atom is not present in the bytes given -- which is
 * a real and expected outcome, not an error: a file that was not written with
 * `faststart` keeps moov at the END, so the caller is expected to retry with a
 * tail range before giving up. See MEDIA.md §7.2 (the client is required to
 * produce faststart output, so the head read is the fast path).
 */
export function parseMp4Header(buf: Buffer): Mp4Header | null {
  const moov = findBox(buf, 0, buf.length, MOOV);
  if (!moov) return null;

  const mvhd = findBox(buf, moov.start, moov.end, MVHD);
  if (!mvhd) return null;

  const durationMs = readMvhdDurationMs(buf, mvhd.start);
  if (durationMs === null) return null;

  // Dimensions come from the video track. An MP4 typically carries an audio
  // trak too, whose tkhd reports 0x0 -- taking the largest non-zero pair is the
  // cheap way to pick the video one without parsing hdlr.
  let width = 0;
  let height = 0;
  let cursor = moov.start;
  while (cursor < moov.end) {
    const trak = findBox(buf, cursor, moov.end, TRAK);
    if (!trak) break;
    const tkhd = findBox(buf, trak.start, trak.end, TKHD);
    if (tkhd) {
      const dims = readTkhdDimensions(buf, tkhd.start);
      if (dims && dims.width * dims.height > width * height) {
        width = dims.width;
        height = dims.height;
      }
    }
    cursor = trak.end;
  }

  return { durationMs, width, height };
}

/** Box header: 4-byte big-endian size, 4-byte type. Size 1 means a 64-bit size follows. */
function findBox(
  buf: Buffer,
  from: number,
  to: number,
  type: number
): { start: number; end: number } | null {
  let offset = from;
  while (offset + 8 <= to) {
    let size = buf.readUInt32BE(offset);
    const boxType = buf.readUInt32BE(offset + 4);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > to) return null;
      // 64-bit sizes only matter for mdat (the media payload), which we never
      // descend into. Reading the low word is safe for anything we care about
      // and avoids a BigInt for a box we are about to skip anyway.
      const high = buf.readUInt32BE(offset + 8);
      const low = buf.readUInt32BE(offset + 12);
      if (high > 0) return null; // >4GB box: not something we parse
      size = low;
      headerSize = 16;
    } else if (size === 0) {
      // "extends to end of file"
      size = to - offset;
    }

    if (size < headerSize) return null; // malformed; refuse rather than loop
    const end = Math.min(offset + size, to);
    if (boxType === type) return { start: offset + headerSize, end };
    offset += size;
  }
  return null;
}

/**
 * mvhd payload: version(1) flags(3), then creation/modification times,
 * timescale, duration. v0 uses 32-bit times, v1 uses 64-bit.
 */
function readMvhdDurationMs(buf: Buffer, start: number): number | null {
  if (start + 4 > buf.length) return null;
  const version = buf.readUInt8(start);

  if (version === 0) {
    if (start + 20 > buf.length) return null;
    const timescale = buf.readUInt32BE(start + 12);
    const duration = buf.readUInt32BE(start + 16);
    if (!timescale) return null;
    return Math.round((duration / timescale) * 1000);
  }
  if (version === 1) {
    if (start + 32 > buf.length) return null;
    const timescale = buf.readUInt32BE(start + 20);
    const duration = Number(buf.readBigUInt64BE(start + 24));
    if (!timescale) return null;
    return Math.round((duration / timescale) * 1000);
  }
  return null;
}

/**
 * tkhd payload ends with a 3x3 transform matrix then width/height as 16.16
 * fixed-point. The offsets differ by version because of the 32/64-bit times.
 */
function readTkhdDimensions(
  buf: Buffer,
  start: number
): { width: number; height: number } | null {
  if (start + 4 > buf.length) return null;
  const version = buf.readUInt8(start);
  // v0: 4 (version+flags) + 8 (times) + 4 (id) + 4 (reserved) + 4 (duration) = 24
  // v1: 4 + 16 + 4 + 4 + 8 = 36
  const afterDuration = start + (version === 1 ? 36 : 24);
  // then 8 reserved + 2 layer + 2 alt_group + 2 volume + 2 reserved + 36 matrix
  const dimsAt = afterDuration + 8 + 2 + 2 + 2 + 2 + 36;
  if (dimsAt + 8 > buf.length) return null;
  const width = buf.readUInt32BE(dimsAt) / 65536;
  const height = buf.readUInt32BE(dimsAt + 4) / 65536;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width: Math.round(width), height: Math.round(height) };
}
