import "server-only";
import sharp from "sharp";

// Call only AFTER the requesting user's media row has passed RLS. This cache
// shares immutable file bytes, never authorization decisions or public URLs.
const cache = new Map<string, { bytes: Buffer; expires: number }>();
const pending = new Map<string, Promise<Buffer>>();
const limit = 16 * 1024 * 1024;
let used = 0;

export function mediaBytes(
  path: string,
  width: number,
  download: () => Promise<Buffer>,
): Promise<Buffer> {
  const key = `${path}:${width}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit.bytes);
  }
  if (hit) {
    used -= hit.bytes.length;
    cache.delete(key);
  }
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const task = (async () => {
    const source = width
      ? await mediaBytes(path, 0, download)
      : await download();
    const bytes = width
      ? await sharp(source, { limitInputPixels: 40_000_000 })
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer()
      : source;
    if (bytes.length <= limit) {
      while (used + bytes.length > limit && cache.size) {
        const oldest = cache.keys().next().value!;
        used -= cache.get(oldest)!.bytes.length;
        cache.delete(oldest);
      }
      cache.set(key, { bytes, expires: Date.now() + 300000 });
      used += bytes.length;
    }
    return bytes;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
