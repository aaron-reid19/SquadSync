import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth";
import { passwordResetRouter } from "./passwordReset";
import { signupRouter } from "./signup";

if (!process.env.GOOGLE_CLIENT_ID) console.warn("GOOGLE_CLIENT_ID is not set: Google sign-in will fail.");

const app = express();
app.disable("x-powered-by");
// app.set("trust proxy", 1); // enable when deployed behind a proxy so rate limits see real IPs
app.use(
  helmet({
    // Needed so the Google sign-in popup can talk back to the page.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true, service: "auth" }));
app.use("/api/auth", authRouter);
app.use("/api/auth", passwordResetRouter);
app.use("/api/auth", signupRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
// Never leak stack traces or error details to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err instanceof Error ? err.message : "Unknown error");
  res.status(500).json({ error: "Something went wrong" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, "0.0.0.0", () => console.log(`Auth service running on http://localhost:${port}`));
