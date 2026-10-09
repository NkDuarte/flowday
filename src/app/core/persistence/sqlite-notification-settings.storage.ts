import { Injectable } from "@angular/core";
import {
  NotificationSettings,
  NotificationSettingsStorage,
} from "../../domain/notification-settings-storage";
import { DatabaseGateway } from "./database.gateway";

interface SettingRow {
  readonly value_json: string;
}

const notificationSettingKey = "notification_settings";

@Injectable()
export class SqliteNotificationSettingsStorage extends NotificationSettingsStorage {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async load(): Promise<NotificationSettings | null> {
    const rows = await this.database.select<SettingRow[]>(
      "SELECT value_json FROM app_settings WHERE key = $1",
      [notificationSettingKey],
    );
    const value = rows[0]?.value_json;
    if (!value) return null;

    try {
      const settings: unknown = JSON.parse(value);
      return isNotificationSettings(settings) ? settings : null;
    } catch {
      return null;
    }
  }

  override async save(settings: NotificationSettings): Promise<void> {
    await this.database.execute(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [notificationSettingKey, JSON.stringify(settings), new Date().toISOString()],
    );
  }
}

function isNotificationSettings(value: unknown): value is NotificationSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<NotificationSettings>;
  return typeof settings.morningEnabled === "boolean" &&
    isTime(settings.morningTime) &&
    typeof settings.eveningEnabled === "boolean" &&
    isTime(settings.eveningTime);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}