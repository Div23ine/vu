/* eslint-disable @next/next/no-img-element -- the preview shows ARBITRARY
   author-supplied hosts (the presigned CDN and pasted URLs); next/image
   cannot optimize unknown remote origins. */
'use client';

import { useRef, useState } from 'react';
import { ImageIcon, UploadCloud, X } from 'lucide-react';
import { cn } from '@vunvault/lib';
import '../../_styles/editor.css';

/**
 * Featured image card (Task 72) — drag-drop zone + file input (JPG/PNG/WebP/
 * GIF, ≤ 5 MB — the hook validates and toasts), the hosted-URL field, the
 * preview with its remove button, and the alt-text field. Uploads go through
 * `POST /studio/images/upload-url` → `PUT` to the presigned URL; data URLs
 * are never embedded.
 */

interface FeaturedImageProps {
  imageUrl: string | null;
  imageAlt: string;
  uploading: boolean;
  disabled?: boolean;
  onFile(file: File): void;
  onUrlChange(url: string): void;
  onAltChange(alt: string): void;
  onRemove(): void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 40);
  }
}

export function FeaturedImage({
  imageUrl,
  imageAlt,
  uploading,
  disabled = false,
  onFile,
  onUrlChange,
  onAltChange,
  onRemove,
}: FeaturedImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const openPicker = (): void => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  return (
    <section className="vbg-card" aria-labelledby="vbgImageHeading">
      <div className="vbg-card-head">
        <div>
          <h2 className="vbg-card-title" id="vbgImageHeading">
            <ImageIcon size={16} aria-hidden="true" />
            Featured Image
          </h2>
          <p className="vbg-card-note">
            Upload from this device or paste a hosted image URL. The image is stored with the post.
          </p>
        </div>
      </div>
      <div className="vbg-card-body">
        <div
          className={cn('vbg-drop', dragover ? 'is-dragover' : undefined)}
          role="button"
          tabIndex={disabled || uploading ? -1 : 0}
          aria-label="Upload a featured image from your device"
          aria-busy={uploading}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragover(false);
            const file = event.dataTransfer.files[0];
            if (file !== undefined) onFile(file);
          }}
        >
          <span className="vbg-drop-icon" aria-hidden="true">
            <UploadCloud size={20} />
          </span>
          <span className="vbg-drop-title">Drop an image here</span>
          <span className="vbg-drop-text">or click to browse · JPG, PNG, WebP, GIF · max 5 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) onFile(file);
              event.target.value = '';
            }}
          />
        </div>

        <div className="vbg-divider-or" aria-hidden="true">
          or
        </div>

        <div className="vbg-field">
          <label className="vbg-label" htmlFor="post-cover-url">
            <span>Image URL</span>
          </label>
          <input
            id="post-cover-url"
            className="vbg-input"
            type="url"
            placeholder="https://cdn.example.com/cover.jpg"
            autoComplete="off"
            value={imageUrl ?? ''}
            disabled={disabled || uploading}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        </div>

        {imageUrl !== null && imageUrl !== '' ? (
          <div className="vbg-img-preview">
            <img src={imageUrl} alt={imageAlt !== '' ? imageAlt : 'Featured image preview'} />
            <button
              type="button"
              className="vbg-img-remove"
              aria-label="Remove featured image"
              disabled={disabled}
              onClick={onRemove}
            >
              <X size={14} aria-hidden="true" />
            </button>
            <div className="vbg-img-meta">
              <span>{hostOf(imageUrl)}</span>
              <span>Hosted URL</span>
            </div>
          </div>
        ) : null}

        <div className="vbg-field">
          <label className="vbg-label" htmlFor="post-cover-alt">
            <span>Image Alt Text</span>
            <span className="vbg-label-hint">Accessibility</span>
          </label>
          <input
            id="post-cover-alt"
            className="vbg-input"
            type="text"
            maxLength={160}
            placeholder="Describe the image for screen readers…"
            autoComplete="off"
            value={imageAlt}
            disabled={disabled}
            onChange={(event) => onAltChange(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
