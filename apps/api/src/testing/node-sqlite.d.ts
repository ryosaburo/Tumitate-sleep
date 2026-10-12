// テスト用。Node 22 の node:sqlite の、使う分だけの型(@types/node を足さないため)。
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: unknown[]): Record<string, unknown>[];
      run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    };
  }
}
declare module "*?raw" {
  const text: string;
  export default text;
}
