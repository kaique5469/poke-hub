/**
 * Community stock reports — the "found it" layer of restock alerts.
 *
 * A signed-in collector reports a product in stock at a retailer (online or
 * a physical store). The report feeds a public list for 24 h, other users
 * confirm or dispute it, and everyone with an active monitor for that
 * retailer + product gets an in-app notification and a push. No scraping,
 * no provider: it works on day one in Brazil, where no stock feed exists.
 */
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  dropMonitors,
  dropReportVotes,
  dropReports,
  notifications,
  users,
  type InsertDropReport,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  DROP_RETAILER_META,
  dropRetailerCurrency,
  productMatchesQuery,
  type DropRetailer,
} from "../shared/drops";
import { sendDropWebPushToUser } from "./webPush";

let ready: Promise<void> | null = null;

export function ensureDropReportsSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_reports (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        retailer varchar(32) NOT NULL,
        country varchar(2) NOT NULL,
        productName varchar(512) NOT NULL,
        storeName varchar(160) NULL,
        city varchar(120) NULL,
        productUrl text NULL,
        priceCents int NULL,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        stockState varchar(24) NOT NULL DEFAULT 'in_stock',
        note varchar(512) NULL,
        confirmations int NOT NULL DEFAULT 0,
        disputes int NOT NULL DEFAULT 0,
        status varchar(16) NOT NULL DEFAULT 'active',
        notified int NOT NULL DEFAULT 0,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expiresAt timestamp NOT NULL,
        INDEX drop_reports_feed_idx (status, expiresAt, createdAt),
        INDEX drop_reports_user_idx (userId, createdAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_report_votes (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        reportId int NOT NULL,
        userId int NOT NULL,
        vote varchar(12) NOT NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY drop_report_votes_unique (reportId, userId)
      )
    `)
    );
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}

export const REPORT_TTL_HOURS = 24;
export const REPORTS_PER_DAY = 10;
/** A monitor is notified at most once per this window, across reports. */
export const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const dailyReports = new Map<number, { day: string; count: number }>();

export function consumeReportQuota(userId: number, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const bucket = dailyReports.get(userId);
  if (!bucket || bucket.day !== day) {
    dailyReports.set(userId, { day, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= REPORTS_PER_DAY;
}

export function countryForRetailer(retailer: DropRetailer): "BR" | "US" {
  return dropRetailerCurrency(retailer) === "BRL" ? "BR" : "US";
}

export type CreateReportInput = {
  userId: number;
  retailer: DropRetailer;
  productName: string;
  storeName?: string | null;
  city?: string | null;
  productUrl?: string | null;
  priceCents?: number | null;
  stockState?: "in_stock" | "low" | "out_of_stock";
  note?: string | null;
};

export async function createDropReport(input: CreateReportInput) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const now = new Date();
  const row: InsertDropReport = {
    userId: input.userId,
    retailer: input.retailer,
    country: countryForRetailer(input.retailer),
    productName: input.productName,
    storeName: input.storeName ?? null,
    city: input.city ?? null,
    productUrl: input.productUrl ?? null,
    priceCents: input.priceCents ?? null,
    currency: dropRetailerCurrency(input.retailer),
    stockState: input.stockState ?? "in_stock",
    note: input.note ?? null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + REPORT_TTL_HOURS * 3_600_000),
  };
  const [result] = await db.insert(dropReports).values(row);
  const id = Number((result as { insertId?: number }).insertId ?? 0);
  return { id, ...row };
}

export async function listDropReports(opts: {
  country?: "BR" | "US";
  retailer?: DropRetailer;
  limit?: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const now = opts.now ?? new Date();
  const conditions = [eq(dropReports.status, "active"), gt(dropReports.expiresAt, now)];
  if (opts.country) conditions.push(eq(dropReports.country, opts.country));
  if (opts.retailer) conditions.push(eq(dropReports.retailer, opts.retailer));
  const rows = await db
    .select({
      id: dropReports.id,
      retailer: dropReports.retailer,
      country: dropReports.country,
      productName: dropReports.productName,
      storeName: dropReports.storeName,
      city: dropReports.city,
      productUrl: dropReports.productUrl,
      priceCents: dropReports.priceCents,
      currency: dropReports.currency,
      stockState: dropReports.stockState,
      note: dropReports.note,
      confirmations: dropReports.confirmations,
      disputes: dropReports.disputes,
      createdAt: dropReports.createdAt,
      expiresAt: dropReports.expiresAt,
      reporter: users.username,
      reporterName: users.name,
    })
    .from(dropReports)
    .leftJoin(users, eq(users.id, dropReports.userId))
    .where(and(...conditions))
    .orderBy(desc(dropReports.createdAt))
    .limit(Math.min(opts.limit ?? 30, 100));
  return rows.map(r => ({
    ...r,
    reporter: r.reporter ?? (r.reporterName ? r.reporterName.split(" ")[0] : null),
    reporterName: undefined,
  }));
}

export async function voteDropReport(opts: {
  reportId: number;
  userId: number;
  vote: "confirm" | "dispute";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [report] = await db
    .select()
    .from(dropReports)
    .where(eq(dropReports.id, opts.reportId))
    .limit(1);
  if (!report) return null;
  if (report.userId === opts.userId) return report; // no self-votes
  await db
    .insert(dropReportVotes)
    .values({ reportId: opts.reportId, userId: opts.userId, vote: opts.vote })
    .onDuplicateKeyUpdate({ set: { vote: opts.vote } });
  const votes = await db
    .select({ vote: dropReportVotes.vote })
    .from(dropReportVotes)
    .where(eq(dropReportVotes.reportId, opts.reportId));
  const confirmations = votes.filter(v => v.vote === "confirm").length;
  const disputes = votes.filter(v => v.vote === "dispute").length;
  const status = shouldHide(confirmations, disputes) ? "hidden" : "active";
  await db
    .update(dropReports)
    .set({ confirmations, disputes, status })
    .where(eq(dropReports.id, opts.reportId));
  return { ...report, confirmations, disputes, status };
}

/** Three disputes with no majority of confirmations hide a report. */
export function shouldHide(confirmations: number, disputes: number) {
  return disputes >= 3 && disputes > confirmations;
}

/**
 * Notifies everyone whose active monitor matches this report (same retailer
 * and the monitor's search words appear in the product name). Skips the
 * reporter and monitors notified in the last 6 hours.
 */
export async function notifyMatchingMonitors(report: {
  id: number;
  userId: number;
  retailer: string;
  productName: string;
  storeName?: string | null;
  city?: string | null;
  productUrl?: string | null;
  priceCents?: number | null;
  currency: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const monitors = await db
    .select()
    .from(dropMonitors)
    .where(and(eq(dropMonitors.retailer, report.retailer), eq(dropMonitors.isActive, true)));
  const now = Date.now();
  const targets = monitors.filter(
    m =>
      m.userId !== report.userId &&
      productMatchesQuery(report.productName, m.searchQuery) &&
      (!m.lastTriggeredAt || now - m.lastTriggeredAt.getTime() > NOTIFY_COOLDOWN_MS)
  );
  if (targets.length === 0) return 0;
  const retailerName = DROP_RETAILER_META[report.retailer as DropRetailer]?.name ?? report.retailer;
  const where = [report.storeName, report.city].filter(Boolean).join(", ");
  const price =
    report.priceCents != null
      ? ` · ${report.currency === "BRL" ? "R$" : "$"} ${(report.priceCents / 100).toFixed(2)}`
      : "";
  const title = `${report.productName} spotted at ${retailerName}`;
  const message = `${where ? `${where}. ` : ""}Reported by the community${price}.`;
  const url = report.productUrl ?? "/app/alerts";
  const notifiedUsers = new Set<number>();
  for (const monitor of targets) {
    if (!notifiedUsers.has(monitor.userId)) {
      notifiedUsers.add(monitor.userId);
      await db.insert(notifications).values({
        userId: monitor.userId,
        type: "drop_alert",
        title,
        message,
        entityType: "drop_report",
        entityId: String(report.id),
      });
      await sendDropWebPushToUser(monitor.userId, {
        title,
        body: message,
        url,
        tag: `report-${report.id}`,
      }).catch(() => undefined);
    }
  }
  await db
    .update(dropMonitors)
    .set({ lastTriggeredAt: new Date() })
    .where(inArray(dropMonitors.id, targets.map(m => m.id)));
  await db
    .update(dropReports)
    .set({ notified: notifiedUsers.size })
    .where(eq(dropReports.id, report.id));
  return notifiedUsers.size;
}
