import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const TypeIcon = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="9" height="11" rx="1" transform="rotate(-8 8 10.5)" />
    <rect x="11" y="7.5" width="9.5" height="12" rx="1" transform="rotate(7 15.75 13.5)" />
  </svg>
)

export const LayoutIcon = () => (
  <svg {...base}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M12 3.5v17M12 12h8.5" />
  </svg>
)

export const FormatIcon = () => (
  <svg {...base}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
  </svg>
)

export const StyleIcon = () => (
  <svg {...base}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
)

export const PhotosIcon = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 15.5-4.5-4.5-8 8" />
  </svg>
)

export const SwapIcon = () => (
  <svg {...base}>
    <path d="M7 4 3.5 7.5 7 11M3.5 7.5H16M17 13l3.5 3.5L17 20M20.5 16.5H8" />
  </svg>
)

export const ReplaceIcon = () => (
  <svg {...base}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" />
  </svg>
)

export const TrashIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...base}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const ShuffleIcon = () => (
  <svg {...base}>
    <path d="M3.5 7h3.5c5 0 5 10 10 10h3.5M17.5 14l3 3-3 3M3.5 17H7c1.6 0 2.7-1 3.6-2.4M13.4 9.4C14.3 8 15.4 7 17 7h3.5M17.5 4l3 3-3 3" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const DownloadIcon = () => (
  <svg {...base}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </svg>
)

export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 3.5V15M8 7.5l4-4 4 4M7 11H5.5v9.5h13V11H17" />
  </svg>
)

export const TextIcon = () => (
  <svg {...base}>
    <path d="M4 18.5 8.75 6h1.5L15 18.5M5.9 14.2h7.2" />
    <path d="M20 11.4v7.1M20 11.4c-1.9 0-3.4 1.4-3.4 3.2s1.5 3.2 3.4 3.2" />
  </svg>
)

export const ContrastIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  </svg>
)
