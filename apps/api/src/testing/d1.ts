import { DatabaseSync } from "node:sqlite";
import init from "../../migrations/0001_init.sql?raw";
import accountTokens from "../../migrations/0002_account_tokens.sql?raw";
import aiUsage from "../../migrations/0003_ai_usage.sql?raw";
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
  // マイグレーションを、番号の順に流す(新しいファイルを足したら、ここにも足す)
  for (const sql of [init, accountTokens, aiUsage]) db.exec(sql);
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

/** テスト用の Workers AI もどき。run に渡された内容を calls に残し、reply の返り値(または例外)を返す。 */
export function createTestAi(reply: (input: unknown) => unknown | Promise<unknown> = () => ({ response: { side: "skip", comment: "" } })) {
  const calls: { model: string; input: unknown }[] = [];
  const ai = {
    run: async (model: string, input: unknown) => {
      calls.push({ model, input });
      return reply(input);
    },
  } as unknown as Ai;
  return { ai, calls };
}

export function testEnv(ai: Ai = createTestAi().ai): Bindings {
  return { DB: createTestD1(), AI: ai };
}
