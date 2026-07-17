interface IconProps {
  href: string
  name: string
  size?: number
  className?: string
}

export function Icon({ href, name, size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ verticalAlign: 'middle', flexShrink: 0 }}
    >
      <use href={`${href}#${name}`} />
    </svg>
  )
}
