import { Asset } from 'expo-asset';
import { GAME_BG_SVG } from '@/src/components/game/parallaxBackgroundConstants';

let cachedUri: string | null = null;

/** Metro returns `/assets/...`; browsers need a full URL for reliable `<img src>`. */
export function toAbsoluteWebUri(uri: string): string {
  if (
    typeof window === 'undefined' ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:') ||
    uri.startsWith('blob:')
  ) {
    return uri;
  }
  if (uri.startsWith('/')) {
    return `${window.location.origin}${uri}`;
  }
  return uri;
}

function cacheUri(uri: string): string {
  cachedUri = typeof window !== 'undefined' ? toAbsoluteWebUri(uri) : uri;
  return cachedUri;
}

/** Read URI from expo-asset (works on web; RN Image.resolveAssetSource does not). */
function uriFromAssetModule(): string | null {
  const asset = Asset.fromModule(GAME_BG_SVG);
  return asset.localUri ?? asset.uri ?? null;
}

/** Safe to call after the app bundle is loaded; does not run at import time. */
export function warmGameBackgroundUriCache(): void {
  if (cachedUri) return;
  try {
    const uri = uriFromAssetModule();
    if (uri) cacheUri(uri);
  } catch {
    // Asset registry not ready yet — resolveGameBackgroundUri will retry.
  }
}

/** Metro-resolved URL for the forest SVG (web needs a real `src` for `<img>`). */
export async function resolveGameBackgroundUri(): Promise<string> {
  if (cachedUri) return cachedUri;

  const immediate = uriFromAssetModule();
  if (immediate) {
    return cacheUri(immediate);
  }

  const asset = Asset.fromModule(GAME_BG_SVG);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('Could not resolve forest background asset URI');
  }
  return cacheUri(uri);
}

export function peekGameBackgroundUri(): string | null {
  return cachedUri;
}
