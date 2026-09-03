export interface FlowerProps {
  size?: number
  className?: string
}

/** A small decorative bloom, reused in the celebration overlay and the garden strip. */
export function Flower({ size = 28, className }: FlowerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="16" cy="8" rx="6" ry="7" fill="#f2a6c8" />
      <ellipse cx="16" cy="24" rx="6" ry="7" fill="#f2a6c8" />
      <ellipse cx="8" cy="16" rx="7" ry="6" fill="#f2a6c8" />
      <ellipse cx="24" cy="16" rx="7" ry="6" fill="#f2a6c8" />
      <circle cx="16" cy="16" r="6" fill="#f7c948" />
    </svg>
  )
}
