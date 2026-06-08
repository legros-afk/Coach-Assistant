interface Props {
  size?: number
  color?: string  // kept for API compat, unused with PNG logo
}

export function WoodfordMark({ size = 24 }: Props) {
  const inner = Math.round(size * 0.82)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src="/logo.png"
        alt="Sheffield Oaks RUFC"
        width={inner}
        height={inner}
        style={{ objectFit: 'contain' }}
      />
    </div>
  )
}
