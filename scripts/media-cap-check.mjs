/**
 * Media size-cap check — proves the cap is enforced by the STORE, not by trust.
 *
 * `/api/media/init` binds the client's declared byte count into the R2 presigned
 * PUT (lib/media/limits.ts, layer 2). This exercises that against the live
 * bucket and asserts the two outcomes that matter:
 *
 *   A. a PUT of exactly the declared size is ACCEPTED (200)
 *   B. a PUT of a different size is REJECTED by R2 (403), before a byte of it
 *      is stored and without our API being involved at all
 *
 * Belongs to MEDIA.md §9's cutover checklist: run it after any change to the
 * presigning path, and after the MEDIA_PROVIDER flip.
 *
 * Reads R2 credentials from .env.local. Writes and deletes one small object
 * under `_cap-check/`. Requires Node >= 20.
 *
 *   node scripts/media-cap-check.mjs
 */
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function envLocal() {
  try {
    const t = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    const o = {};
    for (const l of t.split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return o;
  } catch {
    return {};
  }
}

const env = { ...envLocal(), ...process.env };
for (const key of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
  if (!env[key]) {
    console.error(`Missing ${key} — see MEDIA.md §5.`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
const Bucket = env.R2_BUCKET || "tripotter-media";
const Key = `_cap-check/${Date.now()}.bin`;
const declared = 1024;

// The same call lib/storage/r2.ts makes. `signableHeaders` is the load-bearing
// part: without it the presigner hoists content-length out of the signature and
// the cap silently stops existing.
const url = await getSignedUrl(
  s3,
  new PutObjectCommand({
    Bucket,
    Key,
    ContentType: "application/octet-stream",
    ContentLength: declared,
  }),
  { expiresIn: 300, signableHeaders: new Set(["content-length"]) }
);

const signed = new URL(url).searchParams.get("X-Amz-SignedHeaders") ?? "";
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

check("content-length is inside the signature", signed.includes("content-length"), signed);

const put = (bytes) =>
  fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.length),
    },
    body: bytes,
  });

const exact = await put(Buffer.alloc(declared, 7));
check("a PUT of the declared size is accepted", exact.status === 200, `HTTP ${exact.status}`);

const over = await put(Buffer.alloc(declared * 4, 9));
check("a PUT larger than declared is refused by R2", over.status === 403, `HTTP ${over.status}`);

await s3
  .send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: [{ Key }], Quiet: true } }))
  .catch(() => {});

console.log(failures === 0 ? "\nSize cap is enforced at the store." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
