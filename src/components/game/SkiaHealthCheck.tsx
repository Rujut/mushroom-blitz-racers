/** Android / iOS — native Skia (no CanvasKit WASM). Web uses SkiaHealthCheck.web.tsx */
import SkiaHealthCheckCanvas from './SkiaHealthCheckCanvas';

export function SkiaHealthCheck() {
  return <SkiaHealthCheckCanvas />;
}
