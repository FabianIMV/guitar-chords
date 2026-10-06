/** Small stroke icon set (24×24, currentColor) so the UI doesn't rely on emoji. */

const PATHS: Record<string, JSX.Element> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16 16" />
    </>
  ),
  back: <path d="M15 18 9 12l6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  up: <path d="m6 15 6-6 6 6" />,
  right: <path d="m9 6 6 6-6 6" />,
  heart: <path d="M12 20.5s-7.5-4.6-9.6-9.1C1 8.1 3.1 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.7 0 5.8 3.6 4.4 6.9-2.1 4.5-9.6 9.1-9.6 9.1z" />,
  share: (
    <>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="m6 7 1 13h10l1-13" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  library: (
    <>
      <path d="M5 4v16M9.5 4v16" />
      <path d="m14 5.2 3.9-1 3.6 15-3.9 1z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  text: (
    <>
      <path d="m3.5 19 5-14 5 14M5.5 14h6" />
      <path d="m14.5 19 3-8 3 8M15.6 16.2h3.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10.5 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7 9.5 5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  capo: (
    <>
      <rect x="3" y="9" width="18" height="6" rx="3" />
      <path d="M7 9V5M12 9V5M17 9V5" />
    </>
  ),
  grid: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M5 8.5h14M5 13h14M5 17h14M9.7 3.5v17M14.3 3.5v17" />
    </>
  ),
  wrap: (
    <>
      <path d="M4 6h16M4 18h6" />
      <path d="M4 12h12.5a3 3 0 0 1 0 6H14" />
      <path d="m16 16-2 2 2 2" />
    </>
  ),
  versions: (
    <>
      <rect x="4" y="7" width="12" height="13" rx="1.5" />
      <path d="M8 4h10.5A1.5 1.5 0 0 1 20 5.5V17" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  bug: (
    <>
      <rect x="7" y="7.5" width="10" height="12" rx="5" />
      <path d="M12 7.5v12M7 12H3.5M20.5 12H17M7.6 16.5 4.5 18.5M16.4 16.5l3.1 2M7.6 9l-2.6-2M16.4 9 19 7M9.5 7.5a2.5 2.5 0 0 1 5 0" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  offline: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4-2.6M11 5.6a15 15 0 0 1 11 3.9" />
      <circle cx="12" cy="19.5" r="0.8" fill="currentColor" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

interface Props {
  name: IconName
  size?: number
  filled?: boolean
  className?: string
  title?: string
}

export function Icon({ name, size = 22, filled, className, title }: Props) {
  return (
    <svg
      className={`icon${className ? ' ' + className : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  )
}
