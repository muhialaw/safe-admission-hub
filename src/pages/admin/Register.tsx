import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { toast } from 'sonner';
import { validateEmail, validatePassword } from '@/lib/validation';

export default function AdminRegister() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { registerAdmin, isAdmin, hasAdmins, signUp } = useAuth();
  const navigate = useNavigate();

  // Check if user can register admin
  // Allow if: no admins exist (first admin bootstrap) OR user is already an admin
  const canRegisterAdmin = hasAdmins === false || isAdmin;

  // If loading hasn't finished checking for admins, show loading state
  if (hasAdmins === null) {
    return (
      <AuthLayout title="Admin Registration" subtitle="School Management System - Admin">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  // If admins exist and user is not an admin, deny access
  if (!canRegisterAdmin) {
    return (
      <AuthLayout title="Admin Registration" subtitle="School Management System - Admin">
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">
            <p className="font-semibold mb-2">Access Denied</p>
            <p className="text-sm mb-4">
              Only existing administrators can create new admin accounts.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/login">Back to Admin Login</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  const calculatePasswordStrength = (pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 25;
    if (/\d/.test(pwd)) strength += 25;
    return strength;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim() || formData.fullName.length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error || 'Invalid email';
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error || 'Password does not meet requirements';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setFormData({ ...formData, password: pwd });
    setPasswordStrength(calculatePasswordStrength(pwd));
    if (errors.password) setErrors({ ...errors, password: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // If this is the first admin (no admins exist), use signUp with admin role override
    // Otherwise use registerAdmin which checks isAdmin permission
    const { error } = hasAdmins === false
      ? await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          'admin'
        )
      : await registerAdmin(
          formData.email,
          formData.password,
          formData.fullName
        );

    if (error) {
      toast.error(error.message || 'Failed to create admin account');
      setIsLoading(false);
      return;
    }

    if (hasAdmins === false) {
      toast.success('First admin account created! Please sign in.');
    } else {
      toast.success('Admin account created! New admin can now sign in.');
    }
    navigate('/admin/login');
  };

  return (
    <AuthLayout title="Create New Admin Account" subtitle="School Management System - Admin Registration">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800 text-sm">
            {hasAdmins === false
              ? 'Creating the first admin account for the system.'
              : 'You are creating a new admin account. The new admin will be able to manage all system features.'}
          </AlertDescription>
        </Alert>

        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Admin Full Name *</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            value={formData.fullName}
            onChange={(e) => {
              setFormData({ ...formData, fullName: e.target.value });
              if (errors.fullName) setErrors({ ...errors, fullName: '' });
            }}
            className={`border-2 ${errors.fullName ? 'border-red-500' : ''}`}
          />
          {errors.fullName && (
            <p className="text-sm text-red-600">{errors.fullName}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@school.com"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            className={`border-2 ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.password}
              onChange={handlePasswordChange}
              className={`border-2 pr-10 ${errors.password ? 'border-red-500' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password}</p>
          )}

          {formData.password && (
            <div className="space-y-2">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    passwordStrength <= 25
                      ? 'bg-red-500 w-1/4'
                      : passwordStrength <= 50
                      ? 'bg-orange-500 w-1/2'
                      : passwordStrength <= 75
                      ? 'bg-yellow-500 w-3/4'
                      : 'bg-green-500 w-full'
                  }`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {passwordStrength <= 25
                  ? 'Weak password'
                  : passwordStrength <= 50
                  ? 'Fair password'
                  : passwordStrength <= 75
                  ? 'Good password'
                  : 'Strong password'}
              </p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value });
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              className={`border-2 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-600">{errors.confirmPassword}</p>
          )}

          {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 size={16} />
              Passwords match
            </div>
          )}
        </div>

        {/* Password Requirements */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-sm text-blue-800">
            <p className="font-semibold mb-2">Password requirements:</p>
            <ul className="space-y-1 text-xs">
              <li className={formData.password.length >= 8 ? 'text-green-600' : ''}>
                ✓ At least 8 characters
              </li>
              <li className={/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                ✓ Mix of uppercase and lowercase letters
              </li>
              <li className={/\d/.test(formData.password) ? 'text-green-600' : ''}>
                ✓ At least one number
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Admin Account'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/admin/login"
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Back to Admin Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
