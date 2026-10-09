import { Injectable } from "@angular/core";
import { Evidence, EvidenceDraft, EvidenceMimeType } from "../../domain/evidence";
import { EvidenceRepository } from "../../domain/evidence-repository";
import { DatabaseGateway } from "./database.gateway";

interface EvidenceRow {
  readonly id: string;
  readonly task_id: string;
  readonly relative_path: string;
  readonly original_name: string;
  readonly mime_type: EvidenceMimeType;
  readonly size_bytes: number;
  readonly created_at: string;
}

@Injectable()
export class SqliteEvidenceRepository extends EvidenceRepository {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async listForTask(taskId: string): Promise<readonly Evidence[]> {
    const rows = await this.database.select<EvidenceRow[]>(
      `SELECT id, task_id, relative_path, original_name, mime_type, size_bytes, created_at
       FROM evidence WHERE task_id = $1 ORDER BY created_at DESC`,
      [taskId],
    );
    return rows.map(mapEvidence);
  }

  override async create(draft: EvidenceDraft): Promise<Evidence> {
    const evidence: Evidence = { id: crypto.randomUUID(), ...draft, createdAt: new Date().toISOString() };
    await this.insert(evidence);
    return evidence;
  }

  override async restore(evidence: Evidence): Promise<void> {
    await this.insert(evidence);
  }

  private async insert(evidence: Evidence): Promise<void> {
    await this.database.execute(
      `INSERT INTO evidence (id, task_id, relative_path, original_name, mime_type, size_bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        evidence.id, evidence.taskId, evidence.relativePath, evidence.originalName,
        evidence.mimeType, evidence.sizeBytes, evidence.createdAt,
      ],
    );
  }

  override async delete(id: string): Promise<void> {
    await this.database.execute("DELETE FROM evidence WHERE id = $1", [id]);
  }
}

function mapEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    taskId: row.task_id,
    relativePath: row.relative_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}