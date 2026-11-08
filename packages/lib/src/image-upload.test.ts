import { describe, expect, it } from 'vitest';
import { IMAGE_UPLOAD_MAX_BYTES, prepareImageUpload } from './image-upload';

describe('shared image upload preparation', () => {
  it('accepts files above the former 4 MB and 5 MB limits', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'large.png', {
      type: 'image/png',
    });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 });
    const prepared = await prepareImageUpload(file, { compress: false });
    expect(prepared.file).toBe(file);
    expect(prepared.contentType).toBe('image/png');
    expect(IMAGE_UPLOAD_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it('keeps GIF bytes intact so animation is never flattened', async () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
    const file = new File([bytes], 'animated.gif', { type: 'image/gif' });
    const prepared = await prepareImageUpload(file);
    expect(prepared.file).toBe(file);
    expect(prepared.compressed).toBe(false);
    expect(prepared.contentType).toBe('image/gif');
  });

  it('rejects a MIME type that does not match the file signature', async () => {
    const file = new File(['not a PNG'], 'fake.png', { type: 'image/png' });
    await expect(prepareImageUpload(file)).rejects.toThrow('contents do not match');
  });

  it('rejects inputs above the configured 50 MB raw-upload ceiling', async () => {
    const file = new File(['x'], 'too-large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: IMAGE_UPLOAD_MAX_BYTES + 1 });
    await expect(prepareImageUpload(file)).rejects.toThrow('smaller than 50 MB');
  });
});
