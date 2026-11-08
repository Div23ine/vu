/**
 * Shared image-upload preparation used by every web module.
 *
 * Raster images are decoded (so the browser verifies their actual format) and
 * re-encoded as WebP by default. Animated GIFs are deliberately passed through
 * unchanged to preserve every frame. SVG is parsed and reduced to a safe static
 * subset before it can be uploaded.
 */
export const IMAGE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export interface PrepareImageOptions {
  compress?: boolean;
  maxBytes?: number;
}

export interface PreparedImage {
  file: File;
  originalBytes: number;
  uploadedBytes: number;
  compressed: boolean;
  contentType: string;
}

const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function readPrefix(file: File, length = 16): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}

function sniffRasterType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  if (String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) return 'image/gif';
  return null;
}

function sanitizeSvg(source: string): string {
  if (source.length > 2 * 1024 * 1024) throw new Error('SVG files must be 2 MB or smaller.');
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') {
    throw new Error('This SVG file is invalid.');
  }
  const allowedTags = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title',
    'desc', 'text', 'tspan',
  ]);
  const allowedAttributes = new Set([
    'xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
    'opacity', 'transform', 'offset', 'stop-color', 'stop-opacity', 'clip-path',
    'mask', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'id',
  ]);
  for (const node of [parsed.documentElement, ...parsed.querySelectorAll('*')]) {
    if (!allowedTags.has(node.localName)) {
      node.remove();
      continue;
    }
    for (const attribute of [...node.attributes]) {
      const name = attribute.name;
      const value = attribute.value.trim();
      const unsafeValue = name === 'xmlns'
        ? value !== 'http://www.w3.org/2000/svg'
        : /url\s*\(/i.test(value) || /javascript:|data:|https?:|\/\//i.test(value);
      if (!allowedAttributes.has(name) || /^on/i.test(name) || unsafeValue) node.removeAttribute(name);
    }
  }
  const svg = new XMLSerializer().serializeToString(parsed.documentElement);
  return svg;
}

export async function prepareImageUpload(
  input: File,
  options: PrepareImageOptions = {},
): Promise<PreparedImage> {
  const maxBytes = options.maxBytes ?? IMAGE_UPLOAD_MAX_BYTES;
  if (input.size <= 0 || input.size > maxBytes) {
    throw new Error(`Images must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  const prefix = await readPrefix(input, 16);
  const detected = sniffRasterType(prefix);
  const compress = options.compress !== false;

  if (detected === 'image/gif') {
    // GIF animation must not be flattened by createImageBitmap/canvas.
    return { file: input, originalBytes: input.size, uploadedBytes: input.size, compressed: false, contentType: detected };
  }

  if (detected !== null) {
    if (input.type !== detected && input.type !== '') throw new Error('The file extension or MIME type does not match its contents.');
    if (!compress) return { file: input, originalBytes: input.size, uploadedBytes: input.size, compressed: false, contentType: detected };
    try {
      const bitmap = await createImageBitmap(input);
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('Image compression is unavailable in this browser.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image compression failed.')), 'image/webp', 0.82),
        );
        if (blob.size >= input.size) {
          return { file: input, originalBytes: input.size, uploadedBytes: input.size, compressed: false, contentType: detected };
        }
        const file = new File([blob], input.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp', lastModified: Date.now() });
        return { file, originalBytes: input.size, uploadedBytes: file.size, compressed: true, contentType: 'image/webp' };
      } finally {
        bitmap.close();
      }
    } catch (error) {
      if (error instanceof Error && /extension|MIME|invalid|smaller/.test(error.message)) throw error;
      // A browser without bitmap/canvas support can still upload the validated original.
      return { file: input, originalBytes: input.size, uploadedBytes: input.size, compressed: false, contentType: detected };
    }
  }

  if (input.type === 'image/svg+xml' || input.name.toLowerCase().endsWith('.svg')) {
    const source = await input.text();
    const safe = sanitizeSvg(source);
    const blob = new Blob([safe], { type: 'image/svg+xml' });
    const file = new File([blob], input.name.replace(/[^a-zA-Z0-9._-]/g, '_'), { type: 'image/svg+xml' });
    return { file, originalBytes: input.size, uploadedBytes: file.size, compressed: false, contentType: 'image/svg+xml' };
  }

  if (RASTER_TYPES.has(input.type)) throw new Error('The image contents do not match the selected file type.');
  throw new Error('Please choose a valid JPEG, PNG, WebP, GIF or SVG image.');
}
