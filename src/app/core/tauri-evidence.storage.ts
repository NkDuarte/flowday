import { Injectable } from "@angular/core";
import { appLocalDataDir, BaseDirectory, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { mkdir, readFile, remove, stat, writeFile } from "@tauri-apps/plugin-fs";
import { EvidenceStorage, SelectedEvidenceFile } from "./evidence-storage";
import { EvidenceMimeType } from "../domain/evidence";

const evidenceDirectory = "evidence";
const maximumEvidenceSize = 10 * 1024 * 1024;
const imageExtensions = ["png", "jpg", "jpeg", "webp"] as const;

@Injectable()
export class TauriEvidenceStorage extends EvidenceStorage {
  override async selectImage(): Promise<SelectedEvidenceFile | null> {
    const selectedPath = await open({
      title: "Adjuntar evidencia",
      multiple: false,
      filters: [{ name: "Imágenes", extensions: [...imageExtensions] }],
    });
    if (!selectedPath || Array.isArray(selectedPath)) {
      return null;
    }

    const extension = selectedPath.split(".").pop()?.toLowerCase();
    const mimeType = mimeTypeFor(extension);
    const file = await stat(selectedPath);
    if (!mimeType || !file.isFile || file.size === 0 || file.size > maximumEvidenceSize) {
      throw new Error("La evidencia debe ser PNG, JPG o WebP de hasta 10 MB");
    }

    return {
      sourcePath: selectedPath,
      originalName: selectedPath.split("\\").pop() ?? "evidencia",
      mimeType,
      sizeBytes: file.size,
    };
  }

  override async saveImage(selection: SelectedEvidenceFile, taskId: string): Promise<string> {
    const extension = extensionForMimeType(selection.mimeType);
    const relativePath = `${evidenceDirectory}/${taskId}/${crypto.randomUUID()}.${extension}`;
    await mkdir(`${evidenceDirectory}/${taskId}`, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeFile(relativePath, await readFile(selection.sourcePath), {
      baseDir: BaseDirectory.AppLocalData,
      createNew: true,
    });
    return relativePath;
  }

  override async removeImage(relativePath: string): Promise<void> {
    await remove(relativePath, { baseDir: BaseDirectory.AppLocalData });
  }

  override async imageUrl(relativePath: string): Promise<string> {
    return convertFileSrc(await join(await appLocalDataDir(), relativePath));
  }
}

function mimeTypeFor(extension: string | undefined): EvidenceMimeType | null {
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return extension === "webp" ? "image/webp" : null;
}

function extensionForMimeType(mimeType: EvidenceMimeType): string {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}