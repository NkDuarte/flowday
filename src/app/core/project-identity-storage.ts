export interface SelectedProjectLogo {
  readonly sourcePath: string;
  readonly extension: "png" | "jpg" | "jpeg" | "webp";
}

export abstract class ProjectIdentityStorage {
  abstract selectLogo(): Promise<SelectedProjectLogo | null>;
  abstract previewUrl(selection: SelectedProjectLogo): Promise<string>;
  abstract saveLogo(selection: SelectedProjectLogo): Promise<string>;
  abstract removeLogo(relativePath: string): Promise<void>;
  abstract logoUrl(relativePath: string): Promise<string>;
}