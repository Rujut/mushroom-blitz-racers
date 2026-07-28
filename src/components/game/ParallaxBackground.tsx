import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import {
  GAME_BG_SKY_COLOR,
  GAME_BG_SVG,
  GAME_BG_SVG_H,
  GAME_BG_SVG_W,
} from './parallaxBackgroundConstants';

export {
  GAME_BG_SVG,
  GAME_BG_SVG_W,
  GAME_BG_SVG_H,
  GAME_BG_SKY_COLOR,
} from './parallaxBackgroundConstants';

interface ParallaxBackgroundProps {
  scrollX: number;
  speed?: number;
  width: number;
  height: number;
}

/**
 * Tiled parallax forest background (SVG via expo-image).
 * Works on iOS, Android, and web. Sky color shows until tiles decode.
 */
function ParallaxBackground({ scrollX, speed = 0.3, width, height }: ParallaxBackgroundProps) {
  const { scaledW, offset, tileCount } = useMemo(() => {
    const scale = height / GAME_BG_SVG_H;
    const sw = GAME_BG_SVG_W * scale; // Keep as precise float
    const raw = (scrollX * speed) % sw;
    const off = -(raw < 0 ? raw + sw : raw);
    const tiles = Math.ceil(width / sw) + 2;
    return { scaledW: sw, offset: off, tileCount: tiles };
  }, [scrollX, speed, width, height]);

  return (
    <View style={[styles.layer, { width, height, backgroundColor: GAME_BG_SKY_COLOR }]}>
      <View style={[styles.strip, { transform: [{ translateX: offset }] }]}>
        {Array.from({ length: tileCount }, (_, i) => (
          <Image
            key={`bg-${i}`}
            source={GAME_BG_SVG}
            style={{ 
              position: 'absolute',
              left: Math.floor(i * scaledW),
              top: -1, // shift up to hide top edge sub-pixel gap
              width: Math.ceil(scaledW) + 2, // +2 overlap completely prevents vertical gaps
              height: height + 2, // extend height to cover bottom gap too
            }}
            contentFit="fill"
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
            recyclingKey={`forest-bg-${i}`}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(ParallaxBackground);

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});
