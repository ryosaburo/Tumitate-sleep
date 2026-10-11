import { Hono } from "hono";

const app = new Hono();

// 動作確認用。ステップ6で本物の API を足す。
app.get("/health", (c) => c.json({ ok: true }));

export default app;
