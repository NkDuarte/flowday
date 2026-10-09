import { Evidence, EvidenceDraft } from "./evidence";

export abstract class EvidenceRepository {
  abstract listForTask(taskId: string): Promise<readonly Evidence[]>;
  abstract create(draft: EvidenceDraft): Promise<Evidence>;
  abstract restore(evidence: Evidence): Promise<void>;
  abstract delete(id: string): Promise<void>;
}