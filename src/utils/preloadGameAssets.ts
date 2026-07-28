import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { GAME_BG_SVG } from '@/src/components/game/parallaxBackgroundConstants';
import { resolveGameBackgroundUri, warmGameBackgroundUriCache } from '@/src/utils/gameBackgroundUri';

let preloadPromise: Promise<void> | null = null;
let preloaded = false;

/** Download + decode forest background once so the game screen paints immediately. */
export function preloadGameBackground(): Promise<void> {
  if (preloaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      if (Platform.OS === 'web') {
        warmGameBackgroundUriCache();
        const uri = await resolveGameBackgroundUri();
        await Image.prefetch(uri);
        
        // Preload player sprite
        const spriteAsset = Asset.fromModule(require('../../assets/characters/player-spritesheet.png'));
        await spriteAsset.downloadAsync();
        if (spriteAsset.localUri || spriteAsset.uri) {
          await Image.prefetch(spriteAsset.localUri || spriteAsset.uri);
        }
      } else {
        const asset = Asset.fromModule(GAME_BG_SVG);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        if (uri) {
          await Image.prefetch(uri);
        }

        // Preload player sprite natively
        const spriteAsset = Asset.fromModule(require('../../assets/characters/player-spritesheet.png'));
        await spriteAsset.downloadAsync();
        if (spriteAsset.localUri || spriteAsset.uri) {
          await Image.prefetch(spriteAsset.localUri || spriteAsset.uri);
        }
      }
      preloaded = true;
    } catch (err) {
      preloadPromise = null;
      console.warn('[preloadGameBackground]', err);
    }
  })();

  return preloadPromise;
}

export function isGameBackgroundPreloaded(): boolean {
  return preloaded;
}
