import { Project, ProjectDraft } from "./project";

export abstract class ProjectRepository {
  abstract listActive(): Promise<readonly Project[]>;
  abstract listArchived(): Promise<readonly Project[]>;
  abstract create(draft: ProjectDraft): Promise<Project>;
  abstract update(id: string, draft: ProjectDraft): Promise<Project>;
  abstract archive(id: string): Promise<void>;
  abstract unarchive(id: string): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract restoreDeleted(id: string): Promise<void>;
}