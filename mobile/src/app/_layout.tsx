import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/** Root navigator: tab group (Discover/Saved/Review) with the Lesson,
 * Saved-lesson and Quiz screens pushed on top so they get a native back
 * header. */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lesson/[topic]" options={{ title: 'Lesson' }} />
        <Stack.Screen name="saved/[id]" options={{ title: 'Lesson' }} />
        <Stack.Screen name="quiz" options={{ title: 'Quiz' }} />
        <Stack.Screen name="tutor" options={{ title: 'Tutor' }} />
      </Stack>
    </ThemeProvider>
  );
}
