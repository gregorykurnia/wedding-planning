import { createHash } from "node:crypto";
import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { RequestError } from "./request-error";

// Node gives each of a host's addresses 250 ms to connect before trying the
// next; from Jakarta Cloudinary's API takes about 280 ms, so every address
// times out and `fetch` fails on a local server. Two seconds each is plenty.
if (getDefaultAutoSelectFamilyAttemptTimeout() < 2000) setDefaultAutoSelectFamilyAttemptTimeout(2000);

/**
 * Signed calls to Cloudinary's upload API (plan §2.9). The API key and secret
 * live only on the server; the browser keeps uploading with the unsigned
 * preset.
 */
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function cloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new RequestError(503, "not-configured", "Cloudinary's cloud name, API key or secret is not set");
  }
  return { cloudName, apiKey, apiSecret };
}

/** Cloudinary's request signature: the sorted parameters, then the secret, through SHA-1. */
export function sign(params: Record<string, string>, apiSecret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(base + apiSecret).digest("hex");
}

export interface Asset {
  resourceType: "image" | "video" | "raw";
  publicId: string;
}

/**
 * Destroys one uploaded asset and clears it from the CDN. Answers
 * `"destroyed"`, or `"already-gone"` when Cloudinary has no such asset, so a
 * second call is harmless. Anything else throws, and the caller must then
 * leave the record alone.
 */
export async function destroyAsset(config: CloudinaryConfig, asset: Asset): Promise<"destroyed" | "already-gone"> {
  const params: Record<string, string> = {
    invalidate: "true",
    public_id: asset.publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: "upload",
  };
  const body = new URLSearchParams({ ...params, api_key: config.apiKey, signature: sign(params, config.apiSecret) });
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${asset.resourceType}/destroy`;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new RequestError(502, "storage-failed", `Cloudinary didn't answer: ${err instanceof Error ? err.message : err}`);
  }
  const json = (await res.json().catch(() => null)) as { result?: string; error?: { message?: string } } | null;
  if (res.ok && json?.result === "ok") return "destroyed";
  if (res.ok && json?.result === "not found") return "already-gone";
  throw new RequestError(
    502,
    "storage-failed",
    `Cloudinary refused the delete (${res.status}${json?.error?.message ? `: ${json.error.message}` : json?.result ? `: ${json.result}` : ""})`,
  );
}
