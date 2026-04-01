import { sanitizeUser } from "@/lib/server/auth-service";
import { ensurePlanInfoForUserAsync } from "@/lib/server/billing-service";

export async function buildSessionUserAsync(user) {
  const base = sanitizeUser(user);
  if (!base) return null;

  try {
    const planInfo = await ensurePlanInfoForUserAsync(user);
    return {
      ...base,
      plan: planInfo.plan,
      planStatus: planInfo.status,
      planLimits: planInfo.limits,
      upgradedAt: planInfo.upgradedAt || null
    };
  } catch {
    return {
      ...base,
      plan: "free",
      planStatus: "active",
      planLimits: {
        plan: "free",
        favoritesLimit: 5,
        historyLimit: 5,
        unlimitedFavorites: false,
        unlimitedHistory: false
      },
      upgradedAt: null
    };
  }
}
