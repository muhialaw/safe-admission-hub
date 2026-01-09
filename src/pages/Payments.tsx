import { useState, useEffect } from 'react';
import { Loader2, Plus, Search, WifiOff } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { generateLocalId, isOnline } from '@/lib/offline-db';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<(Payment & { student: Student })[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addOfflinePayment, isOffline } = useOfflineSync();

  // Form state
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    method: 'manual',
    reference: '',
  });

  // Track selected student name for offline
  const [selectedStudentName, setSelectedStudentName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, studentsRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, student:students(*)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('students')
          .select('*')
          .eq('is_deleted', false)
          .order('name'),
      ]);

      if (paymentsRes.data) setPayments(paymentsRes.data as unknown as (Payment & { student: Student })[]);
      if (studentsRes.data) setStudents(studentsRes.data as Student[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    setFormData({ ...formData, studentId });
    setSelectedStudentName(student?.name || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);

    // If offline, save locally (note: STK push won't work offline)
    if (!isOnline()) {
      if (formData.method !== 'manual') {
        toast.error('M-Pesa and Bank payments require an internet connection');
        setIsSubmitting(false);
        return;
      }

      try {
        await addOfflinePayment({
          localId: generateLocalId(),
          studentId: formData.studentId,
          studentName: selectedStudentName,
          amount: parseFloat(formData.amount),
          method: formData.method as 'manual',
          reference: formData.reference || null,
        });

        toast.success('Payment saved offline. Will sync when online.');
        setIsDialogOpen(false);
        resetForm();
      } catch (error) {
        console.error('Error saving offline:', error);
        toast.error('Failed to save offline');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          student_id: formData.studentId,
          amount: parseFloat(formData.amount),
          method: formData.method,
          reference: formData.reference || null,
          entered_by: user.id,
          status: 'completed',
        });

      if (error) throw error;

      toast.success('Payment recorded successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      studentId: '',
      amount: '',
      method: 'manual',
      reference: '',
    });
    setSelectedStudentName('');
  };

  const filteredPayments = payments.filter(payment =>
    payment.student?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.student?.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">
              Record and track fee payments
              {isOffline && (
                <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                  <WifiOff className="h-3 w-3" />
                  Offline (Manual only)
                </span>
              )}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Record New Payment
                  {isOffline && (
                    <span className="ml-2 text-sm font-normal text-destructive">
                      (Offline - Manual Only)
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student">Student *</Label>
                  <Select
                    value={formData.studentId}
                    onValueChange={handleStudentSelect}
                    required
                  >
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.student_id} — {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (KES) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(value) => setFormData({ ...formData, method: value })}
                    disabled={isOffline}
                  >
                    <SelectTrigger className="border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa" disabled={isOffline}>M-Pesa</SelectItem>
                      <SelectItem value="bank" disabled={isOffline}>Bank Transfer</SelectItem>
                      <SelectItem value="manual">Cash/Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {isOffline && (
                    <p className="text-xs text-muted-foreground">
                      Only manual payments available offline
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference/Transaction ID</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="border-2"
                    placeholder="e.g., QXK2J4N8YP"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : isOffline ? (
                      'Save Offline'
                    ) : (
                      'Record Payment'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-2 pl-10"
          />
        </div>

        {/* Payments Table */}
        <div className="border-2 border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No payments found' : 'No payments recorded'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border bg-muted">
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Method
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm">
                        {format(new Date(payment.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{payment.student?.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {payment.student?.student_id}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3 uppercase text-sm">{payment.method}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {payment.reference || '—'}
                      </td>
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
      </div>
    </AppLayout>
  );
}
