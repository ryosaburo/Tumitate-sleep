import { Hono } from "hono";
import type { AppEnv } from "./env";
import { errorBody, handleError } from "./errors";
import { accounts } from "./routes/accounts";
import { link } from "./routes/link";
import { sync } from "./routes/sync";

const app = new Hono<AppEnv>();

app.onError(handleError);
app.notFound((c) => c.json(errorBody("not_found", "見つかりません。"), 404));

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/accounts", accounts);
app.route("/v1/sync", sync);
app.route("/v1/link", link);

export default app;
