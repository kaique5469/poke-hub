import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "path";
import { registerAuthRoutes } from "./auth";
import { ENV } from "./env";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { tcgNewsHandler } from "../scheduledTcgNews";
import { autoReleaseHandler } from "../scheduledRelease";
import { scrydexSyncHandler } from "../scheduledScrydex";
import { marketSnapshotHandler } from "../scheduledMarket";
import { ensureMarketPulseSchema } from "../marketSchema";
import { verifyWebhook } from "../lib/stripe";
import { markOrdersPaid, wasEventProcessed, recordEvent } from "../storeDb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await ensureMarketPulseSchema();
  const app = express();
  const server = createServer(app);
  // Stripe webhook needs the RAW body for signature verification — register
  // it before the JSON body parser.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const event = verifyWebhook(req.body as Buffer, req.headers["stripe-signature"] as string | undefined);
    if (!event) return res.status(400).json({ error: "invalid signature" });
    try {
      // Idempotency: Stripe redelivers events — never process the same one twice.
      if (await wasEventProcessed(event.id)) {
        return res.json({ received: true, duplicate: true });
      }
      if (event.type === "checkout.session.completed") {
        // ESCROW: only mark paid + hold funds. Seller payout happens at
        // release time (buyer confirms receipt or auto-release after delivery).
        const n = await markOrdersPaid(event.data.object.id);
        console.log(`[stripe] session ${event.data.object.id} completed — ${n} order(s) marked paid (funds held)`);
      }
      await recordEvent(event.id, event.type);
      return res.json({ received: true });
    } catch (e) {
      console.error("[stripe] webhook processing failed:", e);
      return res.status(500).json({ error: "processing failed" });
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerAuthRoutes(app);
  // Uploaded files (covers, etc.) — persist DATA_DIR on a Railway volume
  app.use("/uploads", express.static(path.resolve(ENV.dataDir, "uploads")));

  // ── Scheduled cron endpoints ──────────────────────────────────────────────
  app.post("/api/scheduled/tcg-news", tcgNewsHandler);
  app.post("/api/scheduled/auto-release", autoReleaseHandler);
  app.post("/api/scheduled/scrydex-sync", scrydexSyncHandler);
  app.post("/api/scheduled/market-snapshot", marketSnapshotHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
