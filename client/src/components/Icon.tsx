type IconName =
  'building' | 'upload' | 'arrow' | 'close' | 'document' | 'check' | 'image' | 'reset' | 'expand';
const paths: Record<IconName, React.ReactNode> = {
  building: (
    <>
      <path d="M4 21V8l8-5 8 5v13M9 21V11h6v10M2 21h20" />
      <path d="M8 7h.01M16 7h.01" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  document: (
    <>
      <path d="M14 2H5v20h14V7l-5-5v5h5M8 12h8M8 16h8" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8" cy="8" r="1" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </>
  ),
  reset: (
    <>
      <path d="M3 10a9 9 0 1 1 2 9M3 3v7h7" />
    </>
  ),
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
