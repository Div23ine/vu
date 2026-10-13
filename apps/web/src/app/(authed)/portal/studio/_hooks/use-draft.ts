import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type {
  BlogCategory,
  ContentStatus,
  StudioDraftBody,
  StudioItem,
  StudioSubmitReadiness,
} from '@vunvault/contracts';
import {
  countWords,
  isReadyToSubmit,
  SLUG_PATTERN,
  STUDIO_LIMITS,
  StudioSubmitReadiness as StudioSubmitReadinessSchema,
  TAG_PATTERN,
} from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { apiPost, apiPut } from '../../../../../lib/api';
import { readMinutes } from '../_lib/markdown';
import { STUDIO_SUBMISSIONS_KEY, useStudioSubmissions } from './use-studio';

/**
 * Draft editor state machine (Task 72) — the STORAGE CHANGE: the working
 * copy lives on the SERVER, never in browser storage. The first edit creates
 * the draft (`POST /studio/drafts`), later edits `PUT /studio/drafts/:id`,
 * debounced 1.5 s after the last change and only once the title reaches the
 * prototype's rule — `a title of at least 4 characters`. `/edit/new` becomes
 * `/edit/<id>` through `router.replace` once the draft exists.
 *
 * Submit gates on the three required readiness items; a `422 not_ready`
 * carries the server's six booleans in `details[0]` and the checklist
 * highlights exactly those failures.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

/** Long enough for a real title, from the prototype's autosave rule. */
export const AUTOSAVE_TITLE_MIN = 4;
const AUTOSAVE_DEBOUNCE_MS = 1_500;

/** Same algorithm as `apps/api`'s `slug.ts` (the web app cannot import it). */
export const SLUG_MAX_LENGTH = 60;

export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((word) => word !== '')
    .join('-');
  const trimmed = base.length > SLUG_MAX_LENGTH ? base.slice(0, SLUG_MAX_LENGTH) : base;
  return trimmed.replace(/-+$/g, '');
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface DraftFields {
  title: string;
  slug: string;
  slugLocked: boolean;
  category: BlogCategory | null;
  excerpt: string;
  bodyMd: string;
  tags: string[];
  featuredImageUrl: string | null;
  imageAlt: string;
}

const EMPTY_FIELDS: DraftFields = {
  title: '',
  slug: '',
  slugLocked: false,
  category: null,
  excerpt: '',
  bodyMd: '',
  tags: [],
  featuredImageUrl: null,
  imageAlt: '',
};

const EMPTY_READINESS: StudioSubmitReadiness = {
  title: false,
  category: false,
  bodyWords: false,
  excerpt: false,
  featuredImage: false,
  tags: false,
};

const IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

interface ImageUploadUrl {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: string;
}

function fromItem(item: StudioItem): DraftFields {
  return {
    title: item.title ?? '',
    // A server-assigned slug is locked; it only auto-follows the title while unlocked.
    slug: item.slugPath ?? '',
    slugLocked: item.slugPath !== null,
    category: item.category,
    excerpt: item.excerpt ?? '',
    bodyMd: item.bodyMd ?? '',
    tags: [...item.tags],
    featuredImageUrl: item.featuredImageUrl,
    imageAlt: item.imageAlt ?? '',
  };
}

function isHttpUrl(value: string | null): value is string {
  if (value === null || value === '') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toDraftBody(fields: DraftFields): StudioDraftBody {
  return {
    ...(fields.title.trim() !== '' ? { title: fields.title.slice(0, STUDIO_LIMITS.title) } : {}),
    ...(SLUG_PATTERN.test(fields.slug) ? { slug: fields.slug } : {}),
    ...(fields.category !== null ? { category: fields.category } : {}),
    ...(fields.excerpt.trim() !== ''
      ? { excerpt: fields.excerpt.slice(0, STUDIO_LIMITS.excerpt) }
      : {}),
    bodyMd: fields.bodyMd,
    tags: fields.tags,
    ...(isHttpUrl(fields.featuredImageUrl) ? { featuredImageUrl: fields.featuredImageUrl } : {}),
    ...(fields.imageAlt.trim() !== '' ? { imageAlt: fields.imageAlt.slice(0, 160) } : {}),
  };
}

/** The 422 toast's missing-piece phrases (verbatim fragments where the prototype had them). */
function missingPhrases(readiness: StudioSubmitReadiness): string[] {
  const phrases: string[] = [];
  if (!readiness.title) phrases.push('a title of at least 4 characters');
  if (!readiness.bodyWords) phrases.push('article body content');
  if (!readiness.category) phrases.push('a category');
  return phrases;
}

function formatMegabytes(sizeBytes: number): string {
  return `${(sizeBytes / 1_048_576).toFixed(1)} MB`;
}

export function useDraftEditor(routeId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isNew = routeId === 'new';
  const submissions = useStudioSubmissions();

  const item = useMemo(
    () => (isNew ? undefined : submissions.data?.find((entry) => entry.id === routeId)),
    [isNew, routeId, submissions.data],
  );

  const [draftId, setDraftId] = useState<string | null>(isNew ? null : routeId);
  const [fields, setFields] = useState<DraftFields>(EMPTY_FIELDS);
  const [initialized, setInitialized] = useState(isNew);
  const [statusOverride, setStatusOverride] = useState<ContentStatus | null>(null);
  const [failedReadiness, setFailedReadiness] = useState<StudioSubmitReadiness | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Seed the form once from the server copy of an existing draft.
  useEffect(() => {
    if (initialized) return;
    if (item !== undefined) {
      setFields(fromItem(item));
      setInitialized(true);
    }
  }, [initialized, item]);

  const status: ContentStatus = statusOverride ?? item?.status ?? 'draft';
  // Read-only once submitted, until moderation returns it as changes_requested.
  const readOnly = status !== 'draft' && status !== 'changes_requested';

  const notFound = !isNew && submissions.data !== undefined && item === undefined;
  const isLoading = !isNew && (!initialized || submissions.isLoading);

  const readiness: StudioSubmitReadiness = useMemo(
    () =>
      initialized
        ? {
            title: fields.title.trim() !== '',
            category: fields.category !== null,
            bodyWords: countWords(fields.bodyMd) >= STUDIO_LIMITS.minWords,
            excerpt: fields.excerpt.trim() !== '',
            featuredImage: fields.featuredImageUrl !== null,
            tags: fields.tags.length >= 2,
          }
        : EMPTY_READINESS,
    [fields, initialized],
  );
  const ready = isReadyToSubmit(readiness);

  const markDirty = useCallback(() => {
    if (!readOnly) setSaveState((current) => (current === 'saving' ? current : 'dirty'));
  }, [readOnly]);

  const update = useCallback(
    (patch: Partial<DraftFields>) => {
      setFields((current) => ({ ...current, ...patch }));
      markDirty();
    },
    [markDirty],
  );

  const persist = useCallback(async (): Promise<StudioItem | null> => {
    if (readOnly) return null;
    const body = toDraftBody(fields);
    setSaveState('saving');
    try {
      // TODO(backend-contract): POST /api/v1/studio/drafts body StudioDraftBody → 201 { data: StudioItem }
      // TODO(backend-contract): PUT  /api/v1/studio/drafts/:id → 200 { data: StudioItem } | 409 not_editable
      const saved =
        draftId === null
          ? await apiPost<{ data: StudioItem }>('/api/v1/studio/drafts', body).then(
              (response) => response.data,
            )
          : await apiPut<{ data: StudioItem }>(`/api/v1/studio/drafts/${draftId}`, body).then(
              (response) => response.data,
            );
      const wasNew = draftId === null;
      setDraftId(saved.id);
      setSaveState('saved');
      void queryClient.invalidateQueries({ queryKey: STUDIO_SUBMISSIONS_KEY });
      if (wasNew && isNew) router.replace(`/portal/studio/edit/${saved.id}`);
      return saved;
    } catch {
      setSaveState('error');
      toast({ kind: 'crit', title: 'Could not save draft', message: 'Please try again.' });
      return null;
    }
  }, [draftId, fields, isNew, queryClient, readOnly, router]);

  // Autosave: 1.5 s after the LAST change, only with a title of ≥ 4 characters.
  useEffect(() => {
    if (readOnly || !initialized || saveState !== 'dirty') return;
    if (fields.title.trim().length < AUTOSAVE_TITLE_MIN) return;
    const timer = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fields, initialized, persist, readOnly, saveState]);

  const setTitle = useCallback(
    (value: string) => {
      setFields((current) => ({
        ...current,
        title: value,
        slug: current.slugLocked ? current.slug : slugify(value),
      }));
      markDirty();
    },
    [markDirty],
  );

  const setSlug = useCallback(
    (value: string) => {
      // Editing the slug by hand locks it — the URL stops following the title.
      setFields((current) => ({
        ...current,
        slug: value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        slugLocked: true,
      }));
      markDirty();
    },
    [markDirty],
  );

  const toggleSlugLock = useCallback(() => {
    setFields((current) => {
      const slugLocked = !current.slugLocked;
      if (slugLocked) {
        toast({ kind: 'info', title: 'The URL will no longer follow the title.' });
      } else {
        toast({ kind: 'info', title: 'The URL will now follow the title again.' });
      }
      return {
        ...current,
        slugLocked,
        slug: slugLocked ? current.slug : slugify(current.title),
      };
    });
  }, []);

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase().replace(/^#/, '');
      if (tag === '' || !TAG_PATTERN.test(tag)) return;
      if (fields.tags.includes(tag)) {
        toast({ kind: 'warn', title: `${tag} is already attached to this post.` });
        return;
      }
      if (fields.tags.length >= STUDIO_LIMITS.tags) {
        toast({ kind: 'warn', title: 'Tag limit reached' });
        return;
      }
      update({ tags: [...fields.tags, tag] });
    },
    [fields.tags, update],
  );

  const removeTag = useCallback(
    (tag: string) => {
      update({ tags: fields.tags.filter((entry) => entry !== tag) });
    },
    [fields.tags, update],
  );

  const removeLastTag = useCallback(() => {
    setFields((current) => ({ ...current, tags: current.tags.slice(0, -1) }));
    markDirty();
  }, [markDirty]);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!IMAGE_TYPES.has(file.type)) {
        toast({
          kind: 'warn',
          title: 'Unsupported file',
          message: 'Please choose a JPG, PNG, WebP or GIF image.',
        });
        return;
      }
      if (file.size > STUDIO_LIMITS.imageMaxBytes) {
        toast({
          kind: 'warn',
          title: 'File too large',
          message: `Images must be 5 MB or smaller. This one is ${formatMegabytes(file.size)}.`,
        });
        return;
      }
      setUploading(true);
      try {
        // TODO(backend-contract): POST /api/v1/studio/images/upload-url body { contentType; sizeBytes }
        //   → 200 { data: { uploadUrl; objectKey; publicUrl; expiresAt } }
        const { uploadUrl, publicUrl } = await apiPost<{ data: ImageUploadUrl }>(
          '/api/v1/studio/images/upload-url',
          { contentType: file.type, sizeBytes: file.size },
        ).then((response) => response.data);
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!response.ok) throw new Error('The image upload was rejected.');
        update({ featuredImageUrl: publicUrl });
        toast({
          kind: 'ok',
          title: 'Image attached',
          message: `${file.name} is now the featured image.`,
        });
      } catch {
        toast({ kind: 'crit', title: 'The image could not be read. Try a different file.' });
      } finally {
        setUploading(false);
      }
    },
    [update],
  );

  const removeImage = useCallback(() => {
    update({ featuredImageUrl: null, imageAlt: '' });
    toast({
      kind: 'info',
      title: 'Featured image removed',
      message: 'The post no longer has a cover image.',
    });
  }, [update]);

  const saveNow = useCallback(async () => {
    if (saveState !== 'dirty') {
      toast({ kind: 'info', title: 'Nothing to save' });
      return;
    }
    await persist();
  }, [persist, saveState]);

  const submit = useCallback(async () => {
    if (submitting || readOnly) return;
    setFailedReadiness(null);
    let id = draftId;
    if (id === null || saveState === 'dirty') {
      const saved = await persist();
      if (saved === null) return;
      id = saved.id;
    }
    setSubmitting(true);
    try {
      // TODO(backend-contract): POST /api/v1/studio/drafts/:id/submit
      //   → 200 { data: StudioItem } | 422 { error: "not_ready"; details: [StudioSubmitReadiness] }
      const submitted = await apiPost<{ data: StudioItem }>(
        `/api/v1/studio/drafts/${id}/submit`,
      ).then((response) => response.data);
      setStatusOverride(submitted.status);
      setSaveState('saved');
      void queryClient.invalidateQueries({ queryKey: STUDIO_SUBMISSIONS_KEY });
      toast({
        kind: 'ok',
        title: 'Submitted for review',
        message: 'An editor will review your article before it is published.',
      });
      router.push('/portal/studio');
    } catch (error) {
      if (isApiError(error) && error.status === 422 && error.code === 'not_ready') {
        const parsed = StudioSubmitReadinessSchema.safeParse(error.details?.[0]);
        if (parsed.success) setFailedReadiness(parsed.data);
        const phrases = missingPhrases(parsed.success ? parsed.data : readiness);
        toast({
          kind: 'warn',
          title: 'Cannot publish yet',
          message:
            phrases.length > 0
              ? `You need ${phrases.join(' and ')} before submitting.`
              : 'Complete the required items before submitting.',
        });
      } else {
        toast({
          kind: 'crit',
          title: 'Could not submit the article',
          message: 'Please try again.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [draftId, persist, queryClient, readiness, readOnly, router, saveState, submitting]);

  return {
    isLoading,
    notFound,
    draftId,
    fields,
    initialized,
    status,
    readOnly,
    saveState,
    submitting,
    uploading,
    readiness,
    failedReadiness,
    ready,
    words: countWords(fields.bodyMd),
    // The markup starts at `0 min`; the contract's readMinutes never goes below 1.
    readTime: fields.bodyMd.trim() === '' ? 0 : readMinutes(fields.bodyMd),
    setTitle,
    setSlug,
    toggleSlugLock,
    setCategory: (category: BlogCategory | null) => update({ category }),
    setExcerpt: (excerpt: string) => update({ excerpt: excerpt.slice(0, STUDIO_LIMITS.excerpt) }),
    setBodyMd: (bodyMd: string) => update({ bodyMd }),
    setImageAlt: (imageAlt: string) => update({ imageAlt: imageAlt.slice(0, 160) }),
    setImageUrl: (url: string) => update({ featuredImageUrl: url.trim() === '' ? null : url }),
    addTag,
    removeTag,
    removeLastTag,
    uploadImage,
    removeImage,
    saveNow,
    submit,
  };
}

export type DraftEditor = ReturnType<typeof useDraftEditor>;
