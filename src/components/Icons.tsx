import type { SVGProps } from 'react';
import type { Theme } from '../types';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 20, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...rest,
});

/** Stadium bowl seen from above. */
export const SportIcon = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="10" ry="7" />
    <ellipse cx="12" cy="12" rx="5.5" ry="3.2" />
    <path d="M12 5v14" />
  </svg>
);
export const MusicIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);
export const GeographyIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
  </svg>
);
/** Hourglass. */
export const HistoryIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10s-10 4-10 10M17 2c0 6-10 6-10 10s10 4 10 10" />
  </svg>
);

export const THEME_ICONS: Record<Theme, (p: P) => JSX.Element> = {
  sport: SportIcon,
  music: MusicIcon,
  geography: GeographyIcon,
  history: HistoryIcon,
};

export const TickIcon = (p: P) => (
  <svg {...base({ strokeWidth: 3, ...p })}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);
export const CrossIcon = (p: P) => (
  <svg {...base({ strokeWidth: 3, ...p })}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" />
  </svg>
);
export const FlameIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22c4 0 7-2.7 7-6.8 0-4.2-3.3-6.3-4.2-10.2-2.3 1.4-3.3 3.6-3.3 5.6-1.2-.8-1.9-2.1-2-3.6C7 9 5 11.6 5 15.2 5 19.3 8 22 12 22z" />
  </svg>
);
export const ShareIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" />
  </svg>
);
export const CopyIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const ArrowIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);
/** Rangefinder mark used as the logo. */
export const LogoMark = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
  </svg>
);
