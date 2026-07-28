import { Group, Image, useImage, Rect } from '@shopify/react-native-skia';

interface GameBackgroundProps {
  scrollX: number;
  speed?: number;
  width: number;
  height: number;
}

export default function GameBackground({
  scrollX,
  speed = 0.3,
  width,
  height,
}: GameBackgroundProps) {
  // useImage loads asynchronously — may be null on first frame or on OOM devices
  const bgImage = useImage(
    require('../../../assets/vecteezy_deep-forest-scene-with-trees-cartoon-background-vector_9577135.webp')
  );

  // Fallback sky rendered while image is loading, or if device runs out of memory
  const skyFallback = <Rect x={0} y={0} width={width} height={height} color="#1b2a47" />;

  if (!bgImage) {
    return skyFallback;
  }

  // Scale the Image to fill screen height while keeping aspect ratio
  const scale = height / bgImage.height();
  const scaledW = bgImage.width() * scale;

  // Parallax offset — modulo keeps it in [0, scaledW) so the loop is seamless
  const rawOffset = (scrollX * speed) % scaledW;
  const offset = rawOffset < 0 ? rawOffset + scaledW : rawOffset;
  const drawOffset = -offset;

  // Number of tiles needed to fill the full screen width
  const tilesNeeded = Math.ceil(width / scaledW) + 2;

  return (
    <Group>
      {/* Sky is drawn first so it shows through any transparent areas in the background */}
      {skyFallback}

      {/* Tiled background — each tile is positioned directly via x/y/width/height */}
      {Array.from({ length: tilesNeeded }, (_, i) => (
        <Image
          key={i}
          image={bgImage}
          x={drawOffset + i * scaledW}
          y={0}
          width={scaledW}
          height={height}
          fit="fill"
        />
      ))}
    </Group>
  );
}
