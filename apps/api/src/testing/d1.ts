import { DatabaseSync } from "node:sqlite";
import schema from "../../migrations/0001_init.sql?raw";
import type { Bindings } from "../env";

/**
 * テスト用の D1 もどき。Node 22 の node:sqlite の上に、アプリが使う分(prepare / bind / first / all / run / batch)だけを実装する。
 * 本物の D1 と同じ SQLite の SQL を実行する。実際の D1 での確認は、デプロイ後(ステップ7)に行う。
 */
class Statement {
  private params: unknown[] = [];
  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
  ) {}
  bind(...params: unknown[]): this {
    this.params = params.map((p) => (p === undefined ? null : p));
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).all(...this.params)[0] as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.params) as T[] };
  }
  async run(): Promise<{ meta: { changes: number } }> {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { meta: { changes: Number(r.changes) } };
  }
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  return {
    prepare: (sql: string) => new Statement(db, sql),
    // D1 の batch と同じく、全部成功するか、全部なかったことにする
    batch: async (stmts: Statement[]) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}

export function testEnv(): Bindings {
  return { DB: createTestD1() };
}
