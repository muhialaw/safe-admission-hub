/**
 * CACHING SYSTEM USAGE EXAMPLES
 * 
 * This file demonstrates how to use the caching system throughout the application.
 * All examples are in comments - view the code below for implementation patterns.
 */

// EXAMPLE 1: Using Cached Data Service directly in a component
//
// import { useState, useEffect } from 'react';
// import { cachedDataService } from '@/lib/cached-data-service';
//
// export function StudentList() {
//   const [students, setStudents] = useState([]);
//   const [loading, setLoading] = useState(true);
//
//   useEffect(() => {
//     const loadStudents = async () => {
//       try {
//         const data = await cachedDataService.getStudents();
//         setStudents(data);
//         console.log('Students loaded:', data.length);
//       } catch (error) {
//         console.error('Failed to load students:', error);
//       } finally {
//         setLoading(false);
//       }
//     };
//
//     loadStudents();
//   }, []);
//
//   if (loading) return <div>Loading...</div>;
//   return <div>{students.length} students loaded from cache</div>;
// }

// EXAMPLE 2: Using the Cache Manager Hook
//
// import { useCacheManager } from '@/hooks/useCacheManager';
// import { Button } from '@/components/ui/button';
//
// export function CacheControlPanel() {
//   const { refreshAll, clearAll, getCacheInfo } = useCacheManager();
//
//   const handleRefresh = async () => {
//     console.log('Refreshing all caches...');
//     await refreshAll();
//     console.log('Cache info:', getCacheInfo());
//   };
//
//   const handleClear = () => {
//     clearAll();
//     alert('All non-essential caches cleared!');
//   };
//
//   return (
//     <div className="space-y-2">
//       <Button onClick={handleRefresh}>Refresh All Caches</Button>
//       <Button onClick={handleClear}>Clear Non-Essential Caches</Button>
//     </div>
//   );
// }

// EXAMPLE 3: Cache Invalidation after mutations
//
// import { cachedDataService } from '@/lib/cached-data-service';
// import { CacheInvalidator } from '@/lib/cache-invalidator';
//
// export function StudentForm() {
//   const handleSubmit = async (formData: any) => {
//     try {
//       const response = await fetch('/api/students', {
//         method: 'POST',
//         body: JSON.stringify(formData),
//       });
//
//       CacheInvalidator.invalidateStudents();
//       alert('Student created! Cache refreshed.');
//     } catch (error) {
//       console.error('Error:', error);
//     }
//   };
//
//   return <form></form>;
// }
// ============================================================================
// CONSOLE LOG PATTERNS TO LOOK FOR
// ============================================================================
//
// First Load (Cache Miss):
//   [Cache] MISS: students_all (not found)
//   [DataService] Fetching students from API...
//   [Cache] SET: students_all { dataSize: 45234, ttlHours: 24, essential: true }
//   [DataService] Fetched and cached 150 students
//
// Subsequent Loads (Cache Hit):
//   [Cache] HIT: students_all { ageMinutes: 5, ttlHours: 24, dataSize: 45234 }
//   [DataService] Using cached students (150 records)
//
// After Expiration (24hrs):
//   [Cache] EXPIRED: students_all { ageHours: 25, ttlHours: 24 }
//   [DataService] Fetching students from API...
//
// After Cache Refresh:
//   [Cache] CLEARED NON-ESSENTIAL: 2 entries removed, essential data preserved

// ============================================================================
// KEY METHODS REFERENCE
// ============================================================================
//
// CACHE MANAGER
// cacheManager.setCache(key, data, options?)
// cacheManager.getCache(key)
// cacheManager.clearCache(key)
// cacheManager.clearNonEssentialCaches()
// cacheManager.clearAllCaches()
// cacheManager.getCacheInfo()
//
// CACHED DATA SERVICE
// cachedDataService.getStudents(options?)
// cachedDataService.getGrades(options?)
// cachedDataService.getGradeTerms(academicYear?, options?)
//
// USE CACHE MANAGER HOOK
// useCacheManager().refreshStudents()
// useCacheManager().refreshGrades()
// useCacheManager().refreshGradeTerms()
// useCacheManager().refreshAll()
// useCacheManager().clearAll()
// useCacheManager().getCacheInfo()
//
// CACHE INVALIDATOR
// CacheInvalidator.invalidateStudents()
// CacheInvalidator.invalidateGrades()
// CacheInvalidator.invalidateGradeTerms()
// CacheInvalidator.invalidateProfile()
// CacheInvalidator.invalidateRole()
// CacheInvalidator.invalidateAuth()

export const CACHING_EXAMPLES = {
  description: 'See comments above for implementation patterns',
  lastUpdated: '2026-01-09',
};
