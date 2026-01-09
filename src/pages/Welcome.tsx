import { Link } from 'react-router-dom';
import { Shield, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Welcome() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center border-2 border-border bg-primary rounded-lg overflow-hidden">
            <img src="/royal-brook-logo.jpg" alt="Royal Brook Kindergarten" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Royal Brook Kindergarten</h1>
          <p className="text-xl text-muted-foreground">
            School Management System
          </p>
        </div>

        {/* Role Selection */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Admin */}
          <div className="flex flex-col space-y-6 border-2 border-border rounded-lg p-8 bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-3">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold">Administrator</h2>
            </div>
            <p className="text-muted-foreground">
              System administrators manage users, grades, and overall school operations.
            </p>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Features:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Manage all users and roles</li>
                <li>✓ Create and manage grades</li>
                <li>✓ View system analytics</li>
                <li>✓ System configuration</li>
              </ul>
            </div>
            <div className="pt-4 space-y-2">
              <Button asChild className="w-full" variant="default">
                <Link to="/admin/login">Admin Sign In</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link to="/admin/register">Create Admin Account</Link>
              </Button>
            </div>
          </div>

          {/* Receptionist */}
          <div className="flex flex-col space-y-6 border-2 border-border rounded-lg p-8 bg-card hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-3">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Receptionist</h2>
            </div>
            <p className="text-muted-foreground">
              Receptionists manage student admissions and process payments.
            </p>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Features:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Register new students</li>
                <li>✓ Process payments</li>
                <li>✓ View student records</li>
                <li>✓ Generate admission reports</li>
              </ul>
            </div>
            <div className="pt-4 space-y-2">
              <Button asChild className="w-full" variant="default">
                <Link to="/receptionist/login">Receptionist Sign In</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link to="/receptionist/register">Create Receptionist Account</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>© 2026 School Management System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
