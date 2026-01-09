/**
 * Hook for cache management
 * Provides functions to refresh or clear caches in the application
 */

import { useCallback } from 'react';
import { cachedDataService } from '@/lib/cached-data-service';
import { cacheManager } from '@/lib/cache-manager';

export function useCacheManager() {
  const refreshStudents = useCallback(async () => {
    console.log('[useCacheManager] Refreshing students cache...');
    cachedDataService.refreshCache('students');
    return cachedDataService.getStudents({ forceRefresh: true });
  }, []);

  const refreshGrades = useCallback(async () => {
    console.log('[useCacheManager] Refreshing grades cache...');
    cachedDataService.refreshCache('grades');
    return cachedDataService.getGrades({ forceRefresh: true });
  }, []);

  const refreshGradeTerms = useCallback(async () => {
    console.log('[useCacheManager] Refreshing grade terms cache...');
    cachedDataService.refreshCache('gradeTerms');
    return cachedDataService.getGradeTerms(new Date().getFullYear(), { forceRefresh: true });
  }, []);

  const refreshProfile = useCallback(async (userId: string) => {
    console.log(`[useCacheManager] Refreshing profile cache for user ${userId}...`);
    return cachedDataService.getProfile(userId, { forceRefresh: true });
  }, []);

  const refreshRole = useCallback(async (userId: string) => {
    console.log(`[useCacheManager] Refreshing role cache for user ${userId}...`);
    return cachedDataService.getUserRole(userId, { forceRefresh: true });
  }, []);

  const refreshAuth = useCallback(async (userId: string) => {
    console.log(`[useCacheManager] Refreshing all auth caches for user ${userId}...`);
    return Promise.all([
      cachedDataService.getProfile(userId, { forceRefresh: true }),
      cachedDataService.getUserRole(userId, { forceRefresh: true }),
    ]);
  }, []);

  const refreshAll = useCallback(async () => {
    console.log('[useCacheManager] Refreshing all caches...');
    cachedDataService.refreshCache('all');
    return Promise.all([
      cachedDataService.getStudents({ forceRefresh: true }),
      cachedDataService.getGrades({ forceRefresh: true }),
      cachedDataService.getGradeTerms(new Date().getFullYear(), { forceRefresh: true }),
    ]);
  }, []);

  const clearAll = useCallback(() => {
    console.log('[useCacheManager] Clearing non-essential caches (preserving offline data)...');
    cacheManager.clearNonEssentialCaches();
  }, []);

  const clearAllIncludingEssential = useCallback(() => {
    console.log('[useCacheManager] Clearing ALL caches including essential data...');
    cacheManager.clearAllCaches();
  }, []);

  const getCacheInfo = useCallback(() => {
    return cacheManager.getCacheInfo();
  }, []);

  return {
    refreshStudents,
    refreshGrades,
    refreshGradeTerms,
    refreshProfile,
    refreshRole,
    refreshAuth,
    refreshAll,
    clearAll,
    clearAllIncludingEssential,
    getCacheInfo,
  };
}
