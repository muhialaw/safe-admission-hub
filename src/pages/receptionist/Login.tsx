import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { toast } from 'sonner';

export default function ReceptionistLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, role } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

      const { error, role: signedRole } = await signIn(email, password);

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

      if (signedRole === 'receptionist') {
        toast.success('Welcome back!');
        navigate('/');
      } else if (signedRole === 'admin') {
        toast.error('This account is an Admin account. Please use the Admin login.');
        setIsLoading(false);
      } else {
        toast.error('Unable to verify your role. Please try again.');
        setIsLoading(false);
      }
  };

  return (
    <AuthLayout title="Receptionist Login" subtitle="School Management System - Receptionist">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="receptionist@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-2"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In as Receptionist'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link
            to="/receptionist/register"
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Register as Receptionist
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
