/**
 * Web entry: load CanvasKit WASM before Expo Router mounts any Skia components.
 * @see https://shopify.github.io/react-native-skia/docs/getting-started/web/
 */
import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb()
  .then(() => {
    renderRootComponent(App);
  })
  .catch((err) => {
    console.error('[Skia] Failed to load CanvasKit:', err);
    // Still boot the app so menus work; Skia areas show fallback text.
    renderRootComponent(App);
  });
