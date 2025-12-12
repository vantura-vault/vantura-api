import { cache } from './cache.js';
import { dataChamberService } from './dataChamberService.js';
import { vaultService } from './vaultService.js';
import { analyticsService } from './analyticsService.js';

/**
 * Pre-warm cache for a user's company after login/register
 * Runs asynchronously - doesn't block the auth response
 */
export async function prewarmCacheForCompany(companyId: string): Promise<void> {
  // Skip if Redis not available
  if (!cache.isAvailable()) {
    return;
  }

  console.log(`🔥 [CacheWarmer] Pre-warming cache for company ${companyId}`);

  // Run all pre-warming in parallel for speed
  const warmingTasks = [
    // Company settings (Data Chamber)
    dataChamberService.getSettings(companyId)
      .then(() => console.log(`  ✓ Company settings cached`))
      .catch(err => console.error(`  ✗ Company settings failed:`, err.message)),

    // Competitors list (Vault)
    vaultService.getCompetitors(companyId)
      .then(() => console.log(`  ✓ Competitors list cached`))
      .catch(err => console.error(`  ✗ Competitors list failed:`, err.message)),

    // Analytics - LinkedIn 1M (most common default view)
    analyticsService.getHistoricalMetrics(companyId, 'LinkedIn', '1M')
      .then(() => console.log(`  ✓ LinkedIn 1M analytics cached`))
      .catch(err => console.error(`  ✗ LinkedIn analytics failed:`, err.message)),

    // Data health score
    dataChamberService.calculateDataHealth(companyId)
      .then(() => console.log(`  ✓ Data health cached`))
      .catch(err => console.error(`  ✗ Data health failed:`, err.message)),
  ];

  await Promise.allSettled(warmingTasks);

  console.log(`🔥 [CacheWarmer] Pre-warming complete for company ${companyId}`);
}

/**
 * Fire-and-forget version that doesn't await completion
 * Use this in login/register to not block the response
 */
export function prewarmCacheAsync(companyId: string): void {
  setImmediate(() => {
    prewarmCacheForCompany(companyId).catch(err => {
      console.error(`❌ [CacheWarmer] Pre-warm failed:`, err);
    });
  });
}
