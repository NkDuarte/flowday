import { Injectable } from "@angular/core";
import Database from "@tauri-apps/plugin-sql";
import { DatabaseExecution, DatabaseGateway } from "./database.gateway";

const DATABASE_URL = "sqlite:flowday.db";

@Injectable()
export class TauriDatabaseGateway extends DatabaseGateway {
  private connectionPromise: Promise<Database> | null = null;

  override async select<T>(query: string, bindValues: readonly unknown[] = []): Promise<T> {
    const database = await this.connection();
    return database.select<T>(query, [...bindValues]);
  }

  override async execute(
    query: string,
    bindValues: readonly unknown[] = [],
  ): Promise<DatabaseExecution> {
    const database = await this.connection();
    return database.execute(query, [...bindValues]);
  }

  private connection(): Promise<Database> {
    this.connectionPromise ??= Database.load(DATABASE_URL);
    return this.connectionPromise;
  }
}
