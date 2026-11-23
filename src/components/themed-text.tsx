import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, FontFamily, sansFamily, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextType =
  /** Serif: big screen titles ("Library", greeting). */
  | 'title'
  /** Serif: questions and section headings. */
  | 'heading'
  /** Serif: large numbers, e.g. a score. */
  | 'display'
  /** Sans: body text. */
  | 'default'
  | 'defaultBold'
  | 'small'
  | 'smallBold'
  /** Sans: small uppercase label, e.g. "READING · 2". */
  | 'label'
  | 'link'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

const SERIF_TYPES = new Set<TextType>(['title', 'heading', 'display']);

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flat = StyleSheet.flatten([
    { color: theme[themeColor ?? (type === 'link' ? 'accent' : 'text')] },
    styles[type],
    style,
  ]) as TextStyle;

  // Pick the font file for the weight rather than asking the platform to
  // embolden a custom font (Android does that poorly).
  const { fontWeight, ...rest2 } = flat;
  const fontFamily =
    flat.fontFamily ?? (SERIF_TYPES.has(type) ? FontFamily.serif : type === 'code' ? Fonts.mono : sansFamily(fontWeight));

  return <Text style={{ ...rest2, fontFamily }} {...rest} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 40, lineHeight: 44, letterSpacing: -0.2 },
  heading: { fontSize: 27, lineHeight: 32 },
  display: { fontSize: 88, lineHeight: 92 },
  default: { fontSize: 16, lineHeight: 23, fontWeight: 400 },
  defaultBold: { fontSize: 16, lineHeight: 23, fontWeight: 600 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' },
  link: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  code: { fontSize: 12, fontWeight: 500 },
});
