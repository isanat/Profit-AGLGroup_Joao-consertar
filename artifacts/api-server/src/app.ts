import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ---------------------------------------------------------------------------
// Production: serve the built Vite frontend from the same origin.
// The frontend uses relative `/api/...` URLs, so serving both the API and the
// static SPA from this single server avoids any CORS / base-url configuration.
// Activated only when PUBLIC_DIR points to an existing directory.
// ---------------------------------------------------------------------------
const publicDir = process.env.PUBLIC_DIR;
if (publicDir && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: "index.html" }));
  // SPA fallback: serve index.html for any non-/api GET (client-side routing)
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
  logger.info({ publicDir }, "Serving frontend static files");
}

export default app;
