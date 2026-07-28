import React, { memo, useMemo } from 'react';
import { StyleSheet, View, Image as RNImage } from 'react-native';
import type { PlayerRenderState } from '@/src/game/core/types';
import { FRAME_H, FRAME_W, getFrameSourceRect, SHEET_H, SHEET_W } from '@/src/game/core/playerAnimation';

interface Props {
  player: PlayerRenderState;
  opacity: number;
}

/**
 * Renders the player character using a sprite sheet.
 * This is the Native (Expo Go / Views) implementation.
 *
 * It uses a single expo-image and CSS clipping (overflow: 'hidden' on a container)
 * to show the correct frame. This avoids Reanimated and avoids allocating multiple Images.
 */
function AnimatedPlayer({ player, opacity }: Props) {
  // Compute transform based on current animation frame
  const srcRect = getFrameSourceRect(player.animState, player.animFrame);

  // We want to center the 72x72 sprite on the 42x52 physical hitbox.
  // The sprite has some padding around it.
  const offsetX = (FRAME_W - player.width) / 2;
  const offsetY = (FRAME_H - player.height) / 2; // Bottom align if needed, or center

  return (
    <View
      style={[
        styles.container,
        {
          left: player.renderX - offsetX,
          // If we want the feet to align with the bottom of the hitbox:
          // hitbox is player.height. Sprite is FRAME_H. We shift up by (FRAME_H - player.height)
          top: player.renderY - (FRAME_H - player.height),
          width: FRAME_W,
          height: FRAME_H,
          opacity: opacity,
          // Horizontal flip + landing squash/stretch
          transform: [
            { scaleX: (player.facingRight ? 1 : -1) * player.landScaleX },
            { scaleY: player.landScaleY },
          ],
        },
      ]}
    >
      <RNImage
        source={require('../../../assets/characters/player-spritesheet.png')}
        style={[
          styles.spriteSheet,
          {
            left: -srcRect.sx,
            top: -srcRect.sy,
          },
        ]}
        resizeMode="stretch"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
  },
  spriteSheet: {
    width: SHEET_W,
    height: SHEET_H,
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default memo(AnimatedPlayer);
