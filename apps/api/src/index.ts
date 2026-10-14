import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import { errorBody, handleError } from "./errors";
import { account } from "./routes/account";
import { accounts } from "./routes/accounts";
import { link } from "./routes/link";
import { sync } from "./routes/sync";

const app = new Hono<AppEnv>();

// ローカル開発用: Web 版(localhost:8081)から API(localhost:8787)を呼べるようにする。
// 本番は画面と API が同じオリジンなので、この設定は使われない。認証は Authorization ヘッダーで、Cookie は使わない。
app.use("/v1/*", cors({ origin: (origin) => (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : null), allowHeaders: ["Authorization", "Content-Type"], maxAge: 600 }));

app.onError(handleError);
app.notFound((c) => c.json(errorBody("not_found", "見つかりません。"), 404));

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/accounts", accounts);
app.route("/v1/account", account);
app.route("/v1/sync", sync);
app.route("/v1/link", link);

export default app;
