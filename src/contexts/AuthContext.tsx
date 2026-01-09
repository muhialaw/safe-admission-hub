import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/types/database';
import { validateEmail, validatePassword } from '@/lib/validation';
import { logError } from '@/lib/error-logger';
import { cachedDataService } from '@/lib/cached-data-service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  hasAdmins: boolean | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: AppRole | null }>;
  signUp: (email: string, password: string, fullName: string, roleOverride?: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  registerAdmin: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  softDeleteReceptionist: (userId: string) => Promise<{ error: Error | null }>;
  validateRoleAccess: (requiredRole: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAdmins, setHasAdmins] = useState<boolean | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Check if any admins exist
    checkIfAdminsExist();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Add small delay to ensure DB records are available
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('[AuthContext] Fetching user data for:', userId);

      // Fetch profile with cache
      try {
        const profileData = await cachedDataService.getProfile(userId);
        setProfile(profileData);
        console.log('[AuthContext] Profile loaded from cache:', {
          name: profileData?.full_name,
          email: profileData?.email,
          profileId: profileData?.id,
          createdAt: profileData?.created_at,
        });
      } catch (error) {
        console.error('[AuthContext] Profile fetch error:', error);
        setProfile(null);
      }

      // Fetch role with cache
      try {
        const roleData = await cachedDataService.getUserRole(userId);
        if (roleData?.role) {
          console.log('[AuthContext] Role found and cached:', {
            role: roleData.role,
            roleId: roleData.id,
            createdAt: roleData.created_at,
          });
          setRole(roleData.role as AppRole);
        } else {
          console.warn('[AuthContext] No role found for user:', userId);
          setRole(null);
        }
      } catch (error) {
        console.error('[AuthContext] Role fetch error:', error);
        setRole(null);
      }

      // Initialize essential cache for offline use (fire and forget)
      console.log('[AuthContext] Initializing essential cache for offline use...');
      Promise.all([
        cachedDataService.getStudents({ forceRefresh: false }),
        cachedDataService.getGrades({ forceRefresh: false }),
        cachedDataService.getGradeTerms(new Date().getFullYear(), { forceRefresh: false }),
      ])
        .then(([students, grades, terms]) => {
          console.log('[AuthContext] Essential cache initialized:', {
            students: students.length,
            grades: grades.length,
            terms: terms.length,
          });
        })
        .catch(err => {
          // Silent fail - cache will be used when available
          console.log('[AuthContext] Essential cache initialization deferred:', err instanceof Error ? err.message : 'Unknown error');
        });
    } catch (error) {
      console.error('[AuthContext] Error fetching user data:', error);
      logError('Error fetching user data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfAdminsExist = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id', { count: 'exact' })
        .eq('role', 'admin');

      if (error) {
        console.error('Error checking admins:', error);
        setHasAdmins(false);
        return;
      }

      setHasAdmins((data && data.length > 0) ?? false);
    } catch (err) {
      console.error('Error checking admins:', err);
      setHasAdmins(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; role?: AppRole | null }> => {
    // Validate input
    if (!validateEmail(email)) {
      return { error: new Error('Invalid email format') };
    }

    if (!password || password.length === 0) {
      return { error: new Error('Password is required') };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) return { error };

    // If sign in returned a user, try to ensure role is available before returning
    const userId = data?.user?.id;
    if (!userId) return { error: null, role: null };

    // Poll for role up to ~4s
    let foundRole: AppRole | null = null;
    for (let i = 0; i < 8; i++) {
      try {
        const { data: roleData, error: roleErr } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (roleErr) {
          console.warn('Role fetch attempt error:', roleErr);
        }

        if (roleData?.role) {
          foundRole = roleData.role as AppRole;
          setRole(foundRole);
          // also fetch profile to populate context
          fetchUserData(userId);
          break;
        }
      } catch (e) {
        console.warn('Role fetch attempt exception', e);
      }

      // wait 500ms before retrying
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 500));
    }

    return { error: null, role: foundRole };
  };

  const signUp = async (email: string, password: string, fullName: string, roleOverride?: AppRole) => {
    // Validate input
    if (!email || !password || !fullName) {
      return { error: new Error('All fields are required') };
    }

    // Validate email
    if (!validateEmail(email)) {
      return { error: new Error('Invalid email format') };
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { error: new Error(passwordValidation.errors.join('. ')) };
    }

    // Validate full name
    if (fullName.trim().length < 2 || fullName.trim().length > 100) {
      return { error: new Error('Full name must be between 2 and 100 characters') };
    }

    // Determine role - only receptionist for self-registration, admin requires admin override
    let assignedRole: AppRole = 'receptionist';
    if (roleOverride === 'admin') {
      // If no admins exist, allow first admin registration (bootstrap)
      if (hasAdmins === true && !isAdmin) {
        return { error: new Error('Only admins can create admin accounts') };
      }
      assignedRole = 'admin';
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return { error };
    }

    // Wait for auth to be confirmed and then create profile + role
    if (data.user) {
      try {
        console.log('Creating profile for user:', data.user.id);
        // Create profile with a small delay to ensure auth user is available
        await new Promise(resolve => setTimeout(resolve, 500));

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            full_name: fullName.trim(),
            email: email.toLowerCase(),
          });

        if (profileError) {
          console.error('Profile error:', profileError);
          return { error: new Error('Error creating profile: ' + profileError.message) };
        }
        console.log('Profile created successfully for:', data.user.id);

        // Create user role
        console.log('Creating role for user:', data.user.id, 'with role:', assignedRole);
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: assignedRole,
          });

        if (roleError) {
          console.error('Role error:', roleError);
          return { error: new Error('Error assigning role: ' + roleError.message) };
        }
        console.log('Role assigned successfully:', assignedRole);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error during signup';
        console.error('Signup error:', errorMsg);
        return { error: new Error(errorMsg) };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  const registerAdmin = async (email: string, password: string, fullName: string) => {
    // Only allow current admin users to register new admins
    if (!isAdmin) {
      return { error: new Error('Only admins can register admin accounts') };
    }
    return signUp(email, password, fullName, 'admin');
  };

  const softDeleteReceptionist = async (userId: string) => {
    // Only admins can soft delete
    if (!isAdmin) {
      return { error: new Error('Only admins can delete accounts') };
    }

    const { error } = await supabase
      .from('user_roles')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
      })
      .eq('user_id', userId);

    return { error };
  };

  const validateRoleAccess = (requiredRole: AppRole): boolean => {
    return role === requiredRole;
  };

  const value = {
    user,
    session,
    profile,
    role,
    isLoading,
    hasAdmins,
    signIn,
    signUp,
    signOut,
    isAdmin: role === 'admin',
    registerAdmin,
    softDeleteReceptionist,
    validateRoleAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
