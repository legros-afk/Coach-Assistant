interface Props {
  size?: number
  color?: string
}

export function WoodfordMark({ size = 24, color = '#782880' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="3" fill="none" />
      <ellipse cx="50" cy="42" rx="11" ry="14" fill={color} />
      <path d="M 39 30 Q 50 25 61 30 L 60 36 Q 50 33 40 36 Z" fill={color} opacity="0.6" />
      <path d="M 50 56 L 50 72" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path
        d="M 30 60 Q 22 65 25 75 Q 35 72 40 65 Z M 70 60 Q 78 65 75 75 Q 65 72 60 65 Z"
        fill={color}
        opacity="0.5"
      />
    </svg>
  )
}
