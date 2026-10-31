'use client';

import { cn } from '@vunvault/lib';
import { BLOG_CATEGORY_LABELS, type BlogCategory } from '@vunvault/contracts';
import { useBlogCategories } from '../_hooks/use-blog';
import '../_styles/blog.css';

/**
 * Category filter pills — `All` plus one pill per
 * `BLOG_CATEGORY_LABELS` value present in the loaded (unfiltered) catalog
 * data, in the label map's order. A proper `role="tablist"` with
 * `aria-selected`; clicking a pill filters the list.
 *
 * The pill styling is authored in `blog.css`: the spec names the class
 * (`vv-blog-pill`, referenced by its reduced-motion block) but embeds no rule
 * block for it — the pills follow the marketing nav's pill idiom.
 */

export type CategoryPillValue = BlogCategory | 'all';

export interface CategoryPillsProps {
  active: CategoryPillValue;
  onSelect(category: CategoryPillValue): void;
}

export function CategoryPills({ active, onSelect }: CategoryPillsProps) {
  const { data } = useBlogCategories();
  const items = data ?? [];

  const present = (Object.keys(BLOG_CATEGORY_LABELS) as BlogCategory[]).filter((category) =>
    items.some((item) => item.category === category),
  );

  const pills: { value: CategoryPillValue; label: string }[] = [
    { value: 'all', label: 'All' },
    ...present.map((category) => ({
      value: category as CategoryPillValue,
      label: BLOG_CATEGORY_LABELS[category],
    })),
  ];

  return (
    <div
      className="vv-blog-filters"
      id="vv-blog-filters"
      role="tablist"
      aria-label="Filter reports by category"
    >
      {pills.map((pill) => (
        <button
          key={pill.value}
          type="button"
          role="tab"
          aria-selected={active === pill.value}
          className={cn('vv-blog-pill', active === pill.value && 'is-active')}
          onClick={() => onSelect(pill.value)}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
