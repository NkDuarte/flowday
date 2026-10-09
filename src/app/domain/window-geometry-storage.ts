export type WindowMode = "full" | "compact";

export interface WindowGeometry {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

export abstract class WindowGeometryStorage {
  abstract load(mode: WindowMode): Promise<WindowGeometry | null>;
  abstract save(mode: WindowMode, geometry: WindowGeometry): Promise<void>;
}