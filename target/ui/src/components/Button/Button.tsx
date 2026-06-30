/** @jsxRuntime automatic */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. Defaults to `primary`. */
  variant?: Variant
  /** Control height / padding / type scale. Defaults to `md`. */
  size?: Size
  /** When true, shows a busy state and disables interaction. */
  loading?: boolean
  /** The accessible name of the button. */
  children: ReactNode
}

// Shared across every variant: token radius, visible focus ring, motion, and a
// disabled treatment that reads clearly without relying on color alone.
const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors duration-150 select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
}

// Each variant defines a resting, hover, and active state so the control never
// looks inert. Colors are tokens-only (brand / neutral).
const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-neutral-50 hover:bg-brand-700 active:bg-brand-700 ' +
    'disabled:hover:bg-brand-600',
  secondary:
    'bg-neutral-100 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-300 ' +
    'disabled:hover:bg-neutral-100',
  ghost:
    'bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100 ' +
    'disabled:hover:bg-transparent',
}

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/**
 * Accessible, token-styled button.
 *
 * Renders a native `<button>` so it is keyboard-operable and announced
 * correctly. `loading` marks it `aria-busy` and non-interactive; native
 * `disabled` and any other button attributes are forwarded.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      <span>{children}</span>
    </button>
  )
}
