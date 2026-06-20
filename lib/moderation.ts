/**
 * Server-side image moderation hook.
 *
 * The client runs nsfwjs as a UX fast-fail, but a crafted client can skip it — so the
 * server must have the final say. Running nsfwjs/TensorFlow inside a serverless route is
 * heavy, so this is an **env-gated hook**: when `MODERATION_API_URL` is configured it POSTs
 * the image bytes and honors the verdict; when it's not, it's a documented no-op PASS
 * (drop-in later, same as the deferred Gemini pattern). Fail-open on errors so a flaky
 * moderation service never blocks all uploads.
 *
 * Expected moderation response JSON: { "flagged": boolean, "reason"?: string }.
 */
export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export async function moderateImage(
  buffer: Buffer,
  contentType: string
): Promise<ModerationResult> {
  const endpoint = process.env.MODERATION_API_URL;
  if (!endpoint) return { allowed: true }; // not configured -> pass (documented)

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(process.env.MODERATION_API_KEY
          ? { Authorization: `Bearer ${process.env.MODERATION_API_KEY}` }
          : {}),
      },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) return { allowed: true }; // fail-open
    const verdict = (await res.json()) as { flagged?: boolean; reason?: string };
    if (verdict.flagged) {
      return {
        allowed: false,
        reason: verdict.reason || "Image flagged as explicit content.",
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail-open
  }
}
