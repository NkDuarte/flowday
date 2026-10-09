import { EvidenceMimeType } from "../domain/evidence";

export interface SelectedEvidenceFile {
  readonly sourcePath: string;
  readonly originalName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
}

export abstract class EvidenceStorage {
  abstract selectImage(): Promise<SelectedEvidenceFile | null>;
  abstract saveImage(selection: SelectedEvidenceFile, taskId: string): Promise<string>;
  abstract removeImage(relativePath: string): Promise<void>;
  abstract imageUrl(relativePath: string): Promise<string>;
}