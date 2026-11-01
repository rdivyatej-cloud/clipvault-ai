declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(location: string, options?: any);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
      all(...params: any[]): any[];
      get(...params: any[]): any;
    };
    close(): void;
  }
}
