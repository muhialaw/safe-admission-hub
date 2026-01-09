import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  CreditCard, 
  Settings, 
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { OfflineIndicator } from '@/components/OfflineIndicator';

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Admissions', href: '/admissions', icon: UserPlus },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Pending Sync', href: '/pending-sync', icon: Clock },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: ShieldCheck },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allNavigation = isAdmin ? [...navigation, ...adminNavigation] : navigation;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-foreground/20 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-full sm:w-64 transform border-r-2 border-border bg-card transition-transform duration-200 sm:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b-2 border-border px-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/royal-brook-logo.jpg" alt="Royal Brook" className="h-8 w-8 rounded object-cover" />
              <span className="text-xl font-bold tracking-tight">Royal Brook Kindergarten</span>
            </Link>
            <button
              className="sm:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {allNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all border-2",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-transparent hover:bg-accent hover:border-border"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t-2 border-border p-4">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {role}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="sm:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b-2 border-border bg-card px-4 sm:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/royal-brook-logo.jpg" alt="Royal Brook" className="h-6 w-6 rounded object-cover" />
            <span className="text-lg font-bold">Royal Brook Kindergarten</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}
