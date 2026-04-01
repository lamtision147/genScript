export function getEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

export const appEnv = {
  publicBaseUrl: getEnv("PUBLIC_BASE_URL", "http://127.0.0.1:4174"),
  supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecretKey: getEnv("STRIPE_SECRET_KEY"),
  stripePublicKey: getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
};
