export const WORLD = { width: 1536, height: 1024 };
export type Size = { width: number; height: number };
export type Camera = { x: number; y: number; scale: number };
export const coverScale = (size: Size) => Math.max(size.width / WORLD.width, size.height / WORLD.height);
export function clampCamera(camera: Camera, size: Size): Camera {
  const min = coverScale(size);
  const scale = Math.max(min, Math.min(min * 3, camera.scale));
  return { scale, x: Math.min(0, Math.max(size.width - WORLD.width * scale, camera.x)), y: Math.min(0, Math.max(size.height - WORLD.height * scale, camera.y)) };
}
export function focusCamera(camera: Camera, size: Size, point: { x: number; y: number }): Camera {
  const available = size.width;
  return clampCamera({ ...camera, x: available / 2 - point.x / 100 * WORLD.width * camera.scale, y: size.height / 2 - point.y / 100 * WORLD.height * camera.scale }, size);
}
export function zoomCamera(camera: Camera, size: Size, factor: number, anchor = { x: size.width / 2, y: size.height / 2 }): Camera {
  const scale = Math.max(coverScale(size), Math.min(coverScale(size) * 3, camera.scale * factor));
  const ratio = scale / camera.scale;
  return clampCamera({ scale, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio }, size);
}
