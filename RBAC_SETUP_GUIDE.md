# Role-Based Access Control Implementation - Setup Guide

## Overview
This document outlines the role-based access control (RBAC) system implemented for the Royal Brook Kindergarten school management system. The system supports two roles: **Admin** and **Receptionist**, each with their own registration and login flows.

## Database Schema
The system uses the following tables from Supabase:
- **auth.users**: Supabase auth table
- **profiles**: User profile information (full_name, email)
- **user_roles**: Role assignment (admin, receptionist)

See `/supabase/migrations/20260109055410_*.sql` for complete RLS policies.

## Project Structure

### Pages Structure (Refactored)
```
src/pages/
├── admin/
│   ├── Login.tsx        # Admin login page
│   └── Register.tsx     # Admin registration page
├── receptionist/
│   ├── Login.tsx        # Receptionist login page
│   └── Register.tsx     # Receptionist registration page
├── Welcome.tsx          # Role selection landing page
├── Dashboard.tsx
├── Admissions.tsx
├── Students.tsx
├── Payments.tsx
├── Settings.tsx
├── Admin.tsx
└── NotFound.tsx
```

### New Components
- **`src/components/auth/AuthLayout.tsx`**: Shared authentication UI layout
- **`src/components/RoleProtectedRoute.tsx`**: Role-based route protection

### Utility Functions
- **`src/lib/validation.ts`**: Email, password, and name validation
- **`src/lib/error-logger.ts`**: Error logging utilities

## Authentication Flow

### Registration Flow
1. User selects role (Admin or Receptionist)
2. Navigates to role-specific register page
3. Fills form with full name, email, password
4. System creates:
   - Auth user (Supabase Auth)
   - Profile record
   - User role assignment
5. Redirects to role-specific login page

### Login Flow
1. User selects role (Admin or Receptionist)
2. Enters email and password
3. AuthContext calls `signIn()`
4. Fetches user role and profile
5. Redirects to dashboard if authenticated

## Routes

### Public Routes (No Authentication Required)
- `GET /welcome` - Role selection page
- `GET /admin/login` - Admin login
- `GET /admin/register` - Admin registration
- `GET /receptionist/login` - Receptionist login
- `GET /receptionist/register` - Receptionist registration

### Protected Routes (Authentication Required)
- `GET /` - Dashboard (requires auth)
- `GET /admissions` - Admissions (requires auth)
- `GET /students` - Students (requires auth)
- `GET /payments` - Payments (requires auth)
- `GET /settings` - Settings (requires auth)
- `GET /admin` - Admin panel (requires auth)

## Using the System

### For Admins
1. Go to `/admin/register`
2. Create account with admin@school.com (or preferred email)
3. Password must: 8+ chars, uppercase + lowercase, contain number
4. Go to `/admin/login` and sign in
5. System assigns role as "admin"

### For Receptionists
1. Go to `/receptionist/register`
2. Create account with receptionist@school.com (or preferred email)
3. Password must: 8+ chars, uppercase + lowercase, contain number
4. Go to `/receptionist/login` and sign in
5. System assigns role as "receptionist"

## AuthContext (Updated)

### Key Methods
```typescript
interface AuthContextType {
  user: User | null;              // Supabase User object
  session: Session | null;        // Auth session
  profile: Profile | null;        // User profile from DB
  role: AppRole | null;           // 'admin' | 'receptionist'
  isLoading: boolean;
  isAdmin: boolean;               // Computed: role === 'admin'
  
  // Methods
  signIn(email, password)         // Login
  signUp(email, password, fullName, roleOverride?) // Register
  signOut()                       // Logout
  registerAdmin(email, password, fullName) // Register admin (admin only)
  softDeleteReceptionist(userId)  // Soft delete receptionist (admin only)
}
```

### Role Assignment During Signup
The `signUp()` method accepts an optional `roleOverride` parameter:
- Defaults to 'receptionist' if not provided
- Admin pages pass 'admin' as roleOverride
- Receptionist pages pass 'receptionist' as roleOverride

## Password Requirements
- Minimum 8 characters
- Must contain uppercase and lowercase letters
- Must contain at least one number
- Visual strength indicator provided during registration

## Row-Level Security (RLS)
The Supabase migration includes RLS policies:
- Users can view their own profile and roles
- Admins can view all profiles and manage roles
- All authenticated users can view grades
- Specific policies for students, guardians, payments

## Testing Checklist

### Admin Registration
- [ ] Navigate to `/admin/register`
- [ ] Fill form with valid data
- [ ] Verify password strength indicator
- [ ] Submit form
- [ ] Verify email entered in Supabase auth
- [ ] Check profiles table has new record
- [ ] Check user_roles table has 'admin' role assigned
- [ ] Verify redirect to `/admin/login`

### Admin Login
- [ ] Go to `/admin/login`
- [ ] Enter registered admin email and password
- [ ] Verify successful login
- [ ] Check AuthContext has role = 'admin'
- [ ] Verify redirect to dashboard

### Receptionist Registration
- [ ] Navigate to `/receptionist/register`
- [ ] Fill form with valid data
- [ ] Submit form
- [ ] Verify email entered in Supabase auth
- [ ] Check user_roles table has 'receptionist' role
- [ ] Verify redirect to `/receptionist/login`

### Receptionist Login
- [ ] Go to `/receptionist/login`
- [ ] Enter registered receptionist email and password
- [ ] Verify successful login
- [ ] Check AuthContext has role = 'receptionist'
- [ ] Verify redirect to dashboard

### Error Handling
- [ ] Invalid email format shows error
- [ ] Weak password shows error
- [ ] Mismatched passwords show error
- [ ] Wrong login credentials show error
- [ ] Already registered email shows error

## Remaining Tasks

1. **Page-specific access control** - Some pages may need role-specific access restrictions using RoleProtectedRoute
2. **Admin management interface** - Create page for admins to manage other users
3. **Dashboard customization** - Different dashboards for admin vs receptionist
4. **Audit logging** - Log actions using audit_logs table (schema exists)
5. **Email verification** - Add email verification flow if needed
6. **Password reset** - Implement password reset functionality

## Dependencies
- React Router DOM - Routing
- Supabase JS Client - Backend/Auth
- Lucide React - Icons
- Shadcn UI - UI Components
- Sonner - Toast notifications
- TailwindCSS - Styling

## Security Notes
- Never expose VITE_SUPABASE_SERVICE_ROLE_KEY in client code
- RLS policies enforce access control at database level
- Passwords are hashed by Supabase Auth
- Session tokens are managed by Supabase
- CSRF protection built into Supabase
