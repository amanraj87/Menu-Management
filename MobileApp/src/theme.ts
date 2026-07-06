/**
 * Design tokens mirroring the WebApp's dark theme with green accent.
 */
export const colors = {
  bg: '#0f0f12',
  bgElevated: '#141418',
  surface: '#18181c',
  surfaceAlt: '#1e1e24',
  border: '#2a2a30',
  borderStrong: '#3a3a42',
  text: '#e4e4e7',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
  primary: '#22c55e',
  primaryDark: '#16a34a',
  primarySoft: 'rgba(34,197,94,0.14)',
  secondary: '#3f3f46',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245,158,11,0.16)',
  success: '#22c55e',
  info: '#38bdf8',
  overlay: 'rgba(0,0,0,0.6)',
  white: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const font = {
  h1: 26,
  h2: 21,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const mealMeta = {
  breakfast: { label: 'Breakfast', icon: '🌅', accent: '#f59e0b' },
  lunch: { label: 'Lunch', icon: '☀️', accent: '#22c55e' },
  dinner: { label: 'Dinner', icon: '🌙', accent: '#818cf8' },
} as const;
