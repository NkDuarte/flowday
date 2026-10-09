import { Injectable } from "@angular/core";
import { appLocalDataDir, BaseDirectory, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { mkdir, readFile, remove, stat, writeFile } from "@tauri-apps/plugin-fs";
import { ProjectIdentityStorage, SelectedProjectLogo } from "./project-identity-storage";

const logoDirectory = "project-logos";
const maximumLogoSize = 10 * 1024 * 1024;
const logoExtensions = ["png", "jpg", "jpeg", "webp"] as const;

@Injectable()
export class TauriProjectIdentityStorage extends ProjectIdentityStorage {
  override async selectLogo(): Promise<SelectedProjectLogo | null> {
    const selectedPath = await open({
      title: "Elegir logo del proyecto",
      multiple: false,
      filters: [{ name: "Imágenes", extensions: [...logoExtensions] }],
    });
    if (!selectedPath || Array.isArray(selectedPath)) {
      return null;
    }

    const extension = extensionFor(selectedPath);
    const file = await stat(selectedPath);
    if (!extension || !file.isFile || file.size === 0 || file.size > maximumLogoSize) {
      throw new Error("El logo debe ser PNG, JPG o WebP de hasta 10 MB");
    }

    return { sourcePath: selectedPath, extension };
  }

  override async previewUrl(selection: SelectedProjectLogo): Promise<string> {
    return convertFileSrc(selection.sourcePath);
  }

  override async saveLogo(selection: SelectedProjectLogo): Promise<string> {
    const relativePath = `${logoDirectory}/${crypto.randomUUID()}.${selection.extension}`;
    await mkdir(logoDirectory, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeFile(relativePath, await readFile(selection.sourcePath), {
      baseDir: BaseDirectory.AppLocalData,
      createNew: true,
    });
    return relativePath;
  }

  override async removeLogo(relativePath: string): Promise<void> {
    await remove(relativePath, { baseDir: BaseDirectory.AppLocalData });
  }

  override async logoUrl(relativePath: string): Promise<string> {
    return convertFileSrc(await join(await appLocalDataDir(), relativePath));
  }
}

function extensionFor(path: string): SelectedProjectLogo["extension"] | null {
  const extension = path.split(".").pop()?.toLowerCase();
  return logoExtensions.find((candidate) => candidate === extension) ?? null;
}