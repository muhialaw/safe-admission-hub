import { useEffect, useState } from 'react';
import { Users, UserPlus, CreditCard, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalStudents: number;
  newAdmissions: number;
  totalPayments: number;
  pendingPayments: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    newAdmissions: 0,
    totalPayments: 0,
    pendingPayments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch total students
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);

      // Fetch new admissions this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: newAdmissions } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .gte('created_at', startOfMonth.toISOString());

      // Fetch total completed payments this month
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString());

      const totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Fetch pending payments count
      const { count: pendingPayments } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalStudents: totalStudents || 0,
        newAdmissions: newAdmissions || 0,
        totalPayments,
        pendingPayments: pendingPayments || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back, {profile?.full_name}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={isLoading ? '—' : stats.totalStudents}
            icon={<Users className="h-6 w-6" />}
            description="Active enrollments"
          />
          <StatCard
            title="New Admissions"
            value={isLoading ? '—' : stats.newAdmissions}
            icon={<UserPlus className="h-6 w-6" />}
            description="This month"
          />
          <StatCard
            title="Payments Received"
            value={isLoading ? '—' : formatCurrency(stats.totalPayments)}
            icon={<TrendingUp className="h-6 w-6" />}
            description="This month"
          />
          <StatCard
            title="Pending Payments"
            value={isLoading ? '—' : stats.pendingPayments}
            icon={<CreditCard className="h-6 w-6" />}
            description="Awaiting confirmation"
          />
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/admissions"
              className="flex items-center gap-4 border-2 border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center border-2 border-border bg-primary">
                <UserPlus className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">New Admission</p>
                <p className="text-sm text-muted-foreground">Register a student</p>
              </div>
            </a>
            <a
              href="/payments"
              className="flex items-center gap-4 border-2 border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center border-2 border-border bg-primary">
                <CreditCard className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">Record Payment</p>
                <p className="text-sm text-muted-foreground">Enter fee payment</p>
              </div>
            </a>
            <a
              href="/students"
              className="flex items-center gap-4 border-2 border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center border-2 border-border bg-primary">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">View Students</p>
                <p className="text-sm text-muted-foreground">Browse all records</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
