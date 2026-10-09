export interface NotificationSettings {
  readonly morningEnabled: boolean;
  readonly morningTime: string;
  readonly eveningEnabled: boolean;
  readonly eveningTime: string;
}

export abstract class NotificationSettingsStorage {
  abstract load(): Promise<NotificationSettings | null>;
  abstract save(settings: NotificationSettings): Promise<void>;
}

export const defaultNotificationSettings: NotificationSettings = {
  morningEnabled: false,
  morningTime: "08:00",
  eveningEnabled: false,
  eveningTime: "18:00",
};