/** Decorative, non-interactive nature backdrop: sky, grass, two simple trees. */
export function GardenBackdrop() {
  return (
    <svg
      className="garden-backdrop"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="800" height="600" fill="#eaf6ef" />
      <rect x="0" y="420" width="800" height="180" fill="#bfe3a8" />
      <rect x="0" y="420" width="800" height="14" fill="#a9d68f" />

      <g>
        <rect x="52" y="330" width="16" height="110" rx="4" fill="#a9743f" />
        <circle cx="60" cy="300" r="46" fill="#8fbf6e" />
        <circle cx="30" cy="320" r="32" fill="#9ecb7c" />
        <circle cx="92" cy="320" r="32" fill="#9ecb7c" />
      </g>

      <g>
        <rect x="716" y="350" width="14" height="90" rx="4" fill="#a9743f" />
        <circle cx="723" cy="322" r="38" fill="#8fbf6e" />
        <circle cx="698" cy="340" r="26" fill="#9ecb7c" />
        <circle cx="748" cy="340" r="26" fill="#9ecb7c" />
      </g>
    </svg>
  )
}
