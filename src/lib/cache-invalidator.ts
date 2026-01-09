/**
 * Cache Invalidation Helper
 * Clears cache after data mutations to ensure consistency
 */

import { cachedDataService } from './cached-data-service';
import { cacheManager } from './cache-manager';

export class CacheInvalidator {
  /**
   * Invalidate cache after student is created/updated/deleted
   */
  static invalidateStudents(): void {
    console.log('[CacheInvalidator] Invalidating students cache...');
    cachedDataService.refreshCache('students');
  }

  /**
   * Invalidate cache after grade is created/updated/deleted
   */
  static invalidateGrades(): void {
    console.log('[CacheInvalidator] Invalidating grades cache...');
    cachedDataService.refreshCache('grades');
  }

  /**
   * Invalidate cache after grade term is created/updated/deleted
   */
  static invalidateGradeTerms(): void {
    console.log('[CacheInvalidator] Invalidating grade terms cache...');
    cachedDataService.refreshCache('gradeTerms');
  }

  /**
   * Invalidate profile cache
   */
  static invalidateProfile(): void {
    console.log('[CacheInvalidator] Invalidating profile cache...');
    cacheManager.clearCache('user_profile');
  }

  /**
   * Invalidate role cache
   */
  static invalidateRole(): void {
    console.log('[CacheInvalidator] Invalidating role cache...');
    cacheManager.clearCache('user_role');
  }

  /**
   * Invalidate all profile/auth related caches
   */
  static invalidateAuth(): void {
    console.log('[CacheInvalidator] Invalidating all auth caches...');
    cacheManager.clearCache('user_profile');
    cacheManager.clearCache('user_role');
    cacheManager.clearCache('profiles_all');
  }

  /**
   * Invalidate all caches
   */
  static invalidateAll(): void {
    console.log('[CacheInvalidator] Invalidating all caches...');
    cachedDataService.refreshCache('all');
    this.invalidateAuth();
  }

  /**
   * Call after any CRUD operation
   */
  static afterCreate(entityType: 'student' | 'grade' | 'gradeTerm' | 'profile' | 'all'): void {
    console.log(`[CacheInvalidator] Data created: ${entityType}`);
    this.invalidateByType(entityType);
  }

  /**
   * Call after update operation
   */
  static afterUpdate(entityType: 'student' | 'grade' | 'gradeTerm' | 'profile' | 'all'): void {
    console.log(`[CacheInvalidator] Data updated: ${entityType}`);
    this.invalidateByType(entityType);
  }

  /**
   * Call after delete operation
   */
  static afterDelete(entityType: 'student' | 'grade' | 'gradeTerm' | 'profile' | 'all'): void {
    console.log(`[CacheInvalidator] Data deleted: ${entityType}`);
    this.invalidateByType(entityType);
  }

  /**
   * Helper to invalidate by entity type
   */
  private static invalidateByType(entityType: string): void {
    switch (entityType) {
      case 'student':
        this.invalidateStudents();
        break;
      case 'grade':
        this.invalidateGrades();
        break;
      case 'gradeTerm':
        this.invalidateGradeTerms();
        break;
      case 'profile':
        this.invalidateAuth();
        break;
      case 'all':
        this.invalidateAll();
        break;
    }
  }
}

export default CacheInvalidator;
