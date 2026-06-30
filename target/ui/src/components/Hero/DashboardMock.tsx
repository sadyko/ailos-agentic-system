/** @jsxRuntime automatic */
import { cn } from '../../lib/cn'

/**
 * A self-contained, decorative "analytics dashboard" mock used by {@link Hero}
 * in place of an external product screenshot.
 *
 * The whole illustration is exposed to assistive tech as a single labelled image
 * (`role="img"` + an accessible name containing "dashboard"); the inner SVG and
 * mock chrome are `aria-hidden` so none of the placeholder data is announced.
 * Colors come from the design tokens (`brand-600` `#2b54e6`, neutrals).
 */
export function DashboardMock({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Sample product dashboard"
      className={cn(
        'w-full overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm',
        className,
      )}
    >
      <svg
        viewBox="0 0 640 360"
        className="block h-auto w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Surface */}
        <rect width="640" height="360" fill="#ffffff" />

        {/* Top bar */}
        <rect x="0" y="0" width="640" height="44" fill="#f7f7f8" />
        <circle cx="22" cy="22" r="5" fill="#d3d4da" />
        <circle cx="40" cy="22" r="5" fill="#d3d4da" />
        <circle cx="58" cy="22" r="5" fill="#d3d4da" />
        <rect x="84" y="16" width="120" height="12" rx="6" fill="#ededf0" />
        <rect x="556" y="14" width="60" height="16" rx="8" fill="#2b54e6" />
        <line x1="0" y1="44" x2="640" y2="44" stroke="#ededf0" strokeWidth="1" />

        {/* Sidebar */}
        <rect x="0" y="44" width="120" height="316" fill="#f7f7f8" />
        <rect x="16" y="68" width="88" height="10" rx="5" fill="#d3d4da" />
        <rect x="16" y="98" width="72" height="10" rx="5" fill="#ededf0" />
        <rect x="16" y="124" width="80" height="10" rx="5" fill="#ededf0" />
        <rect x="16" y="150" width="64" height="10" rx="5" fill="#ededf0" />
        <rect x="16" y="176" width="76" height="10" rx="5" fill="#ededf0" />

        {/* Stat tiles */}
        <g>
          <rect x="144" y="68" width="148" height="72" rx="10" fill="#ffffff" stroke="#ededf0" />
          <rect x="160" y="84" width="56" height="8" rx="4" fill="#d3d4da" />
          <rect x="160" y="102" width="80" height="16" rx="6" fill="#1b1c22" />
          <rect x="160" y="126" width="40" height="6" rx="3" fill="#2b54e6" />
        </g>
        <g>
          <rect x="308" y="68" width="148" height="72" rx="10" fill="#ffffff" stroke="#ededf0" />
          <rect x="324" y="84" width="56" height="8" rx="4" fill="#d3d4da" />
          <rect x="324" y="102" width="64" height="16" rx="6" fill="#1b1c22" />
          <rect x="324" y="126" width="56" height="6" rx="3" fill="#2b54e6" />
        </g>
        <g>
          <rect x="472" y="68" width="152" height="72" rx="10" fill="#ffffff" stroke="#ededf0" />
          <rect x="488" y="84" width="56" height="8" rx="4" fill="#d3d4da" />
          <rect x="488" y="102" width="72" height="16" rx="6" fill="#1b1c22" />
          <rect x="488" y="126" width="48" height="6" rx="3" fill="#3b6cff" />
        </g>

        {/* Line chart panel */}
        <rect x="144" y="160" width="312" height="180" rx="10" fill="#ffffff" stroke="#ededf0" />
        <rect x="160" y="176" width="84" height="10" rx="5" fill="#d3d4da" />
        {/* gridlines */}
        <line x1="160" y1="300" x2="440" y2="300" stroke="#ededf0" strokeWidth="1" />
        <line x1="160" y1="262" x2="440" y2="262" stroke="#ededf0" strokeWidth="1" />
        <line x1="160" y1="224" x2="440" y2="224" stroke="#ededf0" strokeWidth="1" />
        {/* area + trend line */}
        <path
          d="M160 286 L210 268 L260 276 L310 240 L360 250 L410 212 L440 222 L440 300 L160 300 Z"
          fill="#2b54e6"
          fillOpacity="0.08"
        />
        <polyline
          points="160,286 210,268 260,276 310,240 360,250 410,212 440,222"
          fill="none"
          stroke="#2b54e6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="310" cy="240" r="4" fill="#2b54e6" />
        <circle cx="410" cy="212" r="4" fill="#2b54e6" />

        {/* Bar chart panel */}
        <rect x="472" y="160" width="152" height="180" rx="10" fill="#ffffff" stroke="#ededf0" />
        <rect x="488" y="176" width="72" height="10" rx="5" fill="#d3d4da" />
        <rect x="492" y="270" width="20" height="50" rx="4" fill="#ededf0" />
        <rect x="522" y="244" width="20" height="76" rx="4" fill="#d3d4da" />
        <rect x="552" y="220" width="20" height="100" rx="4" fill="#3b6cff" />
        <rect x="582" y="200" width="20" height="120" rx="4" fill="#2b54e6" />
      </svg>
    </div>
  )
}
