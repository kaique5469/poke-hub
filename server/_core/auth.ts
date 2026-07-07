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

// ─── Routes ───────────────────────────────────────────────────────────────────
export function registerAuthRoutes(app: Express) {
  // Register with email + password
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
      if (password.length < 8) return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres" });
      const normEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) return res.status(400).json({ error: "Email inválido" });

      const existing = await db.getUserByEmail(normEmail);
      if (existing) return res.status(409).json({ error: "Já existe uma conta com este email" });

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
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });

      const user = await db.getUserByEmail(email.trim().toLowerCase());
      if (!user || !user.passwordHash) return res.status(401).json({ error: "Email ou senha incorretos" });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Email ou senha incorretos" });

      await setSessionCookie(req, res, user.id, user.openId);
      return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
      console.error("[auth] login failed:", err);
      return res.status(500).json({ error: "Erro interno ao entrar" });
    }
  });

  // Google OAuth — step 1: redirect to Google
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId) return res.status(500).send("Google OAuth não configurado (GOOGLE_CLIENT_ID).");
    const redirectUri = `${appBaseUrl(req)}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Google OAuth — step 2: callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      if (!code) return res.redirect("/login?error=google");

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
