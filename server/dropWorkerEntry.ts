import "dotenv/config";
import { startDropMonitorWorker } from "./dropMonitor";
import { ensureDropMonitorSchema } from "./dropMonitorSchema";
import { dropProviderConfigured } from "./dropProvider";

async function main() {
  await ensureDropMonitorSchema();
  if (!dropProviderConfigured()) {
    throw new Error(
      "DROP_PROVIDER_URL, DROP_PROVIDER_API_KEY and DROP_PROVIDER_RETAILERS are required for the worker"
    );
  }
  if (!startDropMonitorWorker()) {
    throw new Error("Drop worker could not be started");
  }
  console.log("[drop-monitor] standalone worker started");
  // Keep the dedicated Railway worker process alive. The polling timer itself
  // is unref'd so the web server can still shut down cleanly.
  const keepAlive = setInterval(() => undefined, 60_000);
  await new Promise<void>(resolve => {
    const shutdown = () => resolve();
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  });
  clearInterval(keepAlive);
}

main().catch(error => {
  console.error(
    "[drop-monitor] standalone worker failed",
    error instanceof Error ? error.name : "unknown error"
  );
  process.exitCode = 1;
});
