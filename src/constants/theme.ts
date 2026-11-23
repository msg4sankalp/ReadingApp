/**
 * Design tokens: "Warm paper" palette, serif display type (Instrument Serif)
 * with Inter for interface text. Book covers supply most of the color; the
 * interface stays calm around them.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#221E1A',
    textSecondary: '#7A7066',
    /** Page background: warm paper. */
    background: '#F5EFE5',
    /** Cards and inputs. */
    backgroundElement: '#FFFCF6',
    backgroundSelected: '#EDE4D6',
    accent: '#B85A38',
    onAccent: '#FFFCF6',
    /** Tinted fill for selected chips and tabs. */
    accentSoft: '#F1DDCF',
    /** Main call-to-action buttons. */
    cta: '#2A2622',
    onCta: '#FFFCF6',
    /** Bold feature cards (e.g. "Picked for you"). */
    highlight: '#E9C46A',
    onHighlight: '#221E1A',
    border: '#E6DCCD',
    danger: '#B42318',
  },
  dark: {
    text: '#F3ECE2',
    textSecondary: '#A89E92',
    background: '#1B1815',
    backgroundElement: '#26221E',
    backgroundSelected: '#332D27',
    accent: '#E08A66',
    onAccent: '#1B1815',
    accentSoft: '#3E2A20',
    cta: '#F3ECE2',
    onCta: '#1B1815',
    highlight: '#C9A24E',
    onHighlight: '#1B1815',
    border: '#3A332C',
    danger: '#FF8A80',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Font families, loaded with useFonts in the root layout. Custom fonts don't
 * synthesize weights reliably on Android, so each Inter weight is its own
 * family; ThemedText maps fontWeight to the right one.
 */
export const FontFamily = {
  serif: 'InstrumentSerif_400Regular',
  sans: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
} as const;

export function sansFamily(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : weight);
  if (w >= 700) return FontFamily.sans[700];
  if (w >= 600) return FontFamily.sans[600];
  if (w >= 500) return FontFamily.sans[500];
  return FontFamily.sans[400];
}

export const Fonts = Platform.select({
  ios: { mono: 'ui-monospace' },
  default: { mono: 'monospace' },
  web: { mono: 'var(--font-mono)' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 20,
  cover: 6,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** On web, native tabs render as a bar across the top of the page. */
export const TopTabInset = Platform.select({ web: 64 }) ?? 0;
export const MaxContentWidth = 800;
