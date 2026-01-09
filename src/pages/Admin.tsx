import { useState, useEffect } from 'react';
import { Loader2, Users, FileText, CreditCard, GraduationCap, Shield, Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Grade, Profile, UserRole, AuditLog, Payment, Student } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';
import { GradeTermsManager } from '@/components/GradeTermsManager';
import { cachedDataService } from '@/lib/cached-data-service';

export default function Admin() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  
  // Users state
  const [users, setUsers] = useState<(Profile & { role?: UserRole })[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  // Grades state
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [gradeForm, setGradeForm] = useState({ name: '', capacity: '40' });
  const [selectedGradeForTerms, setSelectedGradeForTerms] = useState<Grade | null>(null);
  const [isTermFeesDialogOpen, setIsTermFeesDialogOpen] = useState(false);
  
  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  
  // Payments state
  const [payments, setPayments] = useState<(Payment & { student: Student })[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchGrades();
      fetchAuditLogs();
      fetchPayments();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: roles } = await supabase
        .from('user_roles')
        .select('*');

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        role: roles?.find(r => r.user_id === profile.user_id),
      }));

      setUsers(usersWithRoles as (Profile & { role?: UserRole })[]);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchGrades = async () => {
    try {
      const gradesData = await cachedDataService.getGrades();
      setGrades(gradesData);
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setIsLoadingGrades(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setAuditLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const { data } = await supabase
        .from('payments')
        .select('*, student:students(*)')
        .order('created_at', { ascending: false });
      setPayments((data as unknown as (Payment & { student: Student })[]) || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'receptionist') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleSaveGrade = async () => {
    setIsSaving(true);
    try {
      if (editingGrade) {
        const { error } = await supabase
          .from('grades')
          .update({
            name: gradeForm.name,
            capacity: parseInt(gradeForm.capacity),
          })
          .eq('id', editingGrade.id);

        if (error) throw error;
        toast.success('Grade updated successfully');
      } else {
        const { error } = await supabase
          .from('grades')
          .insert({
            name: gradeForm.name,
            capacity: parseInt(gradeForm.capacity),
          });

        if (error) throw error;
        toast.success('Grade created successfully');
      }

      setIsGradeDialogOpen(false);
      setEditingGrade(null);
      setGradeForm({ name: '', capacity: '40' });
      fetchGrades();
    } catch (error) {
      console.error('Error saving grade:', error);
      toast.error('Failed to save grade');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    try {
      const { error } = await supabase
        .from('grades')
        .update({ active: false })
        .eq('id', gradeId);

      if (error) throw error;
      toast.success('Grade deactivated');
      fetchGrades();
    } catch (error) {
      console.error('Error deleting grade:', error);
      toast.error('Failed to delete grade');
    }
  };

  const openEditGrade = (grade: Grade) => {
    setEditingGrade(grade);
    setGradeForm({
      name: grade.name,
      capacity: grade.capacity.toString(),
    });
    setIsGradeDialogOpen(true);
  };

  const openNewGrade = () => {
    setEditingGrade(null);
    setGradeForm({ name: '', capacity: '40' });
    setIsGradeDialogOpen(true);
  };

  const openTermFeesDialog = (grade: Grade) => {
    setSelectedGradeForTerms(grade);
    setIsTermFeesDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users, grades, fees, and view system logs</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 border-2 border-border">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="grades" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Grades</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <h2 className="text-xl font-bold">User Management</h2>
            <div className="border-2 border-border bg-card">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted">
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Joined</th>
                        <th className="px-4 py-3 text-right text-sm font-medium uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-medium">{user.full_name}</td>
                          <td className="px-4 py-3 text-sm">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                              user.role?.role === 'admin'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}>
                              {user.role?.role || 'No role'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {format(new Date(user.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Select
                              value={user.role?.role || 'receptionist'}
                              onValueChange={(value) => handleRoleChange(user.user_id, value as 'admin' | 'receptionist')}
                            >
                              <SelectTrigger className="w-32 border-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="receptionist">Receptionist</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Grades Tab */}
          <TabsContent value="grades" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Grades & Fee Structure</h2>
              <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewGrade}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Grade
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingGrade ? 'Edit Grade' : 'New Grade'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="gradeName">Grade Name</Label>
                      <Input
                        id="gradeName"
                        value={gradeForm.name}
                        onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                        placeholder="e.g., Grade 1"
                        className="border-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min="1"
                        value={gradeForm.capacity}
                        onChange={(e) => setGradeForm({ ...gradeForm, capacity: e.target.value })}
                        className="border-2"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsGradeDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveGrade} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {editingGrade ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="border-2 border-border bg-card">
              {isLoadingGrades ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted">
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Grade</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Capacity</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((grade) => (
                        <tr key={grade.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-medium">{grade.name}</td>
                          <td className="px-4 py-3">{grade.capacity} students</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                              grade.active 
                                ? 'bg-chart-2/10 text-chart-2' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {grade.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTermFeesDialog(grade)}
                                title="Manage fees for different terms"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditGrade(grade)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deactivate Grade?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will hide the grade from selection. It can be reactivated later.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteGrade(grade.id)}>
                                      Deactivate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Term Fees Dialog */}
          <Dialog open={isTermFeesDialogOpen} onOpenChange={setIsTermFeesDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Manage Term Fees - {selectedGradeForTerms?.name}
                </DialogTitle>
              </DialogHeader>
              {selectedGradeForTerms && (
                <GradeTermsManager 
                  gradeId={selectedGradeForTerms.id}
                  gradeName={selectedGradeForTerms.name}
                  academicYear={new Date().getFullYear()}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <h2 className="text-xl font-bold">All Payments</h2>
            <div className="border-2 border-border bg-card">
              {isLoadingPayments ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No payments recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted">
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Reference</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{payment.student?.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {payment.student?.student_id}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 uppercase text-sm">{payment.method}</td>
                          <td className="px-4 py-3 font-mono text-sm">{payment.reference || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                              payment.status === 'completed' 
                                ? 'bg-chart-2/10 text-chart-2' 
                                : payment.status === 'pending'
                                ? 'bg-chart-4/10 text-chart-4'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <h2 className="text-xl font-bold">Audit Logs</h2>
            <div className="border-2 border-border bg-card">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No logs available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted">
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Table</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Record ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium uppercase">Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                              log.action === 'INSERT' 
                                ? 'bg-chart-2/10 text-chart-2'
                                : log.action === 'UPDATE'
                                ? 'bg-chart-4/10 text-chart-4'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm">{log.table_name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{log.record_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-3 max-w-xs">
                            <details className="cursor-pointer">
                              <summary className="text-sm text-muted-foreground hover:text-foreground">
                                View details
                              </summary>
                              <pre className="mt-2 text-xs bg-muted p-2 overflow-auto max-h-40">
                                {JSON.stringify(log.after_data || log.before_data, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
