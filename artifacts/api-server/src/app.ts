import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running from dist/index.mjs, this resolves to artifacts/api-server/public/
const publicPath = join(__dirname, "..", "public");

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);

// Serve the standalone web app from the public folder
// GET / → public/index.html  (the web version of the wallet)
app.use(express.static(publicPath));

// Catch-all: any path not handled above (including the Replit proxy prefix) serves
// the web wallet so the preview pane can reach index.html from any base path.
// Express 5 requires a named wildcard — use /{*path} instead of bare *.
app.get("/{*path}", (_req, res) => {
  res.sendFile(join(publicPath, "index.html"));
});

export default app;
