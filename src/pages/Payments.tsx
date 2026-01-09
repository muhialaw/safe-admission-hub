import { useState, useEffect } from 'react';
import { Loader2, Plus, Search, WifiOff, Edit, History } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment, GradeTerm } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { generateLocalId, isOnline } from '@/lib/offline-db';
import { EditPaymentDialog } from '@/components/EditPaymentDialog';
import { logImportantEdit, getPaymentAuditLogs } from '@/lib/audit-logger';

export default function Payments() {
  const { user, isAdmin } = useAuth();
  const [payments, setPayments] = useState<(Payment & { student: Student })[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<{ id: string; name: string; fee_per_term: number }[]>([]);
  const [gradeTerms, setGradeTerms] = useState<GradeTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFetchLoading, setStudentFetchLoading] = useState(false);
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [editingPayment, setEditingPayment] = useState<(Payment & { student: Student }) | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, Record<string, unknown>[]>>({});
  const { addOfflinePayment, isOffline } = useOfflineSync();

  // Form state
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    method: 'cash',
    reference: '',
    admissionTerm: 'Term 1',
    admissionYear: new Date().getFullYear(),
  });

  // Track selected student name for offline
  const [selectedStudentName, setSelectedStudentName] = useState('');

  useEffect(() => {
    fetchData();
    fetchGrades();
    fetchGradeTerms();
  }, []);

  const fetchGrades = async () => {
    try {
      const { data } = await supabase.from('grades').select('id,name,fee_per_term').eq('active', true).order('name');
      if (data) setGrades(data as { id: string; name: string; fee_per_term: number }[]);
    } catch (err) {
      console.error('Error fetching grades', err);
    }
  };

  const fetchGradeTerms = async () => {
    try {
      const { data } = await supabase
        .from('grade_terms')
        .select('*')
        .eq('is_active', true)
        .eq('academic_year', new Date().getFullYear())
        .order('grade_id, term_order');
      if (data) setGradeTerms(data as unknown as GradeTerm[]);
    } catch (err) {
      console.error('Error fetching grade terms', err);
    }
  };

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

  // Debounced student search by id or name, or fetch by grade
  useEffect(() => {
    const term = studentSearch.trim();
    let cancelled = false;
    const gradeSelected = selectedGradeId && selectedGradeId !== 'ALL';
    if (!term && !gradeSelected) return;

    const timer = setTimeout(async () => {
      setStudentFetchLoading(true);
      try {
        // sanitize term: allow alnum, space, hyphen
        const sanitized = term.replace(/[^a-zA-Z0-9\-\s]/g, '');
        let query = supabase.from('students').select('*').eq('is_deleted', false).order('name');
        if (gradeSelected) {
          query = query.eq('grade_id', selectedGradeId);
        }
        if (sanitized) {
          // search by student_id or name
          query = query.or(`student_id.ilike.%${sanitized}% , name.ilike.%${sanitized}%`);
        }

        const { data, error } = await query.limit(50);
        if (error) throw error;
        if (!cancelled && data) setStudents(data as Student[]);
      } catch (err) {
        console.error('Student search error', err);
      } finally {
        if (!cancelled) setStudentFetchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentSearch, selectedGradeId]);

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    setFormData({ ...formData, studentId });
    setSelectedStudentName(student?.name || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);

    // Validate required fields
    if (!formData.studentId) {
      toast.error('Select a student');
      setIsSubmitting(false);
      return;
    }

    // Parse and validate amount (supports pasted/typed currency like KSh1,850.00)
    const numericAmount = parseFloat(String(formData.amount).replace(/[,\sKShksh$£€]/g, '').replace(/[^0-9.-]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Enter a valid amount greater than 0');
      setIsSubmitting(false);
      return;
    }

    // If mpesa or bank require reference
    if ((formData.method === 'mpesa' || formData.method === 'bank') && !formData.reference.trim()) {
      toast.error('Transaction ID/Reference is required for M-Pesa and Bank transfers');
      setIsSubmitting(false);
      return;
    }

    // If a reference is provided ensure uniqueness
    const sanitizedRef = formData.reference.trim().replace(/[^a-zA-Z0-9-]/g, '');
    if (sanitizedRef) {
      try {
        const { data: existing } = await supabase
          .from('payments')
          .select('id')
          .ilike('reference', sanitizedRef)
          .maybeSingle();

        if (existing) {
          toast.error('Transaction ID already exists. Use a unique reference.');
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        console.error('Reference uniqueness check failed', err);
      }
    }

    // If offline, save locally (note: STK push won't work offline)
    if (!isOnline()) {
      if (formData.method !== 'cash') {
        toast.error('M-Pesa and Bank payments require an internet connection');
        setIsSubmitting(false);
        return;
      }

      try {
        await addOfflinePayment({
          localId: generateLocalId(),
          studentId: formData.studentId,
          studentName: selectedStudentName,
          amount: numericAmount,
          method: formData.method as 'cash',
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
      const status = formData.method === 'cash' && !isAdmin ? 'pending' : 'completed';
      const sanitizedRef = formData.reference.trim().replace(/[^a-zA-Z0-9-]/g, '') || null;

      const { error } = await supabase
        .from('payments')
        .insert({
          student_id: formData.studentId,
          amount: numericAmount,
          method: formData.method,
          reference: sanitizedRef || null,
          entered_by: user.id,
          status,
          admission_term: formData.admissionTerm,
          admission_year: formData.admissionYear,
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
      method: 'cash',
      reference: '',
      admissionTerm: 'Term 1',
      admissionYear: new Date().getFullYear(),
    });
    setSelectedStudentName('');
  };

  const handleEditPayment = async (editData: {
    amount: number;
    method: string;
    reference: string | null;
    admission_term: string;
    admission_year: number;
    edit_reason: string;
  }) => {
    if (!editingPayment || !user) return;

    try {
      // Store old values for audit
      const beforeData = {
        amount: editingPayment.amount,
        method: editingPayment.method,
        reference: editingPayment.reference,
        admission_term: editingPayment.admission_term,
        admission_year: editingPayment.admission_year,
      };

      // Update payment
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          amount: editData.amount,
          method: editData.method,
          reference: editData.reference,
          admission_term: editData.admission_term,
          admission_year: editData.admission_year,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
          edit_reason: editData.edit_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPayment.id);

      if (updateError) throw updateError;

      // Log the edit as important
      await logImportantEdit(
        'PAYMENT_EDITED',
        'payments',
        editingPayment.id,
        beforeData,
        {
          amount: editData.amount,
          method: editData.method,
          reference: editData.reference,
          admission_term: editData.admission_term,
          admission_year: editData.admission_year,
        },
        user.id,
        editData.edit_reason
      );

      toast.success('Payment updated and change logged');
      setEditingPayment(null);
      fetchData();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Failed to update payment');
    }
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
                <DialogDescription>Enter payment details. M-Pesa/Bank require transaction ID.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Filter by Grade</Label>
                  <Select
                    value={selectedGradeId}
                    onValueChange={(value) => setSelectedGradeId(value)}
                  >
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="All grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All grades</SelectItem>
                      {grades.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label htmlFor="studentSearch">Search student (ID or name)</Label>
                  <Input
                    id="studentSearch"
                    placeholder="Type to search..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="border-2"
                  />

                  <Label htmlFor="student">Select Student *</Label>
                  <Select
                    value={formData.studentId}
                    onValueChange={handleStudentSelect}
                    required
                  >
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder={studentFetchLoading ? 'Searching...' : 'Select student'} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.student_id} — {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid gap-4 sm:grid-cols-2 mt-2">
                    <div className="space-y-2">
                      <Label htmlFor="admissionTerm">Term</Label>
                      <Select
                        value={formData.admissionTerm}
                        onValueChange={(value) => setFormData({ ...formData, admissionTerm: value })}
                      >
                        <SelectTrigger className="border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Term 1">Term 1</SelectItem>
                          <SelectItem value="Term 2">Term 2</SelectItem>
                          <SelectItem value="Term 3">Term 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admissionYear">Year</Label>
                      <Input
                        id="admissionYear"
                        type="number"
                        value={formData.admissionYear}
                        onChange={(e) => setFormData({ ...formData, admissionYear: parseInt(e.target.value || String(new Date().getFullYear())) })}
                        className="border-2"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (KES) *</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 1850"
                    value={formData.amount}
                    onChange={(e) => {
                      // allow digits and dot only, strip currency symbols and commas
                      const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
                      setFormData({ ...formData, amount: cleaned });
                    }}
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
                      <SelectItem value="cash">Cash/Other</SelectItem>
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
                      Term
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Fee/Term
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Total Paid
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Balance
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
                    {isAdmin && (
                      <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                        Actions
                      </th>
                    )}
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
                      <td className="px-4 py-3">{payment.admission_term || '—'}</td>
                      <td className="px-4 py-3">{payment.admission_year || '—'}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const fee = grades.find(g => g.id === payment.student?.grade_id)?.fee_per_term;
                          return fee ? formatCurrency(fee) : '—';
                        })()}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {(() => {
                          const total = payments
                            .filter(p => p.student?.id === payment.student?.id)
                            .reduce((s, p) => s + (p.amount || 0), 0);
                          return formatCurrency(total || 0);
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const fee = grades.find(g => g.id === payment.student?.grade_id)?.fee_per_term;
                          const total = payments
                            .filter(p => p.student?.id === payment.student?.id)
                            .reduce((s, p) => s + (p.amount || 0), 0);
                          if (fee == null) return '—';
                          const balance = fee - total;
                          return formatCurrency(balance);
                        })()}
                      </td>
                      <td className="px-4 py-3 uppercase text-sm">{payment.method}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {payment.reference || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                            payment.status === 'completed' 
                              ? 'bg-chart-2/10 text-chart-2' 
                              : payment.status === 'pending'
                              ? 'bg-chart-4/10 text-chart-4'
                              : 'bg-destructive/10 text-destructive'
                          }`}>
                            {payment.status}
                          </span>
                          {payment.status === 'pending' && isAdmin && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('payments')
                                    .update({ status: 'completed', edited_by: user.id, edited_at: new Date().toISOString() })
                                    .eq('id', payment.id);
                                  if (error) throw error;
                                  toast.success('Payment approved');
                                  fetchData();
                                } catch (err) {
                                  console.error('Approve error', err);
                                  toast.error('Failed to approve');
                                }
                              }}
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingPayment(payment)}
                              title="Edit this payment"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const logs = await getPaymentAuditLogs(payment.id);
                                  setAuditLogs({ ...auditLogs, [payment.id]: logs });
                                } catch (err) {
                                  toast.error('Failed to load history');
                                }
                              }}
                              title="View edit history"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <EditPaymentDialog
        payment={editingPayment}
        open={!!editingPayment}
        onOpenChange={(open) => !open && setEditingPayment(null)}
        onSave={handleEditPayment}
      />
    </AppLayout>
  );
}
