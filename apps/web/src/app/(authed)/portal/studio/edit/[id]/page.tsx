'use client';

import { use, useState } from 'react';
import { notFound } from 'next/navigation';
import { Eye, FileText, Save, Send } from 'lucide-react';
import type { BlogCategory } from '@vunvault/contracts';
import { BLOG_CATEGORY_LABELS, CONTENT_STATUS_LABELS, STUDIO_LIMITS } from '@vunvault/contracts';
import { Skeleton, toast } from '@vunvault/ui';
import { useDraftEditor } from '../../_hooks/use-draft';
import { AuthorCard } from '../../_components/editor/author-card';
import { BodyEditor } from '../../_components/editor/body-editor';
import { FeaturedImage } from '../../_components/editor/featured-image';
import { PreviewDialog } from '../../_components/editor/preview-dialog';
import { ReadinessChecklist } from '../../_components/editor/readiness-checklist';
import { SaveIndicator } from '../../_components/editor/save-indicator';
import { TagInput } from '../../_components/editor/tag-input';
import { TitleSlug } from '../../_components/editor/title-slug';
import '../../_styles/editor.css';

/**
 * `/portal/studio/edit/[id]` — the full article editor. `new`
 * starts an empty draft (created server-side on the first qualifying
 * autosave, then `router.replace`d to its real id); any other id loads from
 * the submissions feed (the API has no single-draft GET). After submit the
 * editor is read-only until moderation returns `changes_requested`.
 *
 * Client page (React `use(params)`): the reads and writes are
 * cookie-authenticated, like the rest of the portal.
 */

const CATEGORY_ORDER = Object.keys(BLOG_CATEGORY_LABELS) as BlogCategory[];

interface StudioEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function StudioEditorPage({ params }: StudioEditorPageProps) {
  const { id } = use(params);
  const editor = useDraftEditor(id);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (editor.notFound) {
    // Not the caller's draft (or gone) — the standard not-found page.
    notFound();
  }

  if (editor.isLoading) {
    return (
      <div className="vbg-main" aria-busy="true">
        <div className="vbg-shell">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
          <Skeleton className="mt-10 h-96 w-full" />
        </div>
      </div>
    );
  }

  const { fields } = editor;

  const openPreview = (): void => {
    if (fields.title.trim() === '' && fields.bodyMd.trim() === '') {
      toast({
        kind: 'warn',
        title: 'Nothing to preview',
        message: 'Write a title or some body content first.',
      });
      return;
    }
    setPreviewOpen(true);
  };

  return (
    <div className="vbg-main">
      <div className="vbg-shell">
        <div className="vbg-page-head">
          <div>
            <span className="vbg-eyebrow">User Content Creation Studio</span>
            <h1 className="vbg-page-title">Write &amp; submit an article</h1>
            <p className="vbg-page-sub">
              Draft your story, attach media and preview it exactly as readers will see it.
              Publishing submits the article to the admin moderation queue — nothing goes live until
              an editor approves it.
            </p>
          </div>
          <div className="vbg-actionbar">
            {editor.readOnly ? (
              <span className="vbg-pill vbg-pill--info">
                {CONTENT_STATUS_LABELS[editor.status]}
              </span>
            ) : null}
            <button
              type="button"
              className="vbg-btn vbg-btn--ghost"
              disabled={editor.readOnly}
              onClick={() => void editor.saveNow()}
            >
              <Save size={15} aria-hidden="true" />
              <span>Save Draft</span>
            </button>
            <button type="button" className="vbg-btn vbg-btn--ghost" onClick={openPreview}>
              <Eye size={15} aria-hidden="true" />
              <span>Preview Article</span>
            </button>
            <button
              type="button"
              className="vbg-btn vbg-btn--primary"
              disabled={!editor.ready || editor.readOnly || editor.submitting}
              onClick={() => void editor.submit()}
            >
              <Send size={15} aria-hidden="true" />
              <span>Submit for Review</span>
            </button>
            <SaveIndicator state={editor.saveState} />
          </div>
        </div>

        <div className="vbg-editor-grid">
          <div className="vbg-col">
            <section className="vbg-card" aria-labelledby="vbgContentHeading">
              <div className="vbg-card-head">
                <div>
                  <span className="vbg-card-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <div>
                    <h2 className="vbg-card-title" id="vbgContentHeading">
                      Article Content
                    </h2>
                    <p className="vbg-card-note">
                      Write the full piece. Formatting uses lightweight markup that renders into
                      clean HTML in the reader view.
                    </p>
                  </div>
                </div>
              </div>
              <div className="vbg-card-body">
                <TitleSlug
                  title={fields.title}
                  slug={fields.slug}
                  slugLocked={fields.slugLocked}
                  disabled={editor.readOnly}
                  onTitleChange={editor.setTitle}
                  onSlugChange={editor.setSlug}
                  onToggleSlugLock={editor.toggleSlugLock}
                />

                <div className="vbg-field">
                  <label className="vbg-label" htmlFor="post-category">
                    <span>
                      Category
                      <span className="vbg-label-req" aria-hidden="true">
                        *
                      </span>
                    </span>
                  </label>
                  <select
                    id="post-category"
                    className="vbg-select"
                    value={fields.category ?? ''}
                    disabled={editor.readOnly}
                    onChange={(event) =>
                      editor.setCategory(
                        event.target.value === '' ? null : (event.target.value as BlogCategory),
                      )
                    }
                  >
                    <option value="">Select a category…</option>
                    {CATEGORY_ORDER.map((category) => (
                      <option key={category} value={category}>
                        {BLOG_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vbg-field">
                  <label className="vbg-label" htmlFor="post-excerpt">
                    <span>Excerpt / Summary</span>
                    <span className="vbg-label-hint" id="excerptCount">
                      {fields.excerpt.length} / {STUDIO_LIMITS.excerpt}
                    </span>
                  </label>
                  <textarea
                    id="post-excerpt"
                    className="vbg-textarea"
                    rows={3}
                    maxLength={STUDIO_LIMITS.excerpt}
                    value={fields.excerpt}
                    disabled={editor.readOnly}
                    onChange={(event) => editor.setExcerpt(event.target.value)}
                  />
                </div>

                <BodyEditor
                  bodyMd={fields.bodyMd}
                  words={editor.words}
                  readTime={editor.readTime}
                  disabled={editor.readOnly}
                  onBodyChange={editor.setBodyMd}
                />
              </div>
            </section>
          </div>

          <aside className="vbg-col" aria-label="Publishing options">
            <FeaturedImage
              imageUrl={fields.featuredImageUrl}
              imageAlt={fields.imageAlt}
              uploading={editor.uploading}
              disabled={editor.readOnly}
              onFile={(file) => void editor.uploadImage(file)}
              onUrlChange={editor.setImageUrl}
              onAltChange={editor.setImageAlt}
              onRemove={editor.removeImage}
            />
            <TagInput
              tags={fields.tags}
              disabled={editor.readOnly}
              onAdd={editor.addTag}
              onRemove={editor.removeTag}
              onRemoveLast={editor.removeLastTag}
            />
            <AuthorCard />
            <ReadinessChecklist readiness={editor.readiness} failed={editor.failedReadiness} />
          </aside>
        </div>
      </div>

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={fields.title}
        slug={fields.slug}
        bodyMd={fields.bodyMd}
        canSubmit={editor.ready && !editor.readOnly}
        submitting={editor.submitting}
        onSubmit={() => {
          setPreviewOpen(false);
          void editor.submit();
        }}
      />
    </div>
  );
}
