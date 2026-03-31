import crypto from "crypto";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OTP_EXPIRES_MS, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-constants";

const otpStore = new Map();
const passwordResetStore = new Map();
const oauthStateStore = new Map();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let mailTransport = null;

export function isUuid(value) {
  return UUID_REGEX.test(String(value || "").trim());
}

function getAdminIdentity() {
  const email = String(process.env.ADMIN_EMAIL || "admin").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "admin");
  const name = String(process.env.ADMIN_NAME || "Admin Seller Studio").trim() || "Admin Seller Studio";
  return { email, password, name };
}

const DEV_ADMIN_EMAIL_ALIASES = new Set(["admin", "admin@sellerstudio.local"]);

export function isAdminEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  const adminEmail = getAdminIdentity().email;
  if (normalized === adminEmail) return true;
  if (process.env.NODE_ENV !== "production" && DEV_ADMIN_EMAIL_ALIASES.has(normalized)) {
    return true;
  }
  return false;
}

function readUsersStore() {
  return readJsonArray(paths.users);
}

function writeUsersStore(users) {
  return writeJsonArray(paths.users, users);
}

function normalizeLocalUserForSession(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    favorites: Array.isArray(user.favorites) ? user.favorites : [],
    passwordHash: user.passwordHash,
    supabaseId: user.supabaseId || null
  };
}

function getLocalUserById(userId) {
  return readUsersStore().find((user) => user.id === userId) || null;
}

function upsertLocalUser({ email, name, passwordHash, supabaseId, preferredId }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const users = readUsersStore();
  let user = users.find((item) => item.email === normalizedEmail);

  if (!user) {
    user = {
      id: preferredId || crypto.randomUUID(),
      email: normalizedEmail,
      name: name || normalizedEmail.split("@")[0] || "User",
      favorites: []
    };
    if (passwordHash) user.passwordHash = passwordHash;
    if (supabaseId) user.supabaseId = supabaseId;
    users.unshift(user);
    writeUsersStore(users);
    return user;
  }

  let changed = false;
  if (name && user.name !== name) {
    user.name = name;
    changed = true;
  }
  if (passwordHash && user.passwordHash !== passwordHash) {
    user.passwordHash = passwordHash;
    changed = true;
  }
  if (supabaseId && user.supabaseId !== supabaseId) {
    user.supabaseId = supabaseId;
    changed = true;
  }
  if (!Array.isArray(user.favorites)) {
    user.favorites = [];
    changed = true;
  }

  if (changed) writeUsersStore(users);
  return user;
}

async function upsertSupabaseUserByEmail({ email, name, passwordHash }, supabase) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to lookup user in Supabase");
  }

  if (existing) {
    const updates = {};
    if (name && existing.name !== name) updates.name = name;
    if (passwordHash && existing.password_hash !== passwordHash) updates.password_hash = passwordHash;

    if (Object.keys(updates).length) {
      const { data: updated, error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError) {
        throw new Error(updateError.message || "Failed to update Supabase user");
      }

      return updated;
    }

    return existing;
  }

  const insertPayload = {
    email: normalizedEmail,
    name: name || normalizedEmail.split("@")[0] || "User",
    created_at: new Date().toISOString()
  };
  if (passwordHash) insertPayload.password_hash = passwordHash;

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertError) {
    const { data: retried, error: retryError } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (retryError) {
      throw new Error(retryError.message || insertError.message || "Failed to create Supabase user");
    }
    if (retried) return retried;
    throw new Error(insertError.message || "Failed to create Supabase user");
  }

  return inserted;
}

export async function resolveSupabaseUserId(userOrId, providedSupabaseClient = null) {
  const supabase = providedSupabaseClient || createServerSupabaseClient();
  if (!supabase) return null;

  if (typeof userOrId === "string") {
    if (isUuid(userOrId)) return userOrId;
    const local = getLocalUserById(userOrId);
    if (!local) return null;
    return resolveSupabaseUserId(local, supabase);
  }

  const localUser = userOrId;
  if (!localUser?.email) return null;
  if (isUuid(localUser.supabaseId)) return localUser.supabaseId;
  if (isUuid(localUser.id)) {
    const { data: byId, error: byIdError } = await supabase
      .from("users")
      .select("*")
      .eq("id", localUser.id)
      .maybeSingle();

    if (byIdError) {
      throw new Error(byIdError.message || "Failed to lookup Supabase user by id");
    }

    if (byId?.id) {
      upsertLocalUser({
        email: localUser.email,
        name: byId.name || localUser.name,
        passwordHash: localUser.passwordHash || byId.password_hash,
        supabaseId: byId.id,
        preferredId: localUser.id
      });
      return byId.id;
    }
  }

  const supabaseUser = await upsertSupabaseUserByEmail({
    email: localUser.email,
    name: localUser.name,
    passwordHash: localUser.passwordHash
  }, supabase);

  if (!supabaseUser?.id) return null;

  upsertLocalUser({
    email: localUser.email,
    name: supabaseUser.name || localUser.name,
    passwordHash: localUser.passwordHash || supabaseUser.password_hash,
    supabaseId: supabaseUser.id,
    preferredId: localUser.id
  });

  return supabaseUser.id;
}

function verifyOtpStoreCode(store, email, code) {
  const key = String(email || "").trim().toLowerCase();
  const otp = store.get(key);
  if (!otp || otp.expiresAt < Date.now() || otp.code !== code) {
    throw new Error("Invalid or expired OTP");
  }
  store.delete(key);
  return otp;
}

function consumeSignupOtp(email, code) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const otp = verifyOtpStoreCode(otpStore, normalizedEmail, code);
  return { normalizedEmail, otp };
}

function upsertLocalSignupUser({ email, name, passwordHash, preferredId }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const users = readUsersStore();
  let user = users.find((item) => item.email === normalizedEmail);

  if (!user) {
    user = {
      id: preferredId || crypto.randomUUID(),
      email: normalizedEmail,
      name: name || normalizedEmail.split("@")[0] || "User",
      favorites: [],
      passwordHash
    };
    users.unshift(user);
  } else {
    user.name = name || user.name;
    user.passwordHash = passwordHash;
    if (!Array.isArray(user.favorites)) user.favorites = [];
    if (preferredId && !user.supabaseId) user.supabaseId = preferredId;
  }

  const wrote = writeUsersStore(users);
  if (!wrote) {
    throw new Error("Local user storage is read-only. Please configure Supabase for account persistence.");
  }

  return user;
}

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function getSessionSecret() {
  const raw = String(process.env.SESSION_SECRET || "");
  if (raw.trim().length >= 24) {
    return raw;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 24 characters in production");
  }

  return "seller-studio-dev-secret";
}

export function shouldExposeDebugOtpCode() {
  return process.env.NODE_ENV !== "production";
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

export function isSessionTokenValid(sessionId) {
  return Boolean(verifySessionPayload(sessionId));
}

export function destroySession(sessionId) {
  return sessionId;
}

export async function destroySessionAsync(sessionId) {
  return destroySession(sessionId);
}

export function getCurrentUserFromCookies() {
  return getCurrentUserFromCookiesAsync();
}

export async function getCurrentUserFromCookiesAsync() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  const payload = verifySessionPayload(sessionId);
  const userId = payload?.userId;
  if (!userId) return null;

  const supabase = createServerSupabaseClient();
  if (supabase) {
    if (isUuid(userId)) {
      const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
      if (data) return data;
    }
  }

  const localUser = readJsonArray(paths.users).find((user) => user.id === userId) || null;
  if (localUser && supabase) {
    await resolveSupabaseUserId(localUser, supabase).catch(() => null);
  }
  return localUser;
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
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const users = readUsersStore();
  const existingUser = users.find((item) => item.email === normalizedEmail);
  if (existingUser?.passwordHash) {
    throw new Error("Account already exists. Please log in with email and password.");
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalizedEmail, {
    code,
    name,
    passwordHash: hashPassword(password),
    expiresAt: Date.now() + OTP_EXPIRES_MS
  });
  return code;
}

export async function requestSignupOtpAsync({ email, name, password }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("id,password_hash").eq("email", normalizedEmail).maybeSingle();
    if (data?.password_hash) {
      throw new Error("Account already exists. Please log in with email and password.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(normalizedEmail, {
      code,
      name,
      passwordHash: hashPassword(password),
      expiresAt: Date.now() + OTP_EXPIRES_MS
    });
    return code;
  }
  return requestSignupOtp({ email: normalizedEmail, name, password });
}

export function verifySignupOtp({ email, code }) {
  const { normalizedEmail, otp } = consumeSignupOtp(email, code);
  return upsertLocalSignupUser({
    email: normalizedEmail,
    name: otp.name || normalizedEmail.split("@")[0] || "User",
    passwordHash: otp.passwordHash
  });
}

export async function verifySignupOtpAsync({ email, code }) {
  const { normalizedEmail, otp } = consumeSignupOtp(email, code);
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const supabaseUser = await upsertSupabaseUserByEmail({
      email: normalizedEmail,
      name: otp.name || normalizedEmail.split("@")[0] || "User",
      passwordHash: otp.passwordHash
    }, supabase);

    if (supabaseUser?.id) {
      try {
        upsertLocalUser({
          email: normalizedEmail,
          name: supabaseUser.name || otp.name || normalizedEmail.split("@")[0] || "User",
          passwordHash: otp.passwordHash,
          supabaseId: supabaseUser.id,
          preferredId: supabaseUser.id
        });
      } catch {
        // Ignore local mirror failures in read-only environments.
      }

      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.name,
        favorites: [],
        passwordHash: otp.passwordHash,
        supabaseId: supabaseUser.id
      };
    }
  }

  return upsertLocalSignupUser({
    email: normalizedEmail,
    name: otp.name || normalizedEmail.split("@")[0] || "User",
    passwordHash: otp.passwordHash
  });
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
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const adminIdentity = getAdminIdentity();

  if (normalizedEmail === adminIdentity.email) {
    if (password !== adminIdentity.password) {
      throw new Error("Invalid email or password");
    }

    const adminHash = hashPassword(adminIdentity.password);
    if (supabase) {
      const supabaseUser = await upsertSupabaseUserByEmail({
        email: adminIdentity.email,
        name: adminIdentity.name,
        passwordHash: adminHash
      }, supabase);

      if (supabaseUser?.id) {
        try {
          upsertLocalUser({
            email: adminIdentity.email,
            name: supabaseUser.name || adminIdentity.name,
            passwordHash: adminHash,
            supabaseId: supabaseUser.id,
            preferredId: supabaseUser.id
          });
        } catch {
          // Ignore local mirror failures in read-only environments.
        }

        return normalizeLocalUserForSession({
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.name,
          favorites: [],
          passwordHash: adminHash,
          supabaseId: supabaseUser.id
        });
      }
    }

    const localAdmin = upsertLocalUser({
      email: adminIdentity.email,
      name: adminIdentity.name,
      passwordHash: adminHash,
      preferredId: crypto.randomUUID()
    });
    return normalizeLocalUserForSession(localAdmin);
  }

  if (supabase) {
    const { data } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();
    if (data) {
      if (!data.password_hash) throw new Error("This account needs to finish password setup.");
      if (data.password_hash !== hashPassword(password)) throw new Error("Invalid email or password");
      const localMirror = upsertLocalUser({
        email: data.email,
        name: data.name,
        passwordHash: data.password_hash,
        supabaseId: data.id,
        preferredId: data.id
      });
      return normalizeLocalUserForSession({ ...localMirror, id: data.id, supabaseId: data.id });
    }
  }

  const localUser = loginWithPassword({ email: normalizedEmail, password });
  if (supabase) {
    const supabaseUserId = await resolveSupabaseUserId(localUser, supabase);
    if (supabaseUserId) {
      localUser.supabaseId = supabaseUserId;
      localUser.id = supabaseUserId;
      upsertLocalUser({
        email: localUser.email,
        name: localUser.name,
        passwordHash: localUser.passwordHash,
        supabaseId: supabaseUserId,
        preferredId: localUser.id
      });
    }
  }
  return normalizeLocalUserForSession(localUser);
}

export function sanitizeUser(user) {
  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: isAdminEmail(user.email)
      }
    : null;
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
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const supabaseUser = await upsertSupabaseUserByEmail({ email: normalizedEmail, name }, supabase);
    if (supabaseUser?.id) {
      try {
        const synced = upsertLocalUser({
          email: normalizedEmail,
          name: supabaseUser.name || name,
          supabaseId: supabaseUser.id,
          preferredId: supabaseUser.id
        });
        return { ...synced, id: supabaseUser.id, supabaseId: supabaseUser.id };
      } catch {
        return {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.name,
          favorites: [],
          supabaseId: supabaseUser.id
        };
      }
    }
  }

  return upsertLocalUser({
    email: normalizedEmail,
    name,
    preferredId: crypto.randomUUID()
  });
}

export function requestPasswordResetOtp(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const users = readUsersStore();
  const user = users.find((item) => item.email === normalizedEmail);
  if (!user) throw new Error("Account not found");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetStore.set(normalizedEmail, { code, expiresAt: Date.now() + OTP_EXPIRES_MS });
  return code;
}

export async function requestPasswordResetOtpAsync(email) {
  const supabase = createServerSupabaseClient();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (supabase) {
    const { data } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle();
    if (!data) throw new Error("Account not found");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    passwordResetStore.set(normalizedEmail, { code, expiresAt: Date.now() + OTP_EXPIRES_MS });
    return code;
  }

  const localUsers = readUsersStore();
  const localUser = localUsers.find((item) => item.email === normalizedEmail);
  if (!localUser) throw new Error("Account not found");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetStore.set(normalizedEmail, { code, expiresAt: Date.now() + OTP_EXPIRES_MS });
  return code;

}

export function verifyPasswordResetOtp({ email, code, newPassword }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  verifyOtpStoreCode(passwordResetStore, normalizedEmail, code);
  const users = readUsersStore();
  const user = users.find((item) => item.email === normalizedEmail);
  if (!user) throw new Error("Account not found");
  user.passwordHash = hashPassword(newPassword);
  const ok = writeUsersStore(users);
  if (!ok) {
    throw new Error("Password reset requires writable local storage or Supabase configuration.");
  }
  return true;
}

export async function verifyPasswordResetOtpAsync({ email, code, newPassword }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  verifyOtpStoreCode(passwordResetStore, normalizedEmail, code);

  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle();
    if (!data) throw new Error("Account not found");
    await supabase.from("users").update({ password_hash: hashPassword(newPassword) }).eq("email", normalizedEmail);
    try {
      const users = readUsersStore();
      const localUser = users.find((item) => item.email === normalizedEmail);
      if (localUser) {
        localUser.passwordHash = hashPassword(newPassword);
        writeUsersStore(users);
      }
    } catch {
      // Ignore local mirror failures in read-only environments.
    }
    return true;
  }

  const users = readUsersStore();
  const localUser = users.find((item) => item.email === normalizedEmail);
  if (!localUser) throw new Error("Account not found");
  localUser.passwordHash = hashPassword(newPassword);
  const wrote = writeUsersStore(users);
  if (!wrote) {
    throw new Error("Password reset requires writable local storage or Supabase configuration.");
  }

  return true;
}

export function changePassword({ userId, currentPassword, newPassword }) {
  const users = readUsersStore();
  const user = users.find((item) => item.id === userId);
  if (!user || user.passwordHash !== hashPassword(currentPassword)) {
    throw new Error("Current password is incorrect");
  }
  user.passwordHash = hashPassword(newPassword);
  const ok = writeUsersStore(users);
  if (!ok) {
    throw new Error("Password change requires writable local storage or Supabase configuration.");
  }
  return true;
}

export async function changePasswordAsync({ userId, currentPassword, newPassword }) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const supabaseUserId = await resolveSupabaseUserId(userId, supabase);
    if (!supabaseUserId) {
      throw new Error("Current password is incorrect");
    }

    const { data } = await supabase.from("users").select("*").eq("id", supabaseUserId).maybeSingle();
    if (!data || data.password_hash !== hashPassword(currentPassword)) {
      throw new Error("Current password is incorrect");
    }
    await supabase.from("users").update({ password_hash: hashPassword(newPassword) }).eq("id", supabaseUserId);

    const users = readUsersStore();
    const localUser = users.find((item) => item.id === userId || item.supabaseId === supabaseUserId || item.email === data.email);
    if (localUser) {
      localUser.passwordHash = hashPassword(newPassword);
      localUser.supabaseId = supabaseUserId;
      writeUsersStore(users);
    }

    return true;
  }
  return changePassword({ userId, currentPassword, newPassword });
}
