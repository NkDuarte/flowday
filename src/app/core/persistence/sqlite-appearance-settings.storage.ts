import { Injectable } from "@angular/core";
import {
  AppearancePalette,
  AppearanceSettings,
  AppearanceSettingsStorage,
  defaultAppearanceSettings,
} from "../../domain/appearance-settings-storage";
import { DatabaseGateway } from "./database.gateway";

interface SettingRow {
  readonly value_json: string;
}

const appearanceSettingKey = "appearance_settings";

@Injectable()
export class SqliteAppearanceSettingsStorage extends AppearanceSettingsStorage {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async load(): Promise<AppearanceSettings | null> {
    const rows = await this.database.select<SettingRow[]>(
      "SELECT value_json FROM app_settings WHERE key = $1",
      [appearanceSettingKey],
    );
    const value = rows[0]?.value_json;
    if (!value) {
      return null;
    }

    try {
      const settings: unknown = JSON.parse(value);
      return isAppearanceSettings(settings) ? settings : null;
    } catch {
      return null;
    }
  }

  override async save(settings: AppearanceSettings): Promise<void> {
    await this.database.execute(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [appearanceSettingKey, JSON.stringify(settings), new Date().toISOString()],
    );
  }
}

function isAppearanceSettings(value: unknown): value is AppearanceSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Partial<AppearanceSettings>;
  return isAppearanceMode(settings.mode) && isPalette(settings.light) && isPalette(settings.dark);
}

function isAppearanceMode(value: unknown): value is AppearanceSettings["mode"] {
  return value === "system" || value === "light" || value === "dark";
}

function isPalette(value: unknown): value is AppearancePalette {
  if (!value || typeof value !== "object") {
    return false;
  }

  const palette = value as Partial<AppearancePalette>;
  return Object.keys(defaultAppearanceSettings.light).every((key) => isHexColor(palette[key as keyof AppearancePalette]));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}
