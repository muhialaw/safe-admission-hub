# Role-Based Authentication Testing Guide

## What Was Fixed

### 1. Role Assignment During Registration
- When a user registers on `/admin/register`, the system now assigns the `admin` role
- When a user registers on `/receptionist/register`, the system assigns the `receptionist` role
- Role assignment happens in the `user_roles` table in Supabase
- Errors during role assignment are now properly caught and reported

### 2. Role Validation During Login
- After login, the system checks if the user's role matches the login page
- **Admin Login** (`/admin/login`): Only allows users with `admin` role
- **Receptionist Login** (`/receptionist/login`): Only allows users with `receptionist` role
- If wrong role is detected, user is rejected with error message

### 3. AuthContext Updates
- Added `validateRoleAccess(requiredRole)` method
- Improved error handling in `signUp()` function
- Added role validation parameter to context

## Step-by-Step Testing

### Test 1: Admin Registration & Login

1. **Register as Admin**
   - Navigate to `http://localhost:5173/admin/register`
   - Fill in:
     - Full Name: `John Admin`
     - Email: `admin@school.com`
     - Password: `AdminPass123`
     - Confirm Password: `AdminPass123`
   - Click "Create Admin Account"
   - Should see: "Admin account created! Please sign in."

2. **Verify in Supabase**
   - Go to Supabase Dashboard
   - Check `auth.users` table: Email should exist
   - Check `profiles` table: `admin@school.com` should have full_name "John Admin"
   - Check `user_roles` table: User should have role = `admin`

3. **Login as Admin**
   - Navigate to `http://localhost:5173/admin/login`
   - Enter: `admin@school.com` / `AdminPass123`
   - Should see: "Welcome back, Admin!"
   - Should redirect to dashboard

### Test 2: Receptionist Registration & Login

1. **Register as Receptionist**
   - Navigate to `http://localhost:5173/receptionist/register`
   - Fill in:
     - Full Name: `Jane Receptionist`
     - Email: `receptionist@school.com`
     - Password: `RecPass123`
     - Confirm Password: `RecPass123`
   - Click "Create Receptionist Account"
   - Should see: "Receptionist account created! Please sign in."

2. **Verify in Supabase**
   - Check `auth.users` table: Email should exist
   - Check `profiles` table: `receptionist@school.com` should have full_name "Jane Receptionist"
   - Check `user_roles` table: User should have role = `receptionist`

3. **Login as Receptionist**
   - Navigate to `http://localhost:5173/receptionist/login`
   - Enter: `receptionist@school.com` / `RecPass123`
   - Should see: "Welcome back, Receptionist!"
   - Should redirect to dashboard

### Test 3: Wrong Role Access (Critical Test)

This is the key test to verify role enforcement works:

1. **Try Admin Login with Receptionist Account**
   - Register a receptionist account first (if not done)
   - Go to `http://localhost:5173/admin/login`
   - Enter receptionist credentials: `receptionist@school.com` / `RecPass123`
   - Click "Sign In as Admin"
   - **EXPECTED**: Should see error: "This account is a Receptionist account. Please use the Receptionist login."

2. **Try Receptionist Login with Admin Account**
   - Register an admin account first (if not done)
   - Go to `http://localhost:5173/receptionist/login`
   - Enter admin credentials: `admin@school.com` / `AdminPass123`
   - Click "Sign In as Receptionist"
   - **EXPECTED**: Should see error: "This account is an Admin account. Please use the Admin login."

### Test 4: Invalid Credentials

1. **Wrong Password**
   - Go to any login page
   - Enter valid email but wrong password
   - Should see: "Invalid login credentials" or similar error

2. **Non-existent Email**
   - Enter email that wasn't registered
   - Should see: "Invalid login credentials"

### Test 5: Password Validation

During registration, password must:
- [ ] Be at least 8 characters
- [ ] Contain uppercase letter (A-Z)
- [ ] Contain lowercase letter (a-z)
- [ ] Contain a number (0-9)

Try registering with weak passwords:
- `password` (no number) - should show error
- `Pass123` (7 characters) - should show error
- `password123` (no uppercase) - should show error

### Test 6: Session Persistence

1. **Register and login**
2. **Refresh the page** (F5)
3. Should still be logged in with correct role
4. **Close browser tab and reopen**
5. Should still be logged in (localStorage persists session)

## Debugging Tips

### Check the Browser Console
- Look for any JavaScript errors
- Check Network tab to see Supabase API calls
- Look at Application > Local Storage for auth session

### Check Supabase Logs
1. Go to Supabase Dashboard
2. Click "Logs" in sidebar
3. Filter by recent API calls
4. Look for INSERT errors on `user_roles` table

### Common Issues

**Issue: User can login to wrong role page**
- Cause: Role wasn't assigned properly during signup
- Fix: Check `user_roles` table in Supabase - should have entry with correct role

**Issue: Login succeeds but no redirect**
- Cause: Role fetch is taking too long
- Fix: Wait 2-3 seconds for role to load, then check Network tab

**Issue: "User not authenticated" after successful signup**
- Cause: Profile or role creation failed
- Fix: Check profiles and user_roles tables in Supabase for missing entries

## Database Queries

### View all users and their roles
```sql
SELECT 
  au.id,
  au.email,
  p.full_name,
  ur.role,
  au.created_at
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.user_id
LEFT JOIN user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at DESC;
```

### Check if role was assigned
```sql
SELECT user_id, role FROM user_roles 
WHERE user_id = 'YOUR_USER_ID';
```

### Delete test users (if needed)
```sql
DELETE FROM auth.users 
WHERE email = 'test@example.com';
-- Profiles and roles will cascade delete
```

## What Happens Under the Hood

### Registration Flow:
1. User fills form with role-specific page (admin or receptionist)
2. Client calls `signUp(email, password, fullName, roleOverride)`
3. `roleOverride` is set to the role from the page
4. Supabase Auth creates user in `auth.users`
5. Trigger or client inserts into `profiles` table
6. Trigger or client inserts into `user_roles` table with specified role
7. User redirected to role-specific login page

### Login Flow:
1. User enters credentials on role-specific page
2. Client calls `signIn(email, password)`
3. Supabase Auth verifies credentials
4. Session is created (stored in localStorage)
5. `AuthContext` fetches user's profile and role from database
6. Check if user's role matches the login page role
7. If match: redirect to dashboard
8. If mismatch: show error and stay on login page

## How to Verify It's Working

The system is working correctly when:
1. ✅ Admin can only login on `/admin/login` with admin account
2. ✅ Receptionist can only login on `/receptionist/login` with receptionist account
3. ✅ Trying wrong role shows specific error message
4. ✅ `user_roles` table has correct role assigned
5. ✅ AuthContext has correct role value after login
6. ✅ Logging out clears the role

## Next Steps

Once role enforcement is confirmed working:
1. Update Dashboard to show different content per role
2. Add role checks to protected pages (use `RoleProtectedRoute`)
3. Implement role-specific features and permissions
4. Add audit logging for user actions
