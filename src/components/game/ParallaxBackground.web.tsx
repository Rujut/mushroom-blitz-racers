import { createElement, memo, useEffect, useMemo, useState } from 'react';
import {
  GAME_BG_SKY_COLOR,
  GAME_BG_SVG_H,
  GAME_BG_SVG_W,
} from './parallaxBackgroundConstants';
import {
  peekGameBackgroundUri,
  resolveGameBackgroundUri,
  warmGameBackgroundUriCache,
} from '@/src/utils/gameBackgroundUri';

interface ParallaxBackgroundProps {
  scrollX: number;
  speed?: number;
  width: number;
  height: number;
}

/**
 * Web parallax: pure HTML layer (no RN View wrapper) with sized <img> tiles.
 * expo-image on web collapses to 0×0 inside flex rows; native <img> works reliably.
 */
function ParallaxBackground({ scrollX, speed = 0.3, width, height }: ParallaxBackgroundProps) {
  const [src, setSrc] = useState<string | null>(() => peekGameBackgroundUri());

  useEffect(() => {
    if (src) return;
    warmGameBackgroundUriCache();
    const warmed = peekGameBackgroundUri();
    if (warmed) {
      setSrc(warmed);
      return;
    }
    let cancelled = false;
    resolveGameBackgroundUri()
      .then((uri) => {
        if (!cancelled) setSrc(uri);
      })
      .catch((err) => console.warn('[ParallaxBackground.web]', err));
    return () => {
      cancelled = true;
    };
  }, [src]);

  const { scaledW, offset, tileCount } = useMemo(() => {
    const scale = height / GAME_BG_SVG_H;
    const sw = Math.max(1, Math.round(GAME_BG_SVG_W * scale));
    const raw = Math.round((scrollX * speed) % sw);
    const off = -(raw < 0 ? raw + sw : raw);
    const tiles = Math.ceil(width / sw) + 2;
    return { scaledW: sw, offset: off, tileCount: tiles };
  }, [scrollX, speed, width, height]);

  const layerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width,
      height,
      overflow: 'hidden',
      backgroundColor: GAME_BG_SKY_COLOR,
      zIndex: 0,
      pointerEvents: 'none' as const,
    }),
    [width, height],
  );

  const stripStyle = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'row' as const,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      transform: `translateX(${offset}px)`,
      willChange: 'transform',
    }),
    [offset],
  );

  if (!src) {
    return createElement('div', { style: layerStyle });
  }

  return createElement(
    'div',
    { style: layerStyle },
    createElement(
      'div',
      { style: stripStyle },
      Array.from({ length: tileCount }, (_, i) =>
        createElement('img', {
          key: `bg-${i}`,
          src,
          alt: '',
          draggable: false,
          decoding: 'async',
          style: {
            width: scaledW,
            height,
            display: 'block',
            flexShrink: 0,
            objectFit: 'fill',
            pointerEvents: 'none',
            userSelect: 'none',
          },
        }),
      ),
    ),
  );
}

export default memo(ParallaxBackground);
