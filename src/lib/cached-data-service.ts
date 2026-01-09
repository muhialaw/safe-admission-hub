/**
 * Data Service with Caching
 * Wraps all student, grades, terms, and auth data fetching with cache layer
 * Falls back to cache when offline
 */

import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cache-manager';
import { Student, Grade, GradeTerm, Profile, UserRole } from '@/types/database';

export class CachedDataService {
  // Cache keys
  private readonly CACHE_KEYS = {
    STUDENTS: 'students_all',
    GRADES: 'grades_all',
    GRADE_TERMS: 'grade_terms_all',
    STUDENTS_BY_GRADE: (gradeId: string) => `students_grade_${gradeId}`,
    GRADE_TERMS_BY_GRADE: (gradeId: string, year: number) => `grade_terms_${gradeId}_${year}`,
    PROFILE: 'user_profile',
    ROLE: 'user_role',
    ALL_PROFILES: 'profiles_all',
  };

  /**
   * Check if app is online
   */
  private isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Fetch all students with cache fallback
   */
  async getStudents(options?: { forceRefresh?: boolean }): Promise<Student[]> {
    const cacheKey = this.CACHE_KEYS.STUDENTS;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<Student[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached students (${cached.length} records)`);
        return cached;
      }
    }

    // If offline, return cache if available
    if (!this.isOnline()) {
      const cached = cacheManager.getCache<Student[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] OFFLINE MODE: Using cached students (${cached.length} records)`);
        return cached;
      }
      throw new Error('Offline and no cached data available');
    }

    console.log('[DataService] Fetching students from API...');
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;

      const students = (data as Student[]) || [];
      cacheManager.setCache(cacheKey, students);
      console.log(`[DataService] Fetched and cached ${students.length} students`);
      return students;
    } catch (error) {
      console.error('[DataService] Error fetching students:', error);
      // Fallback to cache on error
      const cached = cacheManager.getCache<Student[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] API error - falling back to cached students (${cached.length} records)`);
        return cached;
      }
      throw error;
    }
  }

  /**
   * Fetch all grades with cache fallback
   */
  async getGrades(options?: { forceRefresh?: boolean }): Promise<Grade[]> {
    const cacheKey = this.CACHE_KEYS.GRADES;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<Grade[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached grades (${cached.length} records)`);
        return cached;
      }
    }

    // If offline, return cache if available
    if (!this.isOnline()) {
      const cached = cacheManager.getCache<Grade[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] OFFLINE MODE: Using cached grades (${cached.length} records)`);
        return cached;
      }
      throw new Error('Offline and no cached data available');
    }

    console.log('[DataService] Fetching grades from API...');
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      const grades = (data as Grade[]) || [];
      cacheManager.setCache(cacheKey, grades);
      console.log(`[DataService] Fetched and cached ${grades.length} grades`);
      return grades;
    } catch (error) {
      console.error('[DataService] Error fetching grades:', error);
      // Fallback to cache on error
      const cached = cacheManager.getCache<Grade[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] API error - falling back to cached grades (${cached.length} records)`);
        return cached;
      }
      throw error;
    }
  }

  /**
   * Fetch all grade terms for current academic year with cache fallback
   */
  async getGradeTerms(
    academicYear: number = new Date().getFullYear(),
    options?: { forceRefresh?: boolean }
  ): Promise<GradeTerm[]> {
    const cacheKey = this.CACHE_KEYS.GRADE_TERMS;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<GradeTerm[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached grade terms (${cached.length} records)`);
        return cached;
      }
    }

    // If offline, return cache if available
    if (!this.isOnline()) {
      const cached = cacheManager.getCache<GradeTerm[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] OFFLINE MODE: Using cached grade terms (${cached.length} records)`);
        return cached;
      }
      throw new Error('Offline and no cached data available');
    }

    console.log('[DataService] Fetching grade terms from API...');
    try {
      const { data, error } = await supabase
        .from('grade_terms')
        .select('*')
        .eq('is_active', true)
        .eq('academic_year', academicYear)
        .order('grade_id, term_order');

      if (error) throw error;

      const gradeTerms = (data as GradeTerm[]) || [];
      cacheManager.setCache(cacheKey, gradeTerms);
      console.log(`[DataService] Fetched and cached ${gradeTerms.length} grade terms`);
      return gradeTerms;
    } catch (error) {
      console.error('[DataService] Error fetching grade terms:', error);
      // Fallback to cache on error
      const cached = cacheManager.getCache<GradeTerm[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] API error - falling back to cached grade terms (${cached.length} records)`);
        return cached;
      }
      throw error;
    }
  }

  /**
   * Fetch students by grade with cache fallback
   */
  async getStudentsByGrade(
    gradeId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<Student[]> {
    const cacheKey = this.CACHE_KEYS.STUDENTS_BY_GRADE(gradeId);

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<Student[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached students for grade ${gradeId} (${cached.length} records)`);
        return cached;
      }
    }

    console.log(`[DataService] Fetching students for grade ${gradeId} from API...`);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('grade_id', gradeId)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;

      const students = (data as Student[]) || [];
      cacheManager.setCache(cacheKey, students);
      console.log(`[DataService] Fetched and cached ${students.length} students for grade ${gradeId}`);
      return students;
    } catch (error) {
      console.error(`[DataService] Error fetching students for grade ${gradeId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch grade terms for specific grade and year with cache fallback
   */
  async getGradeTermsByGrade(
    gradeId: string,
    academicYear: number = new Date().getFullYear(),
    options?: { forceRefresh?: boolean }
  ): Promise<GradeTerm[]> {
    const cacheKey = this.CACHE_KEYS.GRADE_TERMS_BY_GRADE(gradeId, academicYear);

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<GradeTerm[]>(cacheKey);
      if (cached) {
        console.log(
          `[DataService] Using cached grade terms for grade ${gradeId}, year ${academicYear} (${cached.length} records)`
        );
        return cached;
      }
    }

    console.log(`[DataService] Fetching grade terms for grade ${gradeId}, year ${academicYear} from API...`);
    try {
      const { data, error } = await supabase
        .from('grade_terms')
        .select('*')
        .eq('grade_id', gradeId)
        .eq('academic_year', academicYear)
        .eq('is_active', true)
        .order('term_order');

      if (error) throw error;

      const gradeTerms = (data as GradeTerm[]) || [];
      cacheManager.setCache(cacheKey, gradeTerms);
      console.log(
        `[DataService] Fetched and cached ${gradeTerms.length} grade terms for grade ${gradeId}, year ${academicYear}`
      );
      return gradeTerms;
    } catch (error) {
      console.error(
        `[DataService] Error fetching grade terms for grade ${gradeId}, year ${academicYear}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Force refresh specific cache
   */
  refreshCache(dataType: 'students' | 'grades' | 'gradeTerms' | 'all'): void {
    if (dataType === 'students' || dataType === 'all') {
      cacheManager.clearCache(this.CACHE_KEYS.STUDENTS);
    }
    if (dataType === 'grades' || dataType === 'all') {
      cacheManager.clearCache(this.CACHE_KEYS.GRADES);
    }
    if (dataType === 'gradeTerms' || dataType === 'all') {
      cacheManager.clearCache(this.CACHE_KEYS.GRADE_TERMS);
    }
    console.log(`[DataService] Cache refreshed for: ${dataType}`);
  }

  /**
   * Fetch user profile with cache fallback
   */
  async getProfile(userId: string, options?: { forceRefresh?: boolean }): Promise<Profile | null> {
    const cacheKey = this.CACHE_KEYS.PROFILE;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<Profile>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached profile for user ${userId}`, {
          name: cached.full_name,
          email: cached.email,
        });
        return cached;
      }
    }

    // If offline, return cache if available
    if (!this.isOnline()) {
      const cached = cacheManager.getCache<Profile>(cacheKey);
      if (cached) {
        console.log(`[DataService] OFFLINE MODE: Using cached profile for user ${userId}`);
        return cached;
      }
      throw new Error('Offline and no cached data available');
    }

    console.log(`[DataService] Fetching profile for user ${userId} from API...`);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const profile = data as Profile;
      cacheManager.setCache(cacheKey, profile);
      console.log(`[DataService] Fetched and cached profile`, {
        name: profile.full_name,
        email: profile.email,
      });
      return profile;
    } catch (error) {
      console.error('[DataService] Error fetching profile:', error);
      // Fallback to cache on error
      const cached = cacheManager.getCache<Profile>(cacheKey);
      if (cached) {
        console.log(`[DataService] API error - falling back to cached profile`);
        return cached;
      }
      throw error;
    }
  }

  /**
   * Fetch user role with cache fallback
   */
  async getUserRole(userId: string, options?: { forceRefresh?: boolean }): Promise<UserRole | null> {
    const cacheKey = this.CACHE_KEYS.ROLE;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<UserRole>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached role for user ${userId}`, {
          role: cached.role,
        });
        return cached;
      }
    }

    // If offline, return cache if available
    if (!this.isOnline()) {
      const cached = cacheManager.getCache<UserRole>(cacheKey);
      if (cached) {
        console.log(`[DataService] OFFLINE MODE: Using cached role for user ${userId}`);
        return cached;
      }
      console.warn('[DataService] Offline and no cached role available for user:', userId);
      return null;
    }

    console.log(`[DataService] Fetching role for user ${userId} from API...`);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const role = data as UserRole;
      cacheManager.setCache(cacheKey, role);
      console.log(`[DataService] Fetched and cached role`, {
        role: role.role,
      });
      return role;
    } catch (error) {
      console.error('[DataService] Error fetching role:', error);
      // Fallback to cache on error
      const cached = cacheManager.getCache<UserRole>(cacheKey);
      if (cached) {
        console.log(`[DataService] API error - falling back to cached role`);
        return cached;
      }
      return null; // Role might not exist, return null instead of throwing
    }
  }

  /**
   * Fetch all profiles (admin)
   */
  async getAllProfiles(options?: { forceRefresh?: boolean }): Promise<Profile[]> {
    const cacheKey = this.CACHE_KEYS.ALL_PROFILES;

    // Check cache first
    if (!options?.forceRefresh) {
      const cached = cacheManager.getCache<Profile[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] Using cached profiles (${cached.length} records)`);
        return cached;
      }
    }

    // If offline, return cache if available
    if (!this.isOnline()) {
      const cached = cacheManager.getCache<Profile[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] OFFLINE MODE: Using cached profiles (${cached.length} records)`);
        return cached;
      }
      throw new Error('Offline and no cached data available');
    }

    console.log('[DataService] Fetching all profiles from API...');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const profiles = (data as Profile[]) || [];
      cacheManager.setCache(cacheKey, profiles);
      console.log(`[DataService] Fetched and cached ${profiles.length} profiles`);
      return profiles;
    } catch (error) {
      console.error('[DataService] Error fetching profiles:', error);
      // Fallback to cache on error
      const cached = cacheManager.getCache<Profile[]>(cacheKey);
      if (cached) {
        console.log(`[DataService] API error - falling back to cached profiles (${cached.length} records)`);
        return cached;
      }
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    cacheManager.clearAllCaches();
    console.log('[DataService] All caches cleared');
  }
}

export const cachedDataService = new CachedDataService();
