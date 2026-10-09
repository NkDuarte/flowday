export type EvidenceMimeType = "image/png" | "image/jpeg" | "image/webp";

export interface Evidence {
  readonly id: string;
  readonly taskId: string;
  readonly relativePath: string;
  readonly originalName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface EvidenceDraft {
  readonly taskId: string;
  readonly relativePath: string;
  readonly originalName: string;
  readonly mimeType: EvidenceMimeType;
  readonly sizeBytes: number;
}