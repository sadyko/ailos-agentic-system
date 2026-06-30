/** @jsxRuntime automatic */
import { motion } from 'motion/react'
import { ArrowRight, PhoneCall } from 'lucide-react'
import { Button } from '../Button/Button'
import { DashboardMock } from './DashboardMock'
import { cn } from '../../lib/cn'

export interface HeroCta {
  /** The visible, accessible label of the call-to-action button. */
  label: string
  /** Where the CTA points (accepted for consumers; the demo renders buttons). */
  href: string
}

export interface HeroProps {
  /** Small pill label above the headline. Defaults to `'New'`. */
  badge?: string
  /** The single page headline (rendered as the one `<h1>`). */
  title?: string
  /** Supporting copy under the headline. */
  subtitle?: string
  /** Primary (filled) call to action. */
  primaryCta?: HeroCta
  /** Secondary (outlined) call to action. */
  secondaryCta?: HeroCta
  /** When set, renders a real `<img>` instead of the local SVG dashboard mock. */
  image?: { src: string; alt: string }
  /**
   * Whether to play the staggered entrance animation. When `false` — or when the
   * user prefers reduced motion — the hero renders fully visible with no hidden
   * initial state. Defaults to `true`.
   */
  animate?: boolean
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

/**
 * A marketing hero: an eyebrow badge link, a single headline, supporting copy,
 * two CTAs (rendered with the library {@link Button}, so they are real
 * `<button>`s), and a framed product visual with a subtle radial brand glow.
 *
 * Light-only and styled with design tokens (`brand` / `neutral`). The product
 * visual defaults to a local, decorative `<DashboardMock />` (no external
 * images); pass `image` to render a real `<img>` instead. Pass `animate={false}`
 * (or let the user's reduced-motion preference take over) to render fully
 * visible with no entrance animation.
 */
export function Hero({
  badge = 'New',
  title = 'Build better digital products, faster',
  subtitle = 'Design, build, and ship polished experiences with one connected toolkit — so your team can move quickly without cutting corners.',
  primaryCta = { label: 'Get started', href: '#get-started' },
  secondaryCta = { label: 'Book a call', href: '#contact' },
  image,
  animate = true,
}: HeroProps) {
  const shouldAnimate = animate && !prefersReducedMotion()

  const containerMotion = shouldAnimate
    ? {
        variants: containerVariants,
        initial: 'hidden' as const,
        animate: 'visible' as const,
      }
    : {}
  const itemMotion = shouldAnimate ? { variants: itemVariants } : {}

  return (
    <section className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 pt-16">
      {/* Decorative radial glow */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 size-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(20%_80%_at_20%_0%,rgba(43,84,230,0.10),transparent)]" />
      </div>

      <motion.div
        className="relative z-10 flex max-w-2xl flex-col gap-5"
        {...containerMotion}
      >
        <motion.a
          href="#link"
          className="group flex w-fit items-center gap-3 rounded-sm border border-neutral-100 bg-white p-1 shadow-sm transition-colors"
          {...itemMotion}
        >
          <span className="rounded-xs border border-neutral-100 bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-900 shadow-sm">
            {badge}
          </span>
          <span className="text-xs text-neutral-700">accepting new client projects</span>
          <span className="block h-5 border-l border-neutral-100" aria-hidden="true" />
          <span className="pr-1">
            <ArrowRight className="size-3 -translate-x-0.5 text-neutral-500 transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </motion.a>

        <motion.h1
          className="text-balance text-4xl font-medium leading-tight text-neutral-900 md:text-5xl"
          {...itemMotion}
        >
          {title}
        </motion.h1>

        <motion.p
          className="text-sm tracking-wide text-neutral-700 sm:text-lg md:text-xl"
          {...itemMotion}
        >
          {subtitle}
        </motion.p>

        <motion.div
          className="flex w-fit items-center gap-3 pt-2"
          {...itemMotion}
        >
          <Button variant="secondary">
            <PhoneCall className="size-4" aria-hidden="true" />
            {secondaryCta.label}
          </Button>
          <Button variant="primary">
            {primaryCta.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </motion.div>
      </motion.div>

      <div className="relative">
        {/* Decorative blurred glow behind the visual */}
        <div
          aria-hidden="true"
          className="absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-110 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(43,84,230,0.10),transparent,transparent)] blur-[50px]"
        />
        <motion.div
          className={cn(
            'relative mx-auto mt-8 max-w-5xl overflow-hidden px-2 sm:mt-12 md:mt-20',
            '[mask-image:linear-gradient(to_bottom,black_60%,transparent)]',
          )}
          {...itemMotion}
        >
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-lg border border-neutral-100 bg-white p-2 shadow-xl ring-1 ring-neutral-100">
            {image ? (
              <img
                src={image.src}
                alt={image.alt}
                className="aspect-video w-full rounded-lg border border-neutral-100 object-cover"
              />
            ) : (
              <DashboardMock />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
