import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

// Use the exact image the user provided in assets
const GROUND_IMG = require('../../../assets/belowground.webp');
const GROUND_IMG_W = 1920; // fallback width, aspect ratio will adjust
const GROUND_IMG_H = 1080;

interface ParallaxGroundProps {
  scrollX: number;
  width: number;
  height: number;
  groundY: number;
}

/**
 * Tiled parallax ground using the exact user-provided image.
 * Scrolls dynamically with the camera to match the foreground speed.
 */
function ParallaxGround({ scrollX, width, height, groundY }: ParallaxGroundProps) {
  const groundHeight = height - groundY;
  
  const { scaledW, offset, tileCount } = useMemo(() => {
    // Scale image to match the height of the ground area (or just let it fill)
    // To maintain aspect ratio and prevent squishing:
    const scale = Math.max(groundHeight / GROUND_IMG_H, width / GROUND_IMG_W);
    const sw = GROUND_IMG_W * scale; // Keep as precise float
    
    // Ground scrolls at exactly 1x speed to match player movement
    const raw = (scrollX % sw);
    const off = -(raw < 0 ? raw + sw : raw);
    const tiles = Math.ceil(width / sw) + 2;
    return { scaledW: sw, offset: off, tileCount: tiles };
  }, [scrollX, width, groundHeight]);

  return (
    <View style={[styles.layer, { top: groundY, width, height: groundHeight }]}>
      <View style={[styles.strip, { transform: [{ translateX: offset }] }]}>
        {Array.from({ length: tileCount }, (_, i) => (
          <Image
            key={`ground-${i}`}
            source={GROUND_IMG}
            style={{ 
              position: 'absolute',
              left: Math.floor(i * scaledW),
              top: -1,
              width: Math.ceil(scaledW) + 2, // overlap to prevent gaps
              height: groundHeight + 2 
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
          />
        ))}
      </View>
    </View>
  );
}

export default memo(ParallaxGround);

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    zIndex: -1, // Ensure it sits behind game elements if rendered in same view
  },
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});
