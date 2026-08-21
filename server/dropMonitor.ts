import { createHash, randomUUID } from "node:crypto";
import type {
  DropEvent,
  DropMonitor,
  DropReleaseWindow,
} from "../drizzle/schema";
import {
  DROP_RETAILER_META,
  normalizeProductUrl,
  productMatchesQuery,
  type DropEventType,
  type DropProviderProduct,
  type DropRetailer,
} from "../shared/drops";
import { ENV } from "./_core/env";
import { escapeHtml, sendEmail } from "./_core/notification";
import { getUserById } from "./db";
import {
  getDropProductState,
  acquireDropWorkerLease,
  listActiveDropMonitors,
  listPendingDropEvents,
  listDropReleaseWindows,
  markDropEventNotified,
  markDropMonitorChecked,
  recordDropEvent,
  releaseDropWorkerLease,
  saveDropProductState,
} from "./dropMonitorDb";
import {
  dropProviderConfigured,
  fetchDropProviderProducts,
} from "./dropProvider";
import { createNotification } from "./marketplaceDb";
import { sendDropWebPushToUser } from "./webPush";

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function timeInZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    weekday: WEEKDAY[value.weekday] ?? 0,
    minute: Number(value.hour) * 60 + Number(value.minute),
  };
}

export function isWithinDropWindow(
  now: Date,
  window: Pick<
    DropReleaseWindow,
    "timezone" | "weekday" | "startMinute" | "endMinute" | "isActive"
  >
) {
  if (!window.isActive) return false;
  const local = timeInZone(now, window.timezone);
  if (window.startMinute <= window.endMinute) {
    return (
      local.weekday === window.weekday &&
      local.minute >= window.startMinute &&
      local.minute <= window.endMinute
    );
  }
  const nextDay = (window.weekday + 1) % 7;
  return (
    (local.weekday === window.weekday && local.minute >= window.startMinute) ||
    (local.weekday === nextDay && local.minute <= window.endMinute)
  );
}

export function monitorIntervalSeconds(
  monitor: DropMonitor,
  windows: DropReleaseWindow[],
  now = new Date()
): number | null {
  const activeWindow = windows.find(
    window =>
      window.userId === monitor.userId &&
      window.retailer === monitor.retailer &&
      isWithinDropWindow(now, window)
  );
  if (activeWindow) {
    return Math.max(
      3,
      Math.min(
        activeWindow.burstIntervalSeconds,
        ENV.dropBurstIntervalSeconds
      )
    );
  }
  return monitor.monitorMode === "release_windows"
    ? null
    : ENV.dropNormalIntervalSeconds;
}

function sellable(state: string) {
  return state === "in_stock" || state === "preorder";
}

export function classifyDropTransition(
  previousState: string | null,
  nextState: string
): DropEventType | null {
  if (!sellable(nextState)) return null;
  if (previousState === null) {
    return nextState === "preorder" ? "preorder" : "new_product";
  }
  if (previousState === nextState) return null;
  if (nextState === "preorder") return "preorder";
  if (!sellable(previousState) && nextState === "in_stock") return "restock";
  return null;
}

function eventFingerprint(
  monitorId: number,
  product: DropProviderProduct,
  eventType: DropEventType
) {
  const observedMinute = product.observedAt.toISOString().slice(0, 16);
  return createHash("sha256")
    .update(
      [
        monitorId,
        product.retailer,
        product.retailerProductId,
        eventType,
        observedMinute,
      ].join("|")
    )
    .digest("hex");
}

function matchingProducts(
  monitor: DropMonitor,
  products: DropProviderProduct[]
) {
  const retailer = monitor.retailer as DropRetailer;
  const expectedUrl = monitor.productUrl
    ? normalizeProductUrl(retailer, monitor.productUrl)
    : null;
  return products.filter(product => {
    if (product.retailer !== monitor.retailer) return false;
    if (expectedUrl) return product.productUrl === expectedUrl;
    return productMatchesQuery(product.title, monitor.searchQuery);
  });
}

function formatPrice(event: DropEvent) {
  if (event.priceCents === null) return null;
  return new Intl.NumberFormat(event.currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: event.currency,
  }).format(event.priceCents / 100);
}

async function postDiscord(event: DropEvent) {
  if (!ENV.dropDiscordWebhookUrl) return false;
  const retailer = DROP_RETAILER_META[event.retailer as DropRetailer];
  const response = await fetch(ENV.dropDiscordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "RarityGrid Drop Monitor",
      embeds: [
        {
          title: `🚨 ${event.title}`,
          url: event.productUrl,
          description: `${retailer?.name ?? event.retailer} • ${formatPrice(event) ?? "Price pending"}`,
          color: 0x6d28d9,
          image: event.imageUrl ? { url: event.imageUrl } : undefined,
          footer: { text: "Open the retailer and complete the cart manually." },
          timestamp: event.detectedAt.toISOString(),
        },
      ],
    }),
    signal: AbortSignal.timeout(5_000),
  });
  return response.ok;
}

async function postTelegram(event: DropEvent) {
  if (!ENV.dropTelegramBotToken || !ENV.dropTelegramChatId) return false;
  const retailer = DROP_RETAILER_META[event.retailer as DropRetailer];
  const text = [
    `🚨 ${event.title}`,
    `${retailer?.name ?? event.retailer} • ${formatPrice(event) ?? "Price pending"}`,
    event.productUrl,
    "Open the retailer and complete the cart manually.",
  ].join("\n");
  const response = await fetch(
    `https://api.telegram.org/bot${ENV.dropTelegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ENV.dropTelegramChatId,
        text,
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(5_000),
    }
  );
  return response.ok;
}

async function deliverDropEvent(event: DropEvent) {
  const retailer = DROP_RETAILER_META[event.retailer as DropRetailer];
  const title = `${retailer?.name ?? event.retailer}: ${event.title} is live`;
  const price = formatPrice(event);
  const deliveries: Promise<unknown>[] = [
    createNotification({
      userId: event.userId,
      type: "drop_alert",
      title,
      message: `${price ? `${price} • ` : ""}Detected now. Open the product before stock moves.`,
      entityType: "drop_event",
      entityId: String(event.id),
    }),
    sendDropWebPushToUser(event.userId, {
      title: `🚨 ${event.title}`,
      body: `${retailer?.name ?? event.retailer} • ${price ?? "Price pending"}`,
      url: event.productUrl,
      icon: event.imageUrl ?? "/favicon.svg",
      tag: `drop-${event.id}`,
      eventId: event.id,
    }),
  ];
  const user = await getUserById(event.userId).catch(() => undefined);
  // Discord and Telegram are intentionally global, owner-operated channels.
  // Never leak another user's private monitor into them.
  if (user?.role === "admin") {
    deliveries.push(
      postDiscord(event).catch(error =>
        console.error(
          "[drop-monitor] Discord delivery failed",
          error instanceof Error ? error.name : "unknown error"
        )
      ),
      postTelegram(event).catch(error =>
        console.error(
          "[drop-monitor] Telegram delivery failed",
          error instanceof Error ? error.name : "unknown error"
        )
      )
    );
  }
  if (user?.email && ENV.resendApiKey) {
    deliveries.push(
      sendEmail({
        to: user.email,
        subject: title,
        text: `${event.title}\n${price ?? "Price pending"}\n${event.productUrl}`,
        html: `<h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(
          price ?? "Price pending"
        )}</p><p><a href="${escapeHtml(
          event.productUrl
        )}">Open product</a></p>`,
      })
    );
  }
  await Promise.allSettled(deliveries);
  await markDropEventNotified(event.id).catch(error =>
    console.error(
      "[drop-monitor] could not mark event notified",
      error instanceof Error ? error.name : "unknown error"
    )
  );
}

async function processMonitorsInBatches(
  monitors: DropMonitor[],
  products: DropProviderProduct[],
  batchSize = 20
) {
  let matched = 0;
  let events = 0;
  for (let offset = 0; offset < monitors.length; offset += batchSize) {
    const settled = await Promise.allSettled(
      monitors
        .slice(offset, offset + batchSize)
        .map(monitor => processDropProductsForMonitor(monitor, products))
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        matched += result.value.matched;
        events += result.value.events;
      } else {
        console.error("[drop-monitor] monitor processing failed");
      }
    }
  }
  return { matched, events };
}

export async function processDropProductsForMonitor(
  monitor: DropMonitor,
  products: DropProviderProduct[]
) {
  const matches = matchingProducts(monitor, products);
  let events = 0;
  let lastState: string | undefined;
  let lastPrice: number | null | undefined;
  const deliveries: Array<() => Promise<void>> = [];

  for (const product of matches) {
    const previous = await getDropProductState(
      monitor.id,
      product.retailerProductId
    );
    // A discovery monitor first records the current catalog silently. After
    // this baseline, a previously unseen product is genuinely new to the rule.
    // Exact-URL monitors still alert immediately when that product is live.
    const firstDiscoveryBaseline =
      previous === null &&
      monitor.productUrl === null &&
      monitor.lastCheckedAt === null;
    const eventType = firstDiscoveryBaseline
      ? null
      : classifyDropTransition(previous?.stockState ?? null, product.stockState);
    const productCurrency = product.currency ?? monitor.currency;
    const withinPrice =
      monitor.maxPriceCents === null ||
      (typeof product.priceCents === "number" &&
        productCurrency === monitor.currency &&
        product.priceCents <= monitor.maxPriceCents);
    let triggeredAt: Date | undefined;

    if (eventType && withinPrice) {
      const result = await recordDropEvent({
        monitorId: monitor.id,
        userId: monitor.userId,
        fingerprint: eventFingerprint(monitor.id, product, eventType),
        eventType,
        retailer: product.retailer,
        retailerProductId: product.retailerProductId,
        title: product.title,
        productUrl: product.productUrl,
        imageUrl: product.imageUrl ?? null,
        priceCents: product.priceCents ?? null,
        currency: productCurrency,
        source: product.source,
        observedAt: product.observedAt,
      });
      if (result.inserted && result.event) {
        triggeredAt = new Date();
        events += 1;
        deliveries.push(() => deliverDropEvent(result.event!));
      }
    }

    await saveDropProductState(
      monitor.id,
      {
        retailerProductId: product.retailerProductId,
        title: product.title,
        productUrl: product.productUrl,
        stockState: product.stockState,
        priceCents: product.priceCents ?? null,
        currency: productCurrency,
      },
      triggeredAt
    );
    lastState = product.stockState;
    lastPrice = product.priceCents ?? null;
  }

  for (let offset = 0; offset < deliveries.length; offset += 10) {
    await Promise.allSettled(
      deliveries.slice(offset, offset + 10).map(deliver => deliver())
    );
  }

  await markDropMonitorChecked(monitor, {
    stockState: lastState,
    priceCents: lastPrice,
    triggered: events > 0,
  });
  return { checked: true, matched: matches.length, events };
}

export async function runDropMonitor(monitor: DropMonitor) {
  try {
    const payload = await fetchDropProviderProducts({
      retailer: monitor.retailer as DropRetailer,
      query: monitor.searchQuery,
      productUrl: monitor.productUrl,
    });
    return await processDropProductsForMonitor(monitor, payload.products);
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 512) : "Monitor failed";
    await markDropMonitorChecked(monitor, { error: message });
    throw error;
  }
}

export async function ingestDropProviderProducts(
  products: DropProviderProduct[]
) {
  const monitors = await listActiveDropMonitors();
  const relevantMonitors = monitors.filter(monitor =>
    products.some(product => product.retailer === monitor.retailer)
  );
  const { matched, events } = await processMonitorsInBatches(
    relevantMonitors,
    products
  );
  return { monitors: monitors.length, matched, events };
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerBusy = false;
const workerHolder = randomUUID();

function monitorGroupKey(monitor: DropMonitor) {
  return JSON.stringify([
    monitor.retailer,
    monitor.searchQuery.trim().toLowerCase().replace(/\s+/g, " "),
    monitor.productUrl ?? "",
  ]);
}

async function runDropMonitorGroup(monitors: DropMonitor[]) {
  const first = monitors[0];
  if (!first) return;
  try {
    const payload = await fetchDropProviderProducts({
      retailer: first.retailer as DropRetailer,
      query: first.searchQuery,
      productUrl: first.productUrl,
    });
    await processMonitorsInBatches(monitors, payload.products);
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 512) : "Monitor failed";
    await Promise.allSettled(
      monitors.map(monitor => markDropMonitorChecked(monitor, { error: message }))
    );
    throw error;
  }
}

export function startDropMonitorWorker() {
  if (
    workerTimer ||
    !ENV.dropWorkerEnabled ||
    !dropProviderConfigured()
  ) {
    return false;
  }
  workerTimer = setInterval(async () => {
    if (workerBusy) return;
    workerBusy = true;
    try {
      if (!(await acquireDropWorkerLease(workerHolder))) return;
      const now = new Date();
      const [monitors, windows, pendingEvents] = await Promise.all([
        listActiveDropMonitors(),
        listDropReleaseWindows(),
        listPendingDropEvents(10),
      ]);
      const retryDeliveries = Promise.allSettled(
        pendingEvents.map(event => deliverDropEvent(event))
      );
      const due = monitors.filter(monitor => {
        const interval = monitorIntervalSeconds(monitor, windows, now);
        if (interval === null) return false;
        if (!monitor.lastCheckedAt) return true;
        return now.getTime() - monitor.lastCheckedAt.getTime() >= interval * 1000;
      });
      const grouped = new Map<string, DropMonitor[]>();
      for (const monitor of due) {
        const key = monitorGroupKey(monitor);
        grouped.set(key, [...(grouped.get(key) ?? []), monitor]);
      }
      // One provider request serves every user with the same rule. This keeps
      // five-second bursts fast without multiplying upstream traffic.
      const providerChecks = Promise.allSettled(
        [...grouped.values()].slice(0, 5).map(group =>
          runDropMonitorGroup(group).catch(error =>
            console.error(
              `[drop-monitor] monitor group ${group.map(row => row.id).join(",")} failed`,
              error instanceof Error ? error.name : "unknown error"
            )
          )
        )
      );
      await Promise.allSettled([retryDeliveries, providerChecks]);
    } finally {
      await releaseDropWorkerLease(workerHolder).catch(error =>
        console.error(
          "[drop-monitor] worker lease release failed",
          error instanceof Error ? error.name : "unknown error"
        )
      );
      workerBusy = false;
    }
  }, 1_000);
  workerTimer.unref();
  return true;
}
