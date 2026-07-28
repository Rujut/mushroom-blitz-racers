import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useAuthState } from '@/src/firebase/useAuthState';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


import { preloadGameBackground } from '@/src/utils/preloadGameAssets';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (loaded) preloadGameBackground();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  // Mount auth listener once — syncs Firebase user to playerStore + redirects
  useAuthState();

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/username" />
        <Stack.Screen name="(menu)/home" />
        <Stack.Screen name="(menu)/character-select" />
        <Stack.Screen name="(lobby)/matchmaking" />
        <Stack.Screen name="(lobby)/room" />
        <Stack.Screen name="game/index" />
        <Stack.Screen name="game/results" />
      </Stack>
    </ThemeProvider>
  );
}
