### TASK 72 — Content Studio B: article editor with autosave, tags, featured image, readiness and submit

**Layer:** L8

**Prerequisites:** Task 36, Task 71, Task 40c

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Content Studio B: article editor with autosave, tags, featured image, readiness and submit**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/studio/edit/[id]`: the full article editor with title/slug, rich-text-lite body, subtitle list, featured image upload, tags, author card, readiness checklist, preview dialog and submit for review — all persisted through the studio API.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/studio/edit/[id]/page.tsx`
- `apps/web/src/app/(authed)/portal/studio/_components/editor/title-slug.tsx`, `body-editor.tsx`, `toolbar.tsx`, `subheading-list.tsx`, `featured-image.tsx`, `tag-input.tsx`, `author-card.tsx`, `readiness-checklist.tsx`, `preview-dialog.tsx`, `save-indicator.tsx`
- `apps/web/src/app/(authed)/portal/studio/_lib/markdown.ts` — `htmlToMarkdown`/`markdownToBlocks` for the editor value, and `countWords`/`readMinutes` re-exported from contracts.
- `apps/web/src/app/(authed)/portal/studio/_hooks/use-draft.ts` — autosave + submit hooks.
- `apps/web/src/app/(authed)/portal/studio/_styles/editor.css`
- MODIFY `apps/web/src/mocks/handlers/studio.ts`.
- `apps/web/src/app/(authed)/portal/studio/studio-b.test.tsx`
- `apps/web/src/app/(authed)/portal/studio/_lib/markdown.test.ts`

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Studio editor (full page)
```html
<main class="vbg-main" id="vbgStudio" hidden>
 <div class="vbg-shell">
  <div class="vbg-page-head">
   <div>
    <span class="vbg-eyebrow">User Content Creation Studio</span>
    <h1 class="vbg-page-title">Write & submit an article</h1>
    <p class="vbg-page-sub">
     Draft your story, attach media and preview it exactly as readers will see it. Publishing submits the article to the admin moderation queue — nothing goes live until an editor approves it.
    </p>
   </div>
   <div class="vbg-actionbar">
    <button type="button" class="vbg-btn vbg-btn--ghost" id="vbgSaveDraft">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Save Draft</span>
    </button>
    [+2 more sibling <button> elements with the SAME structure as the one above; their text content in order: Preview Article || Publish Post]
    <div class="vbg-actionbar-note">
     <span class="vbg-save-dot" id="vbgSaveDot" aria-hidden="true"></span>
     <span id="vbgSaveLabel">Working copy saved locally</span>
    </div>
   </div>
  </div>
  <div class="vbg-editor-grid">
   <div class="vbg-col">
    <section class="vbg-card" aria-labelledby="vbgContentHeading">
     <div class="vbg-card-head">
      <div>
       <span class="vbg-card-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <div>
        <h2 class="vbg-card-title" id="vbgContentHeading">Article Content</h2>
        <p class="vbg-card-note">Write the full piece. Formatting uses lightweight markup that renders into clean HTML in the reader view.</p>
       </div>
      </div>
     </div>
     <div class="vbg-card-body">
      <div class="vbg-field">
       <label class="vbg-label" for="post-title">
        <span>
         Post Title
         <span class="vbg-label-req" aria-hidden="true">*</span>
        </span>
        <span class="vbg-label-hint" id="titleCount">0 / 120</span>
       </label>
       <input id="post-title" class="vbg-input vbg-input--title" type="text" maxlength="120" placeholder="Give your story a headline…" autocomplete="off"/>
      </div>
      [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: URL Slug ¦ Auto-generated from the title ¦ /blog/ ¦ Public URL: /blog/your-article-slug || Category ¦ * ¦ Select a category… ¦ News ¦ Threat Intel ¦ Blog ¦ Industry Updates ¦ Tutorials || Excerpt / Summary ¦ 0 / 240 || Main Body ¦ * ¦ Markdown-style formatting supported ¦ B ¦ I ¦ H2 ¦ H3 ¦ Words ¦ 0 ¦ Characters ¦ 0 ¦ Read time ¦ 0 min ¦ Target ≥ ¦ 150 ¦ words ¦ Autosaved locally ¦ The moderation team reads the raw text and the rendered preview. Keep claims sourced.]
     </div>
    </section>
    <section class="vbg-card" id="submissions" aria-labelledby="vbgSubHeading">
     <div class="vbg-card-head">
      <div>
       <h2 class="vbg-card-title" id="vbgSubHeading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Your Submissions
       </h2>
       <p class="vbg-card-note">Drafts and posts you have submitted, with their current moderation status.</p>
      </div>
      <span class="vbg-pill vbg-pill--info" id="vbgSubCount">0 items</span>
     </div>
     <div class="vbg-card-body">
      <div class="vbg-sub-list" id="vbgSubList"></div>
     </div>
    </section>
   </div>
   <aside class="vbg-col" aria-label="Publishing options">
    <section class="vbg-card" aria-labelledby="vbgImageHeading">
     <div class="vbg-card-head">
      <div>
       <h2 class="vbg-card-title" id="vbgImageHeading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Featured Image
       </h2>
       <p class="vbg-card-note">Upload from this device or paste a hosted image URL. The image is stored with the post.</p>
      </div>
     </div>
     <div class="vbg-card-body">
      <div class="vbg-drop" id="vbgDropZone" role="button" tabindex="0" aria-label="Upload a featured image from your device">
       <span class="vbg-drop-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <span class="vbg-drop-title">Drop an image here</span>
       <span class="vbg-drop-text">or click to browse · JPG, PNG, WebP, GIF · max 5 MB</span>
       <input type="file" id="vbgFileInput" hidden/>
      </div>
      <div class="vbg-divider-or" aria-hidden="true">or</div>
      <div class="vbg-field">
       <label class="vbg-label" for="post-cover-url">
        <span>Image URL</span>
       </label>
       <input id="post-cover-url" class="vbg-input" type="url" placeholder="https://cdn.example.com/cover.jpg" autocomplete="off"/>
      </div>
      <div class="vbg-img-preview" id="vbgImgPreview" hidden>
       <img id="vbgImgEl" src alt/>
       <button type="button" class="vbg-img-remove" id="vbgImgRemove" aria-label="Remove featured image">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </button>
       <div class="vbg-img-meta">
        <span id="vbgImgMeta">—</span>
        <span id="vbgImgSource">—</span>
       </div>
      </div>
      <div class="vbg-field">
       <label class="vbg-label" for="post-cover-alt">
        <span>Image Alt Text</span>
        <span class="vbg-label-hint">Accessibility</span>
       </label>
       <input id="post-cover-alt" class="vbg-input" type="text" maxlength="160" placeholder="Describe the image for screen readers…" autocomplete="off"/>
      </div>
     </div>
    </section>
    [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Hashtags / Tags ¦ Press ¦ Enter ¦ or ¦ comma ¦ to add a tag. Backspace removes the last one. ¦ 0 tags ¦ Suggestions ¦ #security ¦ #threatintel ¦ #fintech ¦ #africa ¦ #compliance ¦ #research ¦ Maximum 8 tags. Tags drive related-article feeds and topic pages. || Author ¦ V ¦ Verified Blogger ¦ Journalist ¦ Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit. ¦ Verified ¦ Pre-publication review ¦ Edit profile & byline]
    <section class="vbg-card vbg-card--dark" aria-labelledby="vbgReadyHeading">
     <div class="vbg-card-head">
      <div>
       <h2 class="vbg-card-title" id="vbgReadyHeading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Publication Readiness
       </h2>
       <p class="vbg-card-note">Everything marked required must be complete before the post can be submitted.</p>
      </div>
     </div>
     <div class="vbg-card-body">
      <ul class="vbg-checklist" id="vbgChecklist">
       <li class="vbg-check-item">
        <span class="vbg-check-mark" aria-hidden="true">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </span>
        <span>Title added</span>
        <span class="vbg-check-req">Required</span>
       </li>
       [+5 more sibling <li> elements with the SAME structure as the one above; their text content in order: Category selected ¦ Required || Body ≥ 150 words ¦ Required || Excerpt written || Featured image attached || At least 2 tags]
      </ul>
     </div>
    </section>
   </aside>
  </div>
 </div>
</main>
```
Custom CSS for this markup (reference):
```css
.vbg-shell { width: 100%; max-width: 88rem; margin-inline: auto; padding-inline: 16px; }
@media (min-width: 640px) {
.vbg-shell { padding-inline: 24px; }
}
@media (min-width: 1024px) {
.vbg-shell { padding-inline: 32px; }
}
.vbg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 22px; font-size: 0.79rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--vg-r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.2s var(--vg-ease), filter 0.2s var(--vg-ease), box-shadow 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), border-color 0.2s var(--vg-ease), color 0.2s var(--vg-ease); }
.vbg-btn svg { flex: 0 0 auto; }
.vbg-btn:active { transform: translateY(1px) scale(0.985); }
.vbg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.vbg-btn--ghost { color: var(--vg-ink); background: #ffffff; border-color: var(--vg-line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.vbg-btn--ghost:hover { transform: translateY(-2px); color: var(--vg-brand-strong); border-color: var(--vg-brand-line); box-shadow: 0 14px 30px -20px var(--vg-brand-glow); }
.vbg-main { flex: 1 1 auto; padding: 30px 0 70px; }
.vbg-page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 22px; padding-bottom: 22px; margin-bottom: 24px; border-bottom: 1px solid var(--vg-line-soft); }
.vbg-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--vg-brand-strong); }
.vbg-eyebrow::before { content: ""; width: 22px; height: 2px; border-radius: 2px; background: var(--vg-brand); }
.vbg-page-title { margin: 10px 0 0; font-size: clamp(1.6rem, 3.2vw, 2.3rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--vg-ink); }
.vbg-page-sub { margin: 8px 0 0; max-width: 72ch; font-size: 0.85rem; line-height: 1.7; color: var(--vg-ink-muted); }
.vbg-actionbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.vbg-actionbar-note { width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 7px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: var(--vg-ink-faint); }
.vbg-save-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--vg-ink-faint); transition: background-color var(--vg-dur) var(--vg-ease); }
.vbg-save-dot.is-dirty { background: var(--vg-high); }
.vbg-save-dot.is-saved { background: var(--vg-ok); }
.vbg-editor-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(0, 1fr); gap: 22px; align-items: start; }
@media (max-width: 1180px) {
.vbg-editor-grid { grid-template-columns: 1fr; }
}
.vbg-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.vbg-card { display: flex; flex-direction: column; border-radius: var(--vg-r-xl); background: #ffffff; border: 1px solid var(--vg-line); box-shadow: 0 18px 44px -40px rgba(10, 13, 18, 0.55); overflow: hidden; }
.vbg-card--dark { background: radial-gradient(80% 120% at 100% 0%, rgba(59, 153, 252, 0.16), transparent 62%), linear-gradient(160deg, var(--vg-dark) 0%, #070b11 100%); border-color: rgba(59, 153, 252, 0.26); box-shadow: 0 26px 56px -34px rgba(0, 0, 0, 0.7); color: #ffffff; }
.vbg-card-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 18px 22px 15px; border-bottom: 1px solid var(--vg-line-soft); }
.vbg-card--dark .vbg-card-head { border-bottom-color: rgba(255, 255, 255, 0.08); }
.vbg-card-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 0.98rem; font-weight: 800; letter-spacing: -0.01em; color: var(--vg-ink); }
.vbg-card--dark .vbg-card-title { color: #ffffff; }
.vbg-card-title svg { color: var(--vg-brand); flex: 0 0 auto; }
.vbg-card-note { margin: 5px 0 0; font-size: 0.73rem; line-height: 1.6; color: var(--vg-ink-muted); max-width: 68ch; }
.vbg-card--dark .vbg-card-note { color: #93a2b5; }
.vbg-card-body { flex: 1 1 auto; padding: 20px 22px 24px; }
.vbg-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); }
.vbg-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vbg-field + .vbg-field { margin-top: 18px; }
.vbg-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--vg-ink-muted); }
.vbg-label-req { color: var(--vg-critical); }
.vbg-label-hint { font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: none; color: var(--vg-ink-faint); }
.vbg-input,
  .vbg-select,
  .vbg-textarea { width: 100%; padding: 12px 14px; font-size: 0.85rem; font-family: inherit; color: var(--vg-ink); background: #ffffff; border: 1px solid var(--vg-line); border-radius: var(--vg-r-md); outline: none; transition: border-color var(--vg-dur) var(--vg-ease), box-shadow var(--vg-dur) var(--vg-ease), background-color var(--vg-dur) var(--vg-ease); }
.vbg-input::placeholder,
  .vbg-textarea::placeholder { color: var(--vg-ink-faint); }
.vbg-input:hover,
  .vbg-select:hover,
  .vbg-textarea:hover { border-color: #d4d7dd; }
.vbg-input:focus,
  .vbg-select:focus,
  .vbg-textarea:focus { border-color: var(--vg-brand); box-shadow: 0 0 0 3px var(--vg-brand-tint); }
.vbg-input.is-invalid,
  .vbg-select.is-invalid,
  .vbg-textarea.is-invalid { border-color: var(--vg-critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vbg-input--title { padding: 16px 18px; font-size: clamp(1.15rem, 2.4vw, 1.45rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.3; }
.vbg-slug-wrap .vbg-input { border: 0; border-radius: 0; box-shadow: none !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.78rem; }
.vbg-drop { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 26px 18px; text-align: center; border: 1.5px dashed var(--vg-line); border-radius: var(--vg-r-md); background: #fbfcfd; cursor: pointer; transition: border-color 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), transform 0.2s var(--vg-ease); }
.vbg-drop:hover,
  .vbg-drop:focus-visible { border-color: var(--vg-brand-line); background: var(--vg-brand-tint); outline: none; }
.vbg-drop.is-dragover { border-color: var(--vg-brand); background: rgba(59, 153, 252, 0.14); transform: scale(1.01); }
.vbg-drop-icon { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); }
.vbg-drop-title { font-size: 0.78rem; font-weight: 800; color: var(--vg-ink); }
.vbg-drop-text { font-size: 0.7rem; line-height: 1.55; color: var(--vg-ink-muted); }
.vbg-img-preview { position: relative; border-radius: var(--vg-r-md); overflow: hidden; border: 1px solid var(--vg-line); background: var(--dark); }
.vbg-img-preview img { width: 100%; max-height: 260px; object-fit: cover; }
.vbg-img-remove { position: absolute; top: 10px; right: 10px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; color: #ffffff; background: rgba(10, 13, 18, 0.72); border: 1px solid rgba(255, 255, 255, 0.22); cursor: pointer; backdrop-filter: blur(6px); transition: background-color 0.2s var(--vg-ease), transform 0.2s var(--vg-ease); }
.vbg-img-remove:hover { background: rgba(244, 63, 94, 0.9); transform: rotate(90deg); }
.vbg-img-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; font-weight: 700; color: #93a2b5; background: var(--dark); border-top: 1px solid rgba(59, 153, 252, 0.22); }
.vbg-divider-or { display: flex; align-items: center; gap: 12px; margin: 16px 0; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--vg-ink-faint); }
.vbg-divider-or::before,
  .vbg-divider-or::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--vg-line); }
.vbg-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: var(--vg-r-full); white-space: nowrap; border: 1px solid transparent; }
.vbg-pill--info { color: var(--vg-brand-strong); background: var(--vg-brand-tint); border-color: var(--vg-brand-line); }
.vbg-checklist { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.vbg-check-item { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; font-size: 0.76rem; font-weight: 600; color: var(--vg-ink-soft); transition: background-color 0.2s var(--vg-ease); }
.vbg-check-item.is-done { color: var(--vg-ink); background: rgba(16, 185, 129, 0.07); }
.vbg-check-mark { flex: 0 0 auto; display: inline-grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; color: var(--vg-ink-faint); background: #f1f2f4; border: 1px solid var(--vg-line); transition: all 0.2s var(--vg-ease); }
.vbg-check-item.is-done .vbg-check-mark { color: #ffffff; background: linear-gradient(135deg, var(--ok), #047857); border-color: transparent; }
.vbg-check-mark svg { opacity: 0; transition: opacity 0.2s var(--vg-ease); }
.vbg-check-item.is-done .vbg-check-mark svg { opacity: 1; }
.vbg-check-req { margin-left: auto; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vg-critical); }
.vbg-check-item.is-done .vbg-check-req { display: none; }
.vbg-sub-list { display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 760px) {
.vbg-page-head { flex-direction: column; align-items: stretch; }
.vbg-actionbar { width: 100%; }
.vbg-actionbar .vbg-btn { flex: 1 1 auto; }
.vbg-actionbar-note { justify-content: flex-start; }
.vbg-card-body { padding: 18px 16px 20px; }
.vbg-card-head { padding: 16px 16px 14px; }
.vbg-modal-foot .vbg-btn { width: 100%; }
}
```

##### Preview dialog
```html
<div id="vbgPreviewModal" class="vbg-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vbgModalTitle">
 <div class="vbg-modal-backdrop"></div>
 <div class="vbg-modal-window" role="document">
  <div class="vbg-modal-head">
   <div>
    <span class="vbg-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Reader Preview
    </span>
    <h2 class="vbg-modal-title" id="vbgModalTitle">Untitled article</h2>
    <p class="vbg-modal-sub" id="vbgModalSlug">/blog/</p>
   </div>
   <button type="button" class="vbg-modal-close" aria-label="Close preview">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="vbg-modal-body" id="vbgModalBody"></div>
  <div class="vbg-modal-foot">
   <span class="vbg-modal-foot-note">This is a local preview rendered from your device only. Nothing has been published or submitted yet.</span>
   <div class="vbg-modal-foot-actions">
    <button type="button" class="vbg-btn vbg-btn--ghost">Close</button>
    <button type="button" class="vbg-btn vbg-btn--primary" id="vbgModalPublish">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Publish Post</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vbg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 22px; font-size: 0.79rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--vg-r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.2s var(--vg-ease), filter 0.2s var(--vg-ease), box-shadow 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), border-color 0.2s var(--vg-ease), color 0.2s var(--vg-ease); }
.vbg-btn svg { flex: 0 0 auto; }
.vbg-btn:active { transform: translateY(1px) scale(0.985); }
.vbg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.vbg-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--vg-brand) 0%, var(--vg-brand-strong) 100%); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 14px 30px -16px var(--vg-brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.24); }
.vbg-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 40px -18px var(--vg-brand-glow); }
.vbg-btn--ghost { color: var(--vg-ink); background: #ffffff; border-color: var(--vg-line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.vbg-btn--ghost:hover { transform: translateY(-2px); color: var(--vg-brand-strong); border-color: var(--vg-brand-line); box-shadow: 0 14px 30px -20px var(--vg-brand-glow); }
.vbg-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 22px; opacity: 0; transition: opacity 0.22s var(--vg-ease); }
.vbg-modal[hidden] { display: none !important; }
.vbg-modal.is-open { opacity: 1; }
.vbg-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vbg-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(940px, 100%); max-height: 92vh; border-radius: var(--vg-r-xl); overflow: hidden; background: #ffffff; border: 1px solid var(--vg-line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--vg-ease); }
.vbg-modal.is-open .vbg-modal-window { transform: translateY(0) scale(1); }
.vbg-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 24px 17px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 62%), linear-gradient(160deg, var(--vg-dark), #070b11); color: #ffffff; }
.vbg-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--vg-brand); }
.vbg-modal-title { margin: 8px 0 0; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.35; color: #ffffff; }
.vbg-modal-sub { margin: 6px 0 0; font-family: ui-monospace, SFMono-Regula
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `Verified Blogger`
- `Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.`
- `Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.`
- `Investigative technology journalist covering East African cyber policy and digital rights.`
- `Demo verification granted`
- `Reloading the Content Studio…`
- `Industry Updates`
- `Slug locked — click to resume auto-updates`
- `Lock slug to stop auto-updates`
- `The URL will no longer follow the title.`
- `The URL will now follow the title again.`
- `Nothing selected`
- `Highlight some text first, then clear its formatting.`
- `Tag limit reached`
- `is already attached to this post.`
- `Featured image removed`
- `The post no longer has a cover image.`
- `Unsupported file`
- `Please choose a JPG, PNG, WebP or GIF image.`
- `File too large`
- `Images must be 5 MB or smaller. This one is`
- `The image could not be read. Try a different file.`
- `The processed image is`
- `Image attached`
- `is now the featured image.`
- `Unsaved changes`
- `Working copy saved locally`
- `Local storage unavailable`
- `Your working copy is stored on this device.`
- `Restored saved working copy`
- `Untitled article`
- `Nothing to preview`
- `Write a title or some body content first.`
- `Preview Article`
- `Cover image dropped`
- `Local storage was full, so the post was saved without the featured image.`
- `New blank draft`
- `a title of at least 4 characters`
- `article body content`
- `Cannot publish yet`
- `before submitting.`
- `Storage unavailable`
- `Your post could not be saved locally. Check your browser storage settings and try again.`
- `Post submitted successfully!`
- `Sent to the admin moderation queue as`
- `Nothing to save`
- `Untitled draft`
- `Could not save draft`
- `Local storage is full or unavailable. Try removing the featured image.`
- `Pending Moderation`
- `Changes Requested`
- `" title="Load into editor" aria-label="Load into editor">`
- `That item is no longer available in local storage.`
- `Loaded into editor`
**Storage change (critical):** the prototype saved a working copy in `localStorage`, embedded the cover image as a data URL, and had a fake `Publish`. In this build: the draft lives on the server. First edit creates it (`POST /studio/drafts`), later edits `PUT /studio/drafts/:id`; **autosave** debounced 1.5 s after the last change when the draft has a title of ≥ 4 characters (title rule message verbatim from the prototype: `a title of at least 4 characters`); the save indicator shows `Unsaved changes` → `Saving…` → `Saved` (labels from the markup/strings). No browser storage. `/portal/studio/edit/new` creates the draft on first autosave and then `router.replace` to `/portal/studio/edit/<id>`.
**Fields → `StudioDraftBody`:** `title` (max 120), slug (auto from title, lock/unlock toggle with the verbatim toasts `Slug locked — click to resume auto-updates`, `Lock slug to stop auto-updates`, `The URL will no longer follow the title.`, `The URL will now follow the title again.`; regex from the contract), `category` (select with the five `BLOG_CATEGORY_LABELS`), `excerpt` (max 240, live counter), body, tags (max 8, chips, suggestions from `STUDIO_TAG_SUGGESTIONS`; messages `Tag limit reached`, `<tag> is already attached to this post.`), featured image + `imageAlt`.
**Body editor:** a `contentEditable`-lite editor is NOT allowed (XSS/IME risk); use a plain `<textarea>`-based Markdown editor with the toolbar buttons from the markup acting on the selection (`bold`, `italic`, `h2`, `h3`, `list`, `quote`, `link`, `code`, `clear formatting` → toast `Nothing selected` / `Highlight some text first, then clear its formatting.` when empty). The editor value IS `bodyMd` (sanitised again by the API). Word count + `Target <strong>met</strong>` indicator at 150 words (`STUDIO_LIMITS.minWords`); read time via `readMinutes`.
**Featured image:** drag-drop zone and file input (JPG/PNG/WebP/GIF, ≤ 5 MB; toasts `Unsupported file` / `Please choose a JPG, PNG, WebP or GIF image.`, `File too large` / `Images must be 5 MB or smaller.`); upload flow: `POST /studio/images/upload-url` → `PUT` file to the presigned URL → set `featuredImageUrl = publicUrl`; toasts `Image attached` / `Featured image removed` / `The post no longer has a cover image.`. Never embed data URLs in the body.
**Readiness checklist (`StudioSubmitReadiness`):** items verbatim `Title added`, `Category selected`, `Body ≥ 150 words`, `Excerpt written`, `Featured image attached`, `At least 2 tags`; the first three are required (marked), the rest optional. **Submit for review** (the prototype's `Publish` button becomes `Submit for Review`) is enabled only when the required items pass → `POST /studio/drafts/:id/submit`; `422 not_ready` → highlight failing items; success toast `{ kind: "ok", title: "Submitted for review", message: "An editor will review your article before it is published." }` and navigate to `/portal/studio`. After submit the editor is read-only unless the status returns to `changes_requested`. `Save Draft` button saves immediately. `Preview` opens the preview dialog rendering the Markdown with `SafeMarkdown` (Task 56; import from the marketing blog components via a shared path — if not exported there, copy the component into `apps/web/src/components/safe-markdown.tsx` and note it).
**Author card:** from the session (`displayName`, role label `Verified Blogger`, initials avatar, the verbatim line `Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.`).

**Tests:** autosave fires once after the debounce and only for titles ≥ 4 chars; the slug follows the title until locked; tag limit and duplicate messages; image type/size rejections; the upload flow order (url → PUT → state); readiness gating of Submit; 422 highlights items; no `localStorage` usage (spy); markdown helpers round-trip a sample.

---

**Data shape (TypeScript):**
```ts
// StudioDraftBody, StudioItem, StudioSubmitReadiness: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/studio/drafts body StudioDraftBody → 201 { data: StudioItem } · PUT /api/v1/studio/drafts/:id → 200 | 409 not_editable · DELETE → 204
// POST /api/v1/studio/drafts/:id/submit → 200 { data: StudioItem } | 422 { error: "not_ready"; details: StudioSubmitReadiness }
// POST /api/v1/studio/images/upload-url body { contentType; sizeBytes } → 200 { data: { uploadUrl; objectKey; publicUrl; expiresAt } }
```

---

**Out of scope:**
- Do not use `localStorage`, `contentEditable`, or data-URL images.
- Do not implement publishing (admin moderation does).
- Do not grant the blogger badge.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 72 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

