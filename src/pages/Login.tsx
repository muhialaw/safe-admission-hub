import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    toast.success('Welcome back!');
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border-2 border-border bg-primary">
            <GraduationCap className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SHULE POS</h1>
          <p className="mt-2 text-muted-foreground">
            School Management System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 border-2 border-border bg-card p-8 shadow-md">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.com"
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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium underline underline-offset-4 hover:text-foreground">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
