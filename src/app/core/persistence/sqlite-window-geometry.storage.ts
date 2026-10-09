import { Injectable } from "@angular/core";
import { WindowGeometry, WindowGeometryStorage, WindowMode } from "../../domain/window-geometry-storage";
import { DatabaseGateway } from "./database.gateway";

interface SettingRow {
  readonly value_json: string;
}

@Injectable()
export class SqliteWindowGeometryStorage extends WindowGeometryStorage {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async load(mode: WindowMode): Promise<WindowGeometry | null> {
    const rows = await this.database.select<SettingRow[]>(
      "SELECT value_json FROM app_settings WHERE key = $1",
      [settingKey(mode)],
    );
    const value = rows[0]?.value_json;
    if (!value) {
      return null;
    }

    try {
      const geometry: unknown = JSON.parse(value);
      return isWindowGeometry(geometry) ? geometry : null;
    } catch {
      return null;
    }
  }

  override async save(mode: WindowMode, geometry: WindowGeometry): Promise<void> {
    await this.database.execute(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [settingKey(mode), JSON.stringify(geometry), new Date().toISOString()],
    );
  }
}

function settingKey(mode: WindowMode): string {
  return `window_geometry_${mode}`;
}

function isWindowGeometry(value: unknown): value is WindowGeometry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const geometry = value as Partial<WindowGeometry>;
  return isFiniteNumber(geometry.width) &&
    isFiniteNumber(geometry.height) &&
    isFiniteNumber(geometry.x) &&
    isFiniteNumber(geometry.y) &&
    geometry.width > 0 &&
    geometry.height > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}