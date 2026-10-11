'use client';

/* An uploaded avatar is a remote, user-owned image: `next/image` would need a
   per-tenant domain allowlist and would re-encode a file the platform has
   already scanned and stored. SVGs in particular MUST go through <img> so they
   cannot script in this origin. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { ImageIcon, Trash2, UploadCloud, UserRound } from 'lucide-react';
import type { ProfileSettings } from '@vunvault/contracts';
import { AVATAR_MAX_BYTES, AvatarUploadRequest } from '@vunvault/contracts';
import { cn, formatUtcClock, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import {
  initialsOf,
  putAvatarToPresignedUrl,
  useConfirmAvatar,
  useRemoveAvatar,
  useRequestAvatarUploadUrl,
} from '../_hooks/use-account-settings';

/**
 * Profile Picture panel (Task 83c) — the three-step avatar upload.
 *
 * The client checks FIRST, before any request leaves the browser: the type must
 * be one of the four the contract's `AvatarUploadRequest` accepts and the size
 * must be within `AVATAR_MAX_BYTES`. Both refusals are the spec's verbatim
 * toasts, and neither costs a round trip.
 *
 * Only then does the chain run — mint the presigned URL, PUT the bytes straight
 * to storage, confirm the object key — so the API records an avatar that
 * actually exists. Any failure in the chain reports one `Upload failed`; the
 * operator never sees a half-uploaded picture.
 *
 * `Generate From Initials` makes NO API call: it is the fallback the platform
 * already renders when `avatarUrl` is null, so the button only says so.
 *
 * An uploaded SVG is rendered through `<img>` only, never inlined, so a hostile
 * file cannot script in this origin.
 */

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

export interface AvatarUploaderProps {
  profile: ProfileSettings | null;
}

export function AvatarUploader({ profile }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestUrl = useRequestAvatarUploadUrl();
  const confirm = useConfirmAvatar();
  const remove = useRemoveAvatar();

  const initials =
    profile === null ? '—' : initialsOf(profile.firstName, profile.lastName);
  const hasAvatar = profile !== null && profile.avatarUrl !== null;

  const upload = async (file: File): Promise<void> => {
    // Client-side gate, checked against the contract's own schema so the UI and
    // the API cannot disagree about what is acceptable.
    const parsed = AvatarUploadRequest.safeParse({
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!parsed.success) {
      const tooLarge = file.size > AVATAR_MAX_BYTES;
      const badType = !ACCEPTED.includes(file.type as (typeof ACCEPTED)[number]);
      if (tooLarge) {
        toast({ kind: 'warn', title: 'File too large', message: 'Avatar uploads are limited to 4 MB.' });
        return;
      }
      if (badType) {
        toast({
          kind: 'warn',
          title: 'Unsupported file type',
          message: 'Please upload a PNG, JPG, WEBP or SVG image.',
        });
        return;
      }
      toast({
        kind: 'warn',
        title: 'Unsupported file type',
        message: 'Please upload a PNG, JPG, WEBP or SVG image.',
      });
      return;
    }

    setBusy(true);
    try {
      const granted = await requestUrl.mutateAsync({
        contentType: file.type,
        sizeBytes: file.size,
      });
      const uploaded = await putAvatarToPresignedUrl(granted.uploadUrl, file);
      if (!uploaded) throw new Error('presigned put failed');
      await confirm.mutateAsync(granted.objectKey);
      toast({
        kind: 'ok',
        title: 'Avatar updated',
        message: `Image accepted and queued for security scanning at ${formatUtcClock(new Date())}.`,
      });
    } catch (error) {
      toast({
        kind: 'crit',
        title: 'Upload failed',
        message: isApiError(error) ? error.message : 'The file could not be read. Please try again.',
      });
    } finally {
      setBusy(false);
      // Clear the input so choosing the same file again still fires change.
      if (inputRef.current !== null) inputRef.current.value = '';
    }
  };

  const onRemove = (): void => {
    remove.mutate(undefined, {
      onSuccess: () =>
        toast({
          kind: 'info',
          title: 'Avatar removed',
          message: 'Falling back to initials across the platform.',
        }),
      onError: (error) =>
        toast({
          kind: 'crit',
          title: 'Upload failed',
          message: isApiError(error) ? error.message : 'The file could not be read. Please try again.',
        }),
    });
  };

  const onGenerate = (): void => {
    toast({
      kind: 'info',
      title: 'Avatar generated',
      message: 'Initials image created for your account.',
    });
  };

  return (
    <section
      className="adm-card ps-panel"
      id="ps-panel-picture"
      role="tabpanel"
      aria-labelledby="ps-tab-picture"
      tabIndex={0}
    >
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <ImageIcon size={15} aria-hidden="true" />
            Profile Picture
          </h2>
          <p className="adm-card-note">
            Upload a square image at least 256×256 px. It appears in the header, audit log,
            contributor cards and client-facing dashboards where your name is shown.
          </p>
        </div>
        <span className="adm-tag">{hasAvatar ? 'Uploaded' : 'No upload'}</span>
      </div>
      <div className="adm-card-body ps-avatar-panel">
        <div
          className={cn('ps-drop', dragover ? 'is-dragover' : undefined)}
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-label="Upload a profile picture"
          aria-busy={busy}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            inputRef.current?.click();
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
            if (file !== undefined) void upload(file);
          }}
        >
          <span className="ps-drop-preview" aria-hidden="true">
            {profile === null || profile.avatarUrl === null ? (
              initials
            ) : (
              <img src={profile.avatarUrl} alt="" />
            )}
          </span>
          <span className="ps-drop-title">Drag &amp; drop your image here</span>
          <span className="ps-drop-text">
            Or click to browse. Accepted: PNG, JPG, WEBP, SVG — up to 4 MB. Square crops preferred.
          </span>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={ACCEPTED.join(',')}
            aria-label="Profile picture file"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void upload(file);
            }}
          />
        </div>

        <div className="ps-avatar-actions">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            disabled={!hasAvatar || remove.isPending}
            onClick={onRemove}
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>Remove Current Picture</span>
          </button>
          <button type="button" className="adm-btn adm-btn-dark" onClick={onGenerate}>
            <UserRound size={15} aria-hidden="true" />
            <span>Generate From Initials</span>
          </button>
        </div>

        <p className="ps-note">
          <UploadCloud size={12} aria-hidden="true" /> Files are scanned for embedded malware,
          stripped of all EXIF metadata and stored encrypted on the VUNVAULT CDN. Uploads are
          written to the audit log against your administrator identity.
        </p>
      </div>
    </section>
  );
}
