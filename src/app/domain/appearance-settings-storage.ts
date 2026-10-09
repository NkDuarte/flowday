export type AppearanceMode = "system" | "light" | "dark";

export interface AppearancePalette {
  readonly canvas: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly lineStrong: string;
  readonly accent: string;
  readonly plannedLine: string;
  readonly focus: string;
  readonly actionSurface: string;
  readonly actionInk: string;
}

export interface AppearanceSettings {
  readonly mode: AppearanceMode;
  readonly light: AppearancePalette;
  readonly dark: AppearancePalette;
}

export abstract class AppearanceSettingsStorage {
  abstract load(): Promise<AppearanceSettings | null>;
  abstract save(settings: AppearanceSettings): Promise<void>;
}

export const defaultAppearanceSettings: AppearanceSettings = {
  mode: "system",
  light: {
    canvas: "#F8F8F4",
    surface: "#FFFFFF",
    surfaceRaised: "#EFF0EA",
    ink: "#202622",
    muted: "#6B736D",
    line: "#DFE2DC",
    lineStrong: "#C6CBC3",
    accent: "#237A58",
    plannedLine: "#3C7F9A",
    focus: "#1A6E99",
    actionSurface: "#202622",
    actionInk: "#FFFFFF",
  },
  dark: {
    canvas: "#1D231F",
    surface: "#252D28",
    surfaceRaised: "#303A33",
    ink: "#EFF2EC",
    muted: "#B2BBB2",
    line: "#3A463E",
    lineStrong: "#526057",
    accent: "#6FCA9B",
    plannedLine: "#78C9EE",
    focus: "#78C9EE",
    actionSurface: "#80D3A4",
    actionInk: "#17211B",
  },
};
