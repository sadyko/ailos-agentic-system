// Single source of design truth. The gallery injects these into the Tailwind CDN config
// so components render with the right brand colors; DESIGN_TOKENS.md mirrors this for humans.
export const tokens = {
  colors: {
    brand: {
      50: '#eef4ff', 100: '#d9e6ff', 500: '#3b6cff', 600: '#2b54e6', 700: '#1f3fb4',
    },
    neutral: {
      50: '#f7f7f8', 100: '#ededf0', 300: '#d3d4da', 500: '#8a8c98',
      700: '#3f4150', 900: '#1b1c22',
    },
    danger: { 500: '#e5484d', 600: '#cc3b40' },
  },
  radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem' },
} as const
