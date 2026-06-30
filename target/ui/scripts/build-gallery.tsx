import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { tokens } from '../src/tokens'

type Story = { name: string; element: ReactElement }

// ESM (package.json "type":"module"): derive __dirname from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')                    // target/ui
const COMPONENTS_DIR = join(ROOT, 'src', 'components')
const OUT_DIR = resolve(ROOT, '..', '..', '40_DESIGN', 'gallery')   // repo-root/40_DESIGN/gallery

const tailwindConfig = JSON.stringify({
  theme: { extend: { colors: { brand: tokens.colors.brand, neutral: tokens.colors.neutral, danger: tokens.colors.danger }, borderRadius: tokens.radius } },
})

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500&display=swap" rel="stylesheet" />
<script>tailwind.config = ${tailwindConfig}</script>
</head><body class="bg-neutral-50 text-neutral-900 p-8">${body}</body></html>`
}

async function loadStories(dir: string): Promise<{ component: string; stories: Story[] }[]> {
  if (!existsSync(COMPONENTS_DIR)) return []
  const out: { component: string; stories: Story[] }[] = []
  for (const entry of readdirSync(COMPONENTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const storyFile = join(COMPONENTS_DIR, entry.name, `${entry.name}.stories.tsx`)
    if (!existsSync(storyFile)) continue
    const mod = await import(pathToFileURL(storyFile).href)
    if (Array.isArray(mod.stories)) out.push({ component: entry.name, stories: mod.stories })
  }
  return out
}

const all = await loadStories(COMPONENTS_DIR)
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

for (const { component, stories } of all) {
  const body = stories.map((s) =>
    `<section class="mb-8"><h2 class="text-sm font-medium text-neutral-500 mb-3">${s.name}</h2>` +
    `<div class="flex flex-wrap items-center gap-4">${renderToStaticMarkup(s.element)}</div></section>`,
  ).join('\n')
  writeFileSync(join(OUT_DIR, `${component}.html`), page(component, body), 'utf8')
}

const links = all.map((c) => `<li class="mb-2"><a class="text-brand-600 underline" href="./${c.component}.html">${c.component}</a></li>`).join('\n')
writeFileSync(join(OUT_DIR, 'index.html'),
  page('Component Gallery', `<h1 class="text-2xl font-semibold mb-6">Component Gallery</h1><ul>${links || '<li>No components yet.</li>'}</ul>`),
  'utf8')

console.log(`gallery: wrote ${all.length} component page(s) to ${OUT_DIR}`)
