/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // React Native reports `null` when no preference is available; treat that
  // as light. (RN 0.88's ColorSchemeName is "light" | "dark" only.)
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
