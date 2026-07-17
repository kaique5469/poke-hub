import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { injectSeoMetadata, isKnownClientRoute, isPrivatePath } from "../seo";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const pathname = new URL(url, "http://localhost").pathname;
      const known = isKnownClientRoute(pathname);
      const transformed = await vite.transformIndexHtml(url, template);
      const page = injectSeoMetadata(transformed, pathname, known ? 200 : 404);
      if (!known || isPrivatePath(pathname)) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      }
      res
        .status(known ? 200 : 404)
        .set({ "Content-Type": "text/html", "Cache-Control": "no-cache" })
        .end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(
    "/assets",
    express.static(path.resolve(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: true,
    })
  );
  app.use(
    express.static(distPath, {
      index: false,
      maxAge: "1h",
      etag: true,
    })
  );

  const indexHtml = fs.readFileSync(
    path.resolve(distPath, "index.html"),
    "utf-8"
  );

  // Serve the SPA for known client routes and return a genuine 404 for unknown
  // paths, avoiding search-engine soft 404s.
  app.use("*", (req, res) => {
    const pathname = new URL(req.originalUrl, "http://localhost").pathname;
    const known = isKnownClientRoute(pathname);
    if (!known || isPrivatePath(pathname)) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    res
      .status(known ? 200 : 404)
      .type("html")
      .set("Cache-Control", "no-cache")
      .send(injectSeoMetadata(indexHtml, pathname, known ? 200 : 404));
  });
}
