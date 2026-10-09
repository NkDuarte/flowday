export interface DatabaseExecution {
  readonly rowsAffected: number;
  readonly lastInsertId?: number;
}

export abstract class DatabaseGateway {
  abstract select<T>(query: string, bindValues?: readonly unknown[]): Promise<T>;
  abstract execute(query: string, bindValues?: readonly unknown[]): Promise<DatabaseExecution>;
}
