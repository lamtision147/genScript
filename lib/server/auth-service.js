import crypto from "crypto";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OTP_EXPIRES_MS, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-constants";

const otpStore = new Map();
const passwordResetStore = new Map();
const oauthStateStore = new Map();

let mailTransport = null;

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "seller-studio-dev-secret";
}

function signSessionPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySessionPayload(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload?.userId || !payload?.exp || payload.exp < Date.now()) return null;
  return payload;
}

export function createSession(userId) {
  return signSessionPayload({ userId, exp: Date.now() + SESSION_MAX_AGE * 1000 });
}

export async function createSessionAsync(userId) {
  return createSession(userId);
}

export function destroySession(sessionId) {
  return sessionId;
}

export async function destroySessionAsync(sessionId) {
  return destroySession(sessionId);
}

export function getCurrentUserFromCookies() {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  const payload = verifySessionPayload(sessionId);
  const userId = payload?.userId;
  if (!userId) return null;
  return readJsonArray(paths.users).find((user) => user.id === userId) || null;
}

export async function getCurrentUserFromCookiesAsync() {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  const payload = verifySessionPayload(sessionId);
  const userId = payload?.userId;
  if (!userId) return null;

  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (data) return data;
  }

  return readJsonArray(paths.users).find((user) => user.id === userId) || null;
}

export function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return mailTransport;
}

export async function sendOtpEmail(email, code) {
  const transport = getMailTransport();
  if (!transport) return false;
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Seller Studio - Ma OTP dang nhap",
    text: `Ma OTP cua ban la: ${code}. Ma co hieu luc trong 10 phut.`,
    html: `<div style="font-family:Arial,sans-serif"><h2>Seller Studio</h2><p>Ma OTP cua ban la:</p><p style="font-size:30px;font-weight:700;letter-spacing:4px">${code}</p><p>Ma co hieu luc trong 10 phut.</p></div>`
  });
  return true;
}

export function requestSignupOtp({ email, name, password }) {
  const users = readJsonArray(paths.users);
  const existingUser = users.find((item) => item.email === email);
  if (existingUser?.passwordHash) {
    throw new Error("Account already exists. Please log in with email and password.");
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(email, {
    code,
    name,
    passwordHash: hashPassword(password),
    expiresAt: Date.now() + OTP_EXPIRES_MS
  });
  return code;
}

export async function requestSignupOtpAsync({ email, name, password }) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("id,password_hash").eq("email", email).maybeSingle();
    if (data?.password_hash) {
      throw new Error("Account already exists. Please log in with email and password.");
    }
  }
  return requestSignupOtp({ email, name, password });
}

export function verifySignupOtp({ email, code }) {
  const otp = otpStore.get(email);
  if (!otp || otp.expiresAt < Date.now() || otp.code !== code) {
    throw new Error("Invalid or expired OTP");
  }
  otpStore.delete(email);
  const users = readJsonArray(paths.users);
  let user = users.find((item) => item.email === email);
  if (!user) {
    user = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email,
      name: otp.name || email.split("@")[0] || "User",
      favorites: [],
      passwordHash: otp.passwordHash
    };
    users.unshift(user);
  } else {
    user.name = otp.name || user.name;
    user.passwordHash = otp.passwordHash;
  }
  writeJsonArray(paths.users, users);
  return user;
}

export async function verifySignupOtpAsync({ email, code }) {
  const user = verifySignupOtp({ email, code });
  const supabase = createServerSupabaseClient();
  if (supabase) {
    await supabase.from("users").upsert({
      id: user.id,
      email: user.email,
      name: user.name,
      password_hash: user.passwordHash,
      created_at: new Date().toISOString()
    }, { onConflict: "email" });
  }
  return user;
}

export function loginWithPassword({ email, password }) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.email === email);
  if (!user) throw new Error("Account not found. Please create a new account first.");
  if (!user.passwordHash) throw new Error("This account needs to finish password setup.");
  if (user.passwordHash !== hashPassword(password)) throw new Error("Invalid email or password");
  return user;
}

export async function loginWithPasswordAsync({ email, password }) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
    if (data) {
      if (!data.password_hash) throw new Error("This account needs to finish password setup.");
      if (data.password_hash !== hashPassword(password)) throw new Error("Invalid email or password");
      return { id: data.id, email: data.email, name: data.name, favorites: [] };
    }
  }
  return loginWithPassword({ email, password });
}

export function sanitizeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export function createOauthState() {
  const token = `google_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  oauthStateStore.set(token, true);
  return token;
}

export function consumeOauthState(token) {
  if (!oauthStateStore.has(token)) return false;
  oauthStateStore.delete(token);
  return true;
}

export async function upsertGoogleUser({ email, name }) {
  const users = readJsonArray(paths.users);
  let user = users.find((item) => item.email === email);
  if (!user) {
    user = { id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, email, name, favorites: [] };
    users.unshift(user);
  } else {
    user.name = name || user.name;
  }
  writeJsonArray(paths.users, users);

  const supabase = createServerSupabaseClient();
  if (supabase) {
    await supabase.from("users").upsert({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: new Date().toISOString()
    }, { onConflict: "email" });
  }

  return user;
}

export function requestPasswordResetOtp(email) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.email === email);
  if (!user) throw new Error("Account not found");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetStore.set(email, { code, expiresAt: Date.now() + OTP_EXPIRES_MS });
  return code;
}

export async function requestPasswordResetOtpAsync(email) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (!data) throw new Error("Account not found");
  }
  return requestPasswordResetOtp(email);
}

export function verifyPasswordResetOtp({ email, code, newPassword }) {
  const reset = passwordResetStore.get(email);
  if (!reset || reset.expiresAt < Date.now() || reset.code !== code) {
    throw new Error("Invalid or expired OTP");
  }
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.email === email);
  if (!user) throw new Error("Account not found");
  user.passwordHash = hashPassword(newPassword);
  writeJsonArray(paths.users, users);
  passwordResetStore.delete(email);
  return true;
}

export async function verifyPasswordResetOtpAsync({ email, code, newPassword }) {
  verifyPasswordResetOtp({ email, code, newPassword });
  const supabase = createServerSupabaseClient();
  if (supabase) {
    await supabase.from("users").update({ password_hash: hashPassword(newPassword) }).eq("email", email);
  }
  return true;
}

export function changePassword({ userId, currentPassword, newPassword }) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.id === userId);
  if (!user || user.passwordHash !== hashPassword(currentPassword)) {
    throw new Error("Current password is incorrect");
  }
  user.passwordHash = hashPassword(newPassword);
  writeJsonArray(paths.users, users);
  return true;
}

export async function changePasswordAsync({ userId, currentPassword, newPassword }) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (!data || data.password_hash !== hashPassword(currentPassword)) {
      throw new Error("Current password is incorrect");
    }
    await supabase.from("users").update({ password_hash: hashPassword(newPassword) }).eq("id", userId);
    return true;
  }
  return changePassword({ userId, currentPassword, newPassword });
}
