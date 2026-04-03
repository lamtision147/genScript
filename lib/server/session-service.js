import { sanitizeUser } from "@/lib/server/auth-service";
import { ensurePlanInfoForUserAsync, markExpiredSubscriptionsToFreeAsync } from "@/lib/server/billing-service";
import { getGenerationQuotaSummaryAsync } from "@/lib/server/generation-quota-service";

export async function buildSessionUserAsync(user) {
  const base = sanitizeUser(user);
  if (!base) return null;

  try {
    await markExpiredSubscriptionsToFreeAsync();
    const [planInfo, generateQuota] = await Promise.all([
      ensurePlanInfoForUserAsync(user),
      getGenerationQuotaSummaryAsync(user.id)
    ]);
    return {
      ...base,
      plan: planInfo.plan,
      planStatus: planInfo.status,
      planLimits: planInfo.limits,
      upgradedAt: planInfo.upgradedAt || null,
      planExpiresAt: planInfo.expiresAt || null,
      cancelAtPeriodEnd: Boolean(planInfo.cancelAtPeriodEnd),
      cancelledAt: planInfo.cancelledAt || null,
      remainingPlanDays: planInfo.remainingDays,
      generateQuota
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
      upgradedAt: null,
      generateQuota: {
        isPro: false,
        day: new Date().toISOString().slice(0, 10),
        productCopy: {
          limit: 5,
          used: 0,
          remaining: 5,
          unlimited: false
        },
        videoScript: {
          limit: 5,
          used: 0,
          remaining: 5,
          unlimited: false
        }
      }
    };
  }
}
