import { Injectable } from "@angular/core";
import { Project, ProjectDraft } from "../../domain/project";
import { ProjectRepository } from "../../domain/project-repository";
import { DatabaseGateway } from "./database.gateway";

interface ProjectRow {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon_name: string | null;
  readonly logo_relative_path: string | null;
  readonly is_archived: number;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class SqliteProjectRepository extends ProjectRepository {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async listActive(): Promise<readonly Project[]> {
    const rows = await this.database.select<ProjectRow[]>(
      `SELECT id, name, color, icon_name, logo_relative_path, is_archived, created_at, updated_at
       FROM projects
      WHERE is_archived = 0 AND is_deleted = 0
       ORDER BY name COLLATE NOCASE`,
    );

    return rows.map(mapProject);
  }

  override async listArchived(): Promise<readonly Project[]> {
    const rows = await this.database.select<ProjectRow[]>(
      `SELECT id, name, color, icon_name, logo_relative_path, is_archived, created_at, updated_at
       FROM projects
       WHERE is_archived = 1 AND is_deleted = 0
       ORDER BY name COLLATE NOCASE`,
    );

    return rows.map(mapProject);
  }

  override async create(draft: ProjectDraft): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.database.execute(
      `INSERT INTO projects (id, name, color, icon_name, logo_relative_path, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [id, draft.name, draft.color, draft.iconName ?? null, draft.logoRelativePath ?? null, now],
    );

    const rows = await this.database.select<ProjectRow[]>(
      `SELECT id, name, color, icon_name, logo_relative_path, is_archived, created_at, updated_at
       FROM projects
       WHERE id = $1`,
      [id],
    );
    const project = rows[0];
    if (!project) {
      throw new Error("No se encontró el proyecto guardado");
    }

    return mapProject(project);
  }

  override async update(id: string, draft: ProjectDraft): Promise<Project> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE projects
       SET name = $1, color = $2, icon_name = $3, logo_relative_path = $4, updated_at = $5
      WHERE id = $6 AND is_archived = 0 AND is_deleted = 0`,
      [draft.name, draft.color, draft.iconName ?? null, draft.logoRelativePath ?? null, now, id],
    );

    const rows = await this.database.select<ProjectRow[]>(
      `SELECT id, name, color, icon_name, logo_relative_path, is_archived, created_at, updated_at
       FROM projects
       WHERE id = $1`,
      [id],
    );
    const project = rows[0];
    if (!project) {
      throw new Error("No se encontró el proyecto guardado");
    }

    return mapProject(project);
  }

  override async archive(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE projects
       SET is_archived = 1, updated_at = $1
       WHERE id = $2 AND is_archived = 0 AND is_deleted = 0`,
      [now, id],
    );
  }

  override async unarchive(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE projects SET is_archived = 0, updated_at = $1
       WHERE id = $2 AND is_archived = 1 AND is_deleted = 0`,
      [now, id],
    );
  }

  override async delete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE projects SET is_deleted = 1, updated_at = $1
       WHERE id = $2 AND is_deleted = 0`,
      [now, id],
    );
  }

  override async restoreDeleted(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE projects SET is_deleted = 0, is_archived = 0, updated_at = $1
       WHERE id = $2 AND is_deleted = 1`,
      [now, id],
    );
  }
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    iconName: row.icon_name,
    logoRelativePath: row.logo_relative_path,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}