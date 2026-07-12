/**
 * Own auth system — replaces the Manus SDK entirely.
 * - Email/password (bcryptjs) + Google OAuth (hand-rolled, no extra deps)
 * - Sessions: signed JWT (jose) in an httpOnly cookie
 */
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import * as db from "../db";
import type { User } from "../../drizzle/schema";

const encoder = new TextEncoder();
const secretKey = () => encoder.encode(ENV.cookieSecret);

// ─── Session JWT ──────────────────────────────────────────────────────────────
export async function createSessionToken(userId: number, openId: string): Promise<string> {
  return new SignJWT({ userId, openId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secretKey());
}

async function verifySessionToken(token: string): Promise<{ userId: number; openId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "number" || typeof payload.openId !== "string") return null;
    return { userId: payload.userId, openId: payload.openId };
  } catch {
    return null;
  }
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Resolve the logged-in user from the session cookie. Returns null if not logged in. */
export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const user = await db.getUserByOpenId(session.openId);
  return user ?? null;
}

async function setSessionCookie(req: Request, res: Response, userId: number, openId: string) {
  const token = await createSessionToken(userId, openId);
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roleForEmail(email: string): "user" | "admin" {
  return ENV.ownerEmail && email.toLowerCase() === ENV.ownerEmail.toLowerCase() ? "admin" : "user";
}

function appBaseUrl(req: Request): string {
  if (ENV.appUrl) return ENV.appUrl.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "http";
  return `${proto}://${req.headers.host}`;
}

// ─── Rate limiting (in-memory, fixed window — no extra deps) ─────────────────
const RATE_WINDOW_MS = 15 * 60_000; // 15 min
const RATE_MAX = 20;                // attempts per window per IP+route
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(req: Request, route: string): boolean {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const key = `${route}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateBuckets.size > 10_000) {
      for (const [k, b] of rateBuckets) if (b.resetAt <= now) rateBuckets.delete(k);
    }
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_MAX;
}

const OAUTH_STATE_COOKIE = "g_oauth_state";

// ─── Routes ───────────────────────────────────────────────────────────────────
export function registerAuthRoutes(app: Express) {
  // Register with email + password
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    if (rateLimited(req, "register")) return res.status(429).json({ error: "Too many attempts — try again in 15 minutes." });
    try {
      const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      const normEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) return res.status(400).json({ error: "Invalid email" });

      const existing = await db.getUserByEmail(normEmail);
      if (existing) return res.status(409).json({ error: "An account with this email already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const openId = `local:${randomUUID()}`;
      const user = await db.createUser({
        openId,
        email: normEmail,
        name: (name ?? "").trim() || normEmail.split("@")[0],
        passwordHash,
        loginMethod: "email",
        role: roleForEmail(normEmail),
      });
      if (!user) return res.status(500).json({ error: "Falha ao criar conta" });

      await setSessionCookie(req, res, user.id, user.openId);
      return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
      console.error("[auth] register failed:", err);
      return res.status(500).json({ error: "Erro interno ao registrar" });
    }
  });

  // Login with email + password
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    if (rateLimited(req, "login")) return res.status(429).json({ error: "Too many attempts — try again in 15 minutes." });
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

      const user = await db.getUserByEmail(email.trim().toLowerCase());
      if (!user || !user.passwordHash) return res.status(401).json({ error: "Incorrect email or password" });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Incorrect email or password" });

      await setSessionCookie(req, res, user.id, user.openId);
      return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
      console.error("[auth] login failed:", err);
      return res.status(500).json({ error: "Internal sign-in error" });
    }
  });

  // Google OAuth — step 1: redirect to Google
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId) return res.status(500).send("Google OAuth is not configured (GOOGLE_CLIENT_ID).");
    const redirectUri = `${appBaseUrl(req)}/api/auth/google/callback`;
    // Anti-CSRF: random state stored in an httpOnly cookie, validated on callback
    const state = randomUUID();
    res.cookie(OAUTH_STATE_COOKIE, state, { ...getSessionCookieOptions(req), maxAge: 10 * 60_000 });
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Google OAuth — step 2: callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      if (!code) return res.redirect("/login?error=google");

      // Anti-CSRF: state must match the cookie set at the start of the flow
      const expectedState = getCookie(req, OAUTH_STATE_COOKIE);
      res.clearCookie(OAUTH_STATE_COOKIE, getSessionCookieOptions(req));
      if (!expectedState || req.query.state !== expectedState) {
        console.error("[auth] Google OAuth state mismatch");
        return res.redirect("/login?error=state");
      }

      const redirectUri = `${appBaseUrl(req)}/api/auth/google/callback`;
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenResp.ok) {
        console.error("[auth] Google token exchange failed:", await tokenResp.text());
        return res.redirect("/login?error=google");
      }
      const tokenData = (await tokenResp.json()) as { access_token?: string };
      if (!tokenData.access_token) return res.redirect("/login?error=google");

      const userResp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userResp.ok) return res.redirect("/login?error=google");
      const info = (await userResp.json()) as { sub: string; email?: string; name?: string; picture?: string };

      const openId = `google:${info.sub}`;
      const email = info.email?.toLowerCase() ?? null;
      await db.upsertUser({
        openId,
        email,
        name: info.name ?? email ?? "Treinador",
        avatarUrl: info.picture ?? null,
        loginMethod: "google",
        role: email ? roleForEmail(email) : "user",
        lastSignedIn: new Date(),
      });
      const user = await db.getUserByOpenId(openId);
      if (!user) return res.redirect("/login?error=google");

      await setSessionCookie(req, res, user.id, user.openId);
      return res.redirect("/");
    } catch (err) {
      console.error("[auth] Google callback failed:", err);
      return res.redirect("/login?error=google");
    }
  });

  // Logout (REST — the tRPC auth.logout also exists)
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ ok: true });
  });
}
