// Browser and API use the same maximum source image size (10 MiB).
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export function imageSizeIsAllowed(bytes:number):boolean {
  return Number.isFinite(bytes) && bytes >= 1 && bytes <= MAX_IMAGE_BYTES;
}
