/**
 * Hook for initializing essential cache on app startup
 * Ensures student, grade, and grade term data are cached for offline use
 */

import { useEffect, useRef } from 'react';
import { cachedDataService } from '@/lib/cached-data-service';

export function useInitializeCache() {
  const initialized = useRef(false);

  useEffect(() => {
    // Only run once per app session
    if (initialized.current) return;
    initialized.current = true;

    const initializeEssentialCache = async () => {
      try {
        console.log('[useInitializeCache] Starting cache initialization...');
        
        // Fetch essential data for offline use
        const [students, grades, gradeTerms] = await Promise.all([
          cachedDataService.getStudents({ forceRefresh: false }),
          cachedDataService.getGrades({ forceRefresh: false }),
          cachedDataService.getGradeTerms(new Date().getFullYear(), { forceRefresh: false }),
        ]);

        console.log('[useInitializeCache] Cache initialization complete:', {
          studentsCount: students.length,
          gradesCount: grades.length,
          gradeTermsCount: gradeTerms.length,
        });

        // Log that essential data is available offline
        console.log('[useInitializeCache] Essential offline data is now available');
      } catch (error) {
        // If we're offline, that's OK - the cache will be used when online
        if (!navigator.onLine) {
          console.log('[useInitializeCache] Offline during initialization - cache will be used from storage');
        } else {
          console.error('[useInitializeCache] Error initializing cache:', error);
        }
      }
    };

    // Defer initialization to avoid blocking app startup
    const timeoutId = setTimeout(initializeEssentialCache, 1000);

    return () => clearTimeout(timeoutId);
  }, []);
}
