/**
 * Cache Manager with 24hr TTL
 * Handles caching of static data (students, fees, terms) to reduce API calls
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
  essential?: boolean; // Marks this as essential offline data
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 24 hours)
  essential?: boolean; // Mark as essential offline data that should not be cleared
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CACHE_PREFIX = 'admission_hub_cache_';
const ESSENTIAL_CACHES = new Set(['students_all', 'grades_all', 'grade_terms_all']);

class CacheManager {
  /**
   * Set cache with optional TTL and essential flag
   */
  public setCache<T>(key: string, data: T, options?: CacheOptions): void {
    const ttl = options?.ttl || DEFAULT_TTL;
    const essential = options?.essential !== false && ESSENTIAL_CACHES.has(key);
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      essential,
    };

    try {
      const prefixedKey = `${CACHE_PREFIX}${key}`;
      localStorage.setItem(prefixedKey, JSON.stringify(cacheEntry));
      console.log(`[Cache] SET: ${key}`, {
        dataSize: JSON.stringify(data).length,
        ttlHours: Math.round(ttl / (1000 * 60 * 60)),
        timestamp: new Date(cacheEntry.timestamp).toISOString(),
        essential,
      });
    } catch (error) {
      console.error(`[Cache] Error setting cache for ${key}:`, error);
    }
  }

  /**
   * Get cache if valid (not expired)
   */
  public getCache<T>(key: string): T | null {
    try {
      const prefixedKey = `${CACHE_PREFIX}${key}`;
      const cached = localStorage.getItem(prefixedKey);

      if (!cached) {
        console.log(`[Cache] MISS: ${key} (not found)`);
        return null;
      }

      const cacheEntry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();
      const age = now - cacheEntry.timestamp;
      const isExpired = age > cacheEntry.ttl;

      if (isExpired) {
        console.log(`[Cache] EXPIRED: ${key}`, {
          ageHours: Math.round(age / (1000 * 60 * 60)),
          ttlHours: Math.round(cacheEntry.ttl / (1000 * 60 * 60)),
        });
        this.clearCache(key);
        return null;
      }

      console.log(`[Cache] HIT: ${key}`, {
        ageMinutes: Math.round(age / (1000 * 60)),
        ttlHours: Math.round(cacheEntry.ttl / (1000 * 60 * 60)),
        dataSize: JSON.stringify(cacheEntry.data).length,
      });
      return cacheEntry.data;
    } catch (error) {
      console.error(`[Cache] Error getting cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear specific cache
   */
  public clearCache(key: string): void {
    try {
      const prefixedKey = `${CACHE_PREFIX}${key}`;
      localStorage.removeItem(prefixedKey);
      console.log(`[Cache] CLEARED: ${key}`);
    } catch (error) {
      console.error(`[Cache] Error clearing cache for ${key}:`, error);
    }
  }

  /**
   * Clear non-essential caches (preserves offline data)
   */
  public clearNonEssentialCaches(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          const cached = localStorage.getItem(key);
          if (cached) {
            try {
              const cacheEntry: CacheEntry<unknown> = JSON.parse(cached);
              // Only remove if NOT essential
              if (!cacheEntry.essential) {
                keysToRemove.push(key);
              }
            } catch (e) {
              // If can't parse, remove it
              keysToRemove.push(key);
            }
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`[Cache] CLEARED NON-ESSENTIAL: ${keysToRemove.length} entries removed, essential data preserved`);
    } catch (error) {
      console.error('[Cache] Error clearing non-essential caches:', error);
    }
  }

  /**
   * Clear all caches (including essential - use with caution!)
   */
  public clearAllCaches(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`[Cache] CLEARED ALL: ${keysToRemove.length} entries removed`);
    } catch (error) {
      console.error('[Cache] Error clearing all caches:', error);
    }
  }

  /**
   * Get cache info (debug purposes)
   */
  public getCacheInfo(): Record<string, Record<string, number | boolean>> {
    const info: Record<string, Record<string, number | boolean>> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          const cached = localStorage.getItem(key);
          if (cached) {
            const cacheEntry = JSON.parse(cached);
            const cleanKey = key.replace(CACHE_PREFIX, '');
            const age = Date.now() - cacheEntry.timestamp;
            const isExpired = age > cacheEntry.ttl;
            info[cleanKey] = {
              ageMinutes: Math.round(age / (1000 * 60)),
              ttlHours: Math.round(cacheEntry.ttl / (1000 * 60 * 60)),
              isExpired,
              dataSize: JSON.stringify(cacheEntry.data).length,
            };
          }
        }
      }
    } catch (error) {
      console.error('[Cache] Error getting cache info:', error);
    }
    return info;
  }
}

export const cacheManager = new CacheManager();
