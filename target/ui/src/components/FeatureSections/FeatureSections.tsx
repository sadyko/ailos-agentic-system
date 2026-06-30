/** @jsxRuntime automatic */
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  Sparkles,
  Check,
  Download,
  Mail,
  Phone,
  Copy,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '../../lib/cn'

export interface Feature {
  /** Stable key for the card. */
  id: string
  /** The card's heading (rendered as an `<h3>`). */
  title: string
  /** Supporting copy under the heading. */
  description: string
  /** The decorative mock illustration shown above the text. */
  content: ReactNode
}

export interface FeatureSectionsProps {
  /** Pill label above the title. Defaults to `"Feature-rich suite"`. */
  badge?: string
  /** Two-line section title (use `\n` for the line break). */
  title?: string
  /** Override the six default feature cards. */
  features?: Feature[]
  /**
   * Whether to play the staggered entrance animation. When `false` (or when the
   * user prefers reduced motion) the section renders fully visible with no
   * entrance animation. Defaults to `true`.
   */
  animate?: boolean
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------------------
// Shared mock-UI helpers (decorative illustrations only — all aria-hidden)
// ---------------------------------------------------------------------------

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function FilterPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs">
      <span className="text-neutral-500">{label}:</span>
      <span className="font-medium text-brand-600">{value}</span>
    </div>
  )
}

function ProfileMini({
  initials,
  name,
  company,
}: {
  initials: string
  name: string
  company: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
        aria-hidden="true"
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">{name}</p>
        <p className="truncate text-xs text-neutral-500">{company}</p>
      </div>
    </div>
  )
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="truncate text-xs font-medium text-neutral-900">{value}</p>
    </div>
  )
}

function CreditDonut({
  value,
  total,
  label,
  color,
}: {
  value: number
  total: number
  label: string
  color: string
}) {
  // Donut math (geometry attributes preserved from the original mock).
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const fraction = Math.min(Math.max(value / total, 0), 1)
  const dash = circumference * fraction
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            className="stroke-neutral-100"
            strokeWidth="8"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-neutral-900"
          aria-hidden="true"
        >
          {value}
        </span>
      </div>
      <p className="text-center text-xs text-neutral-500">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The six mock cards (decorative — wrapped aria-hidden by the grid)
// ---------------------------------------------------------------------------

function ExportCard() {
  return (
    <div className="w-full max-w-xs rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-neutral-500">
        <LinkedInIcon className="h-4 w-4 text-[#0077b5]" />
        <span>Sales Platform</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill label="Current job title" value="CTO" />
        <FilterPill label="Function" value="Information Technology" />
        <FilterPill label="Seniority" value="CXO" />
      </div>
      <div className="mb-4 space-y-3">
        <ProfileMini initials="JL" name="Jordan Lee" company="Acme" />
        <ProfileMini initials="RC" name="Riley Chen" company="Globex" />
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export leads
      </button>
    </div>
  )
}

function VerificationCard() {
  return (
    <div className="w-full max-w-xs rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          aria-hidden="true"
        >
          JL
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            Jordan Lee
          </p>
          <p className="truncate text-xs text-neutral-500">
            jordan.lee@example.com
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-1 text-[11px] font-medium text-[#22c55e]">
          <Check className="h-3 w-3" aria-hidden="true" />
          Verified
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-neutral-500">
        <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
        <span>verified</span>
      </div>
    </div>
  )
}

function LinkedInVersionsCard() {
  const rows = [
    { glyph: 'in', label: 'Platform' },
    { glyph: 'in', label: 'Recruiter' },
    { glyph: 'in', label: 'Sales Platform' },
  ]
  return (
    <div className="w-full max-w-xs space-y-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-7 w-7 items-center justify-center rounded bg-[#0077b5] text-xs font-bold lowercase text-white"
              aria-hidden="true"
            >
              in
            </span>
            <span className="text-sm font-medium text-neutral-900">
              {row.label}
            </span>
          </div>
          <Check className="h-4 w-4 text-[#22c55e]" aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}

function ProspectDataCard() {
  return (
    <div className="w-full max-w-xs grid grid-cols-2 gap-2">
      <DataField label="Phone" value="+1 (555) 010-1234" />
      <DataField label="Company Ind…" value="Software" />
      <DataField label="Headcount" value="2,384" />
      <DataField label="Founded" value="2003" />
      <DataField label="Work Ma…" value="jordan.lee@example.com" />
      <DataField label="Job Title" value="Product Manager" />
      <div className="col-span-2">
        <DataField label="Location" value="California, United States" />
      </div>
    </div>
  )
}

function CreditsCard() {
  return (
    <div className="w-full max-w-xs rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-around">
        <CreditDonut
          value={51}
          total={100}
          label="Email credits left"
          color="#fbbf24"
        />
        <CreditDonut
          value={43}
          total={100}
          label="Phone credits left"
          color="#2b54e6"
        />
      </div>
    </div>
  )
}

function ContactPointsCard() {
  const contacts = [
    { icon: Mail, label: 'jordan.lee@example.com' },
    { icon: Mail, label: 'jordan.lee@mail.com' },
    { icon: Phone, label: '+1 (555) 010-1234' },
  ]
  return (
    <div className="w-full max-w-xs rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-neutral-500">
        <span>Email(s)</span>
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        {contacts.map((contact) => {
          const Icon = contact.icon
          return (
            <div
              key={contact.label}
              className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  className="h-3.5 w-3.5 shrink-0 text-brand-600"
                  aria-hidden="true"
                />
                <span className="truncate text-xs text-neutral-900">
                  {contact.label}
                </span>
              </div>
              <Copy
                className="h-3.5 w-3.5 shrink-0 text-neutral-500"
                aria-hidden="true"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const DEFAULT_FEATURES: Feature[] = [
  {
    id: 'export',
    title: 'Export searches or lists',
    description: 'Export entire searches and lists in just 1 click',
    content: <ExportCard />,
  },
  {
    id: 'verification',
    title: 'Built-in email verification',
    description: 'Get 99%+ deliverability rates, and only pay for valid emails',
    content: <VerificationCard />,
  },
  {
    id: 'linkedin-versions',
    title: 'Supports all platform versions',
    description: 'Powerful tools built for the platform, Recruiter, and Sales Platform',
    content: <LinkedInVersionsCard />,
  },
  {
    id: 'prospect-data',
    title: 'Fully enriched prospect data',
    description:
      '30+ data points, like: revenue, funding, headcount, and much more',
    content: <ProspectDataCard />,
  },
  {
    id: 'credits',
    title: 'Only pay for valid contact information',
    description: 'Your credits are only used on contact information',
    content: <CreditsCard />,
  },
  {
    id: 'contact-points',
    title: 'Find multiple contact points',
    description:
      'Finds work emails, personal emails, direct dials, and cell numbers',
    content: <ContactPointsCard />,
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

/**
 * A marketing "features" grid: a centered header (badge + Playfair italic title)
 * over a responsive six-card grid, where each card is a decorative mini mock-UI
 * illustration.
 *
 * Light-only and styled with design tokens. Decorative mocks are `aria-hidden`;
 * the real heading text stays at AA contrast. Pass `animate={false}` (or let the
 * user's reduced-motion preference take over) to render fully visible with no
 * entrance animation.
 */
export function FeatureSections({
  badge = 'Feature-rich suite',
  title = 'Everything you need\nin one suite',
  features = DEFAULT_FEATURES,
  animate = true,
}: FeatureSectionsProps) {
  const shouldAnimate = animate && !prefersReducedMotion()

  const headerMotion = shouldAnimate
    ? {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.6 },
      }
    : {}

  const gridMotion = shouldAnimate
    ? {
        variants: containerVariants,
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true },
      }
    : {}

  const cardMotion = shouldAnimate ? { variants: itemVariants } : {}

  return (
    <section className="w-full bg-neutral-50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div className="mb-16 text-center" {...headerMotion}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-100 bg-white px-4 py-2">
            <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span className="text-sm font-medium text-neutral-700">
              {badge}
            </span>
          </div>
          <h2
            className="mx-auto max-w-3xl whitespace-pre-line text-4xl font-normal italic leading-tight text-neutral-900 md:text-5xl"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {title}
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          {...gridMotion}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm',
              )}
              {...cardMotion}
            >
              <div
                className="flex flex-1 items-center justify-center p-6"
                aria-hidden="true"
              >
                {feature.content}
              </div>
              <div className="border-t border-neutral-100 px-6 pb-6 pt-5">
                <h3 className="mb-1 text-lg font-semibold text-neutral-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-700">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
