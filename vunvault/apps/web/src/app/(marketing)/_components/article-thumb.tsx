import { useId } from 'react';

/**
 * Generated article thumbnails (Task 49).
 *
 * ARTWORK, not UI chrome: per the catalogue's illustration exception the
 * literal fill/stroke colours of the six prototype variants stay exactly as
 * they were, inside this file only. The variant is chosen deterministically
 * by `index % 6`; gradient ids come from `useId()` (sanitised — React's raw
 * ids contain characters that are awkward inside `url(#…)` references) so
 * several thumbnails can coexist on a page and SSR markup is stable.
 */

const SHARED_PROPS = {
  viewBox: '0 0 400 225',
  preserveAspectRatio: 'xMidYMid slice',
  'aria-hidden': true,
} as const;

function Background({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a1931" />
          <stop offset="1" stopColor="#060a10" />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${uid})`} />
    </>
  );
}

function ShieldVariant() {
  return (
    <>
      <g fill="none" stroke="#3B99FC" strokeOpacity=".28" strokeWidth="1">
        <path d="M0 56h400M0 112h400M0 168h400M100 0v225M200 0v225M300 0v225" />
      </g>
      <path
        d="M200 62 L246 78 V124 c0 30-46 44-46 44 s-46-14-46-44 V78 z"
        fill="#3B99FC"
        fillOpacity=".16"
        stroke="#6FB6FF"
        strokeWidth="2"
      />
      <path
        d="M182 116 l14 14 26-30"
        fill="none"
        stroke="#6FB6FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function TrendVariant() {
  return (
    <>
      <g fill="none" stroke="#3B99FC" strokeOpacity=".35" strokeWidth="1.4">
        <path d="M70 150 L150 78 L232 132 L318 62" />
        <path d="M150 78 L232 132" />
      </g>
      <g fill="#6FB6FF">
        <circle cx="70" cy="150" r="6" />
        <circle cx="150" cy="78" r="6" />
        <circle cx="232" cy="132" r="6" />
      </g>
      <circle cx="318" cy="62" r="9" fill="#f43f5e" fillOpacity=".2" />
      <circle cx="318" cy="62" r="5" fill="#f43f5e" />
    </>
  );
}

function ReportVariant() {
  return (
    <>
      <rect
        x="120"
        y="46"
        width="160"
        height="134"
        rx="12"
        fill="#3B99FC"
        fillOpacity=".1"
        stroke="#3B99FC"
        strokeOpacity=".45"
        strokeWidth="1.6"
      />
      <g stroke="#6FB6FF" strokeOpacity=".65" strokeWidth="2.4" strokeLinecap="round">
        <path d="M148 88h104" />
        <path d="M148 114h104" />
        <path d="M148 140h62" />
      </g>
      <path
        d="M232 148 l12 12 24-28"
        fill="none"
        stroke="#34d399"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function SpikeVariant() {
  return (
    <>
      <path
        d="M0 158 L80 118 L160 142 L240 84 L320 112 L400 62 V225 H0 Z"
        fill="#3B99FC"
        fillOpacity=".1"
      />
      <path
        d="M0 158 L80 118 L160 142 L240 84 L320 112 L400 62"
        fill="none"
        stroke="#3B99FC"
        strokeOpacity=".45"
        strokeWidth="1.6"
      />
      <g fill="#6FB6FF">
        <circle cx="80" cy="118" r="4" />
        <circle cx="160" cy="142" r="4" />
        <circle cx="320" cy="112" r="4" />
      </g>
      <circle cx="240" cy="84" r="10" fill="#f43f5e" fillOpacity=".2" />
      <circle cx="240" cy="84" r="5" fill="#f43f5e" />
    </>
  );
}

function LockVariant() {
  return (
    <>
      <g fill="none" stroke="#3B99FC" strokeOpacity=".22" strokeWidth="1">
        <path d="M0 56h400M0 112h400M0 168h400M100 0v225M200 0v225M300 0v225" />
      </g>
      <rect
        x="168"
        y="102"
        width="64"
        height="54"
        rx="9"
        fill="#3B99FC"
        fillOpacity=".16"
        stroke="#6FB6FF"
        strokeWidth="2"
      />
      <path
        d="M182 102V86a18 18 0 0 1 36 0v16"
        fill="none"
        stroke="#6FB6FF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="200" cy="126" r="5.5" fill="#f43f5e" />
      <path d="M200 132v9" stroke="#f43f5e" strokeWidth="3.2" strokeLinecap="round" />
    </>
  );
}

function RadarVariant() {
  return (
    <>
      <g fill="none" stroke="#3B99FC" strokeOpacity=".28" strokeWidth="1.2">
        <circle cx="200" cy="112" r="30" />
        <circle cx="200" cy="112" r="60" />
        <circle cx="200" cy="112" r="90" />
      </g>
      <path d="M200 112 L200 22 A90 90 0 0 1 290 112 Z" fill="#3B99FC" fillOpacity=".12" />
      <path d="M200 112 L200 22" stroke="#3B99FC" strokeOpacity=".5" strokeWidth="1.2" />
      <path d="M200 112 L290 112" stroke="#3B99FC" strokeOpacity=".5" strokeWidth="1.2" />
      <g fill="#6FB6FF">
        <circle cx="236" cy="80" r="4" />
        <circle cx="170" cy="150" r="4" />
        <circle cx="262" cy="142" r="4" />
      </g>
      <circle cx="200" cy="112" r="6" fill="#6FB6FF" />
    </>
  );
}

const VARIANTS = [
  ShieldVariant,
  TrendVariant,
  ReportVariant,
  SpikeVariant,
  LockVariant,
  RadarVariant,
];

export interface ArticleThumbProps {
  index: number;
}

export function ArticleThumb({ index }: ArticleThumbProps) {
  const rawId = useId();
  const uid = `vvN${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const variantIndex = ((index % VARIANTS.length) + VARIANTS.length) % VARIANTS.length;
  const Variant = VARIANTS[variantIndex] ?? ShieldVariant;

  return (
    <svg {...SHARED_PROPS}>
      <Background uid={uid} />
      <Variant />
    </svg>
  );
}
