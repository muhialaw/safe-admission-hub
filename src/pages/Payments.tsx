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
import { StudentDetailsModal } from '@/components/StudentDetailsModal';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { generateLocalId, isOnline } from '@/lib/offline-db';
import { EditPaymentDialog } from '@/components/EditPaymentDialog';
import { logImportantEdit, getPaymentAuditLogs } from '@/lib/audit-logger';
import { cachedDataService } from '@/lib/cached-data-service';

// helper: parse numeric order from term like "Term 2"
function parseTermOrder(term: string | undefined) {
  if (!term) return 0;
  const m = String(term).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

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
    gradeId: '',
  });

  // Track selected student name for offline
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [manualGradeInput, setManualGradeInput] = useState('');

  // M-Pesa STK state
  const [mpesaStkPhone, setMpesaStkPhone] = useState('');
  const [mpesaStkLoading, setMpesaStkLoading] = useState(false);

  // Payment list search and pagination
  const [searchStudent, setSearchStudent] = useState('');
  const [searchAmount, setSearchAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentDetailModal, setPaymentDetailModal] = useState<(Payment & { student: Student }) | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
    fetchGrades();
    fetchGradeTerms();
  }, []);

  const fetchGrades = async () => {
    try {
      const grades = await cachedDataService.getGrades();
      setGrades(grades as unknown as { id: string; name: string; fee_per_term: number }[]);
    } catch (err) {
      console.error('Error fetching grades:', err);
      toast.error('Could not load grades', {
        description: 'Make sure you have loaded this page online at least once.',
      });
    }
  };

  const fetchGradeTerms = async () => {
    try {
      const terms = await cachedDataService.getGradeTerms();
      setGradeTerms(terms);
    } catch (err) {
      console.error('Error fetching grade terms:', err);
      toast.error('Could not load grade terms', {
        description: 'Make sure you have loaded this page online at least once.',
      });
    }
  };

  const fetchData = async () => {
    try {
      const [paymentsRes, cachedStudents] = await Promise.all([
        supabase
          .from('payments')
          .select('*, student:students(*)')
          .order('created_at', { ascending: false })
          .limit(100),
        cachedDataService.getStudents(),
      ]);

      if (paymentsRes.data) setPayments(paymentsRes.data as unknown as (Payment & { student: Student })[]);
      setStudents(cachedStudents);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (!navigator.onLine) {
        toast.error('Offline mode', {
          description: 'Some data may not be available. Student list is cached for offline use.',
        });
      }
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

  // student modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);

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

    // M-Pesa STK is not yet available in v1
    if (formData.method === 'mpesa_stk') {
      toast.info('This payment method will be available upon system v2 implementation');
      setIsSubmitting(false);
      return;
    }

    // If mpesa or bank require reference
    if ((formData.method === 'mpesa' || formData.method === 'bank') && !formData.reference.trim()) {
      toast.error('Transaction ID/Reference is required for Mobile Money and Bank transfers');
      setIsSubmitting(false);
      return;
    }

    // If offline, save locally without complex validation (note: STK push won't work offline)
    if (!isOnline()) {
      if (formData.method !== 'cash') {
        toast.error('Mobile Money, M-Pesa STK, and Bank payments require an internet connection');
        setIsSubmitting(false);
        return;
      }

      try {
        await addOfflinePayment({
          localId: generateLocalId(),
          studentId: formData.studentId,
          studentName: selectedStudentName,
          amount: numericAmount,
          method: formData.method as 'cash' | 'mobile' | 'bank',
          reference: formData.reference || null,
          term: formData.admissionTerm,
          year: formData.admissionYear,
        });

        toast.success('Payment saved offline. Will sync and validate when online.');
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

    // Online validation: check reference uniqueness and student/term prerequisites
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

    // Validate previous terms and admission (online only)
    try {
      const student = students.find(s => s.id === formData.studentId);
      if (!student) {
        toast.error('Selected student not found');
        setIsSubmitting(false);
        return;
      }

      // Ensure not paying for terms before admission
      const studentAdmissionOrder = parseTermOrder(student.admission_term || 'Term 1');
      const targetOrder = parseTermOrder(formData.admissionTerm);
      if (formData.admissionYear < (student.admission_year || 0)) {
        toast.error('Cannot record payment for a year before the student was admitted');
        setIsSubmitting(false);
        return;
      }

      if (targetOrder < studentAdmissionOrder && formData.admissionYear === student.admission_year) {
        toast.error('Cannot record payment for a term before the student was admitted');
        setIsSubmitting(false);
        return;
      }

      // If paying for a later term, ensure all intervening terms (from admission term) are fully paid
      if (targetOrder > studentAdmissionOrder && formData.admissionYear === student.admission_year) {
        const missingTerms: string[] = [];

        for (let t = studentAdmissionOrder; t < targetOrder; t++) {
          const termName = `Term ${t}`;

          // determine fee for this term: prefer grade_terms, fallback to grade.fee_per_term
          const gradeTerm = gradeTerms.find(gt => gt.grade_id === student.grade_id && gt.term_name === termName && gt.academic_year === formData.admissionYear);
          const fee = gradeTerm ? Number(gradeTerm.fee_amount) : grades.find(g => g.id === student.grade_id)?.fee_per_term;

          if (fee == null) {
            toast.error(`Fee configuration missing for ${termName}. Configure grade terms or fee_per_term first`);
            setIsSubmitting(false);
            return;
          }

          const totalPaidForTerm = payments
            .filter(p => p.student?.id === student.id && p.admission_term === termName && p.admission_year === formData.admissionYear)
            .reduce((s, p) => s + (p.amount || 0), 0);

          if (totalPaidForTerm < fee) missingTerms.push(termName);
        }

        if (missingTerms.length > 0) {
          toast.error(`Previous term(s) not fully paid: ${missingTerms.join(', ')}`);
          setIsSubmitting(false);
          return;
        }
      }
    } catch (err) {
      console.error('Term validation error', err);
      toast.error('Failed to validate term/payment prerequisites');
      setIsSubmitting(false);
      return;
    }

    try {
      // Non-admin payments must remain pending for review; admins auto-complete
      const status = isAdmin ? 'completed' : 'pending';
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
      gradeId: '',
    });
    setSelectedStudentName('');
    setManualGradeInput('');
    setMpesaStkPhone('');
  };

  const handleMpesaStkSend = async () => {
    // Validate phone number
    if (!mpesaStkPhone.trim()) {
      toast.error('Enter a phone number');
      return;
    }

    setMpesaStkLoading(true);
    // Simulate STK push loading
    setTimeout(() => {
      setMpesaStkLoading(false);
      toast.info('This payment method will be available upon system v2 implementation');
      setMpesaStkPhone('');
    }, 2000);
  };

  // Filter payments by search criteria
  const filteredPayments = payments.filter(p => {
    const matchStudent = !searchStudent || 
      p.student?.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      p.student?.student_id.toLowerCase().includes(searchStudent.toLowerCase());
    
    const matchAmount = !searchAmount || 
      p.amount.toString().includes(searchAmount);
    
    const matchTerm = searchTerm === 'all' || !searchTerm || 
      p.admission_term?.includes(searchTerm);
    
    return matchStudent && matchAmount && matchTerm;
  });

  // Paginate filtered results
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

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

  const openStudentModal = (student: Student) => {
    setModalStudent(student);
    setStudentModalOpen(true);
  };

  const handleCreatePaymentForTerm = (termName: string, year: number) => {
    if (!modalStudent) return;
    // prefill the payment dialog and open it
    setFormData({
      ...formData,
      studentId: modalStudent.id,
      admissionTerm: termName,
      admissionYear: year,
    });
    setSelectedStudentName(modalStudent.name);
    setStudentModalOpen(false);
    setIsDialogOpen(true);
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
            <DialogContent className="max-h-[calc(100vh-4rem)] overflow-hidden">
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
              <div className="overflow-auto max-h-[calc(100vh-12rem)] p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  {isOffline ? (
                    <>
                      <Label htmlFor="studentManual">Student ID or Name *</Label>
                      <Input
                        id="studentManual"
                        placeholder="e.g., 2026/Grade 1/0001 or John Doe"
                        value={selectedStudentName || formData.studentId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedStudentName(val);
                          setFormData({ ...formData, studentId: val });
                        }}
                        className="border-2"
                        required
                      />
                      <p className="text-xs text-muted-foreground">Enter student ID or name. Will be verified when online.</p>

                      <Label htmlFor="gradeOffline" className="mt-4">Grade *</Label>
                      <Select
                        value={manualGradeInput ? 'manual' : formData.gradeId}
                        onValueChange={(value) => {
                          if (value === 'manual') {
                            setManualGradeInput('');
                            setFormData({ ...formData, gradeId: '' });
                          } else {
                            setManualGradeInput('');
                            setFormData({ ...formData, gradeId: value });
                          }
                        }}
                      >
                        <SelectTrigger className="border-2">
                          <SelectValue placeholder="Select grade or enter manually" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Enter manually</SelectItem>
                          {grades.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(manualGradeInput || (formData.gradeId && !grades.find(g => g.id === formData.gradeId))) && (
                        <Input
                          placeholder="Enter grade (e.g., Grade 1, Grade 5)"
                          value={manualGradeInput || formData.gradeId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualGradeInput(val);
                            setFormData({ ...formData, gradeId: val });
                          }}
                          className="border-2 mt-2"
                        />
                      )}
                      <p className="text-xs text-muted-foreground">Select from available grades or enter manually.</p>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
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
                          {/* only show terms the student is eligible for */}
                          {(() => {
                            const student = students.find(s => s.id === formData.studentId);
                            const admissionOrder = parseTermOrder(student?.admission_term || 'Term 1');
                            const academicYear = formData.admissionYear;

                            // prefer grade_terms
                            const termsForGrade = gradeTerms.filter(gt => gt.grade_id === student?.grade_id && gt.academic_year === academicYear && gt.is_active).sort((a,b) => a.term_order - b.term_order);
                            if (termsForGrade.length > 0) {
                              return termsForGrade
                                .filter(gt => gt.term_order >= admissionOrder)
                                .map(gt => <SelectItem key={gt.id} value={gt.term_name}>{gt.term_name}</SelectItem>);
                            }

                            // fallback default 3 terms
                            return [1,2,3].filter(n => n >= admissionOrder).map(n => (
                              <SelectItem key={n} value={`Term ${n}`}>Term {n}</SelectItem>
                            ));
                          })()}
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
                  <Label htmlFor="method">Payment Method *</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(value) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger className="border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash/Other</SelectItem>
                      <SelectItem value="mpesa">Mobile Money</SelectItem>
                      <SelectItem value="mpesa_stk">M-Pesa STK</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  {isOffline && (
                    <p className="text-xs text-muted-foreground">
                      Payment methods saved offline will be confirmed when synced
                    </p>
                  )}
                </div>

                {formData.method === 'mpesa_stk' && (
                  <div className="space-y-2 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                    <Label htmlFor="mpesaStkPhone">Phone Number for STK Push</Label>
                    <div className="flex gap-2">
                      <Input
                        id="mpesaStkPhone"
                        placeholder="e.g., 254712345678"
                        value={mpesaStkPhone}
                        onChange={(e) => setMpesaStkPhone(e.target.value)}
                        className="border-2 flex-1"
                        disabled={mpesaStkLoading}
                      />
                      <Button
                        type="button"
                        onClick={handleMpesaStkSend}
                        disabled={mpesaStkLoading || !mpesaStkPhone.trim()}
                        className="whitespace-nowrap"
                      >
                        {mpesaStkLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send STK'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter the customer's phone number and press Send STK to initiate the payment
                    </p>
                  </div>
                )}

                {formData.method !== 'mpesa_stk' && (
                  <div className="space-y-2">
                    <Label htmlFor="reference">Reference/Transaction ID</Label>
                    <Input
                      id="reference"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      className="border-2"
                      placeholder={formData.method === 'cash' ? '(Optional)' : 'e.g., QXK2J4N8YP (Required)'}
                    />
                    {formData.method !== 'cash' && !formData.reference && (
                      <p className="text-xs text-destructive">
                        Transaction ID is required for Mobile Money and Bank transfers
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || formData.method === 'mpesa_stk'}
                  >
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
                {formData.method === 'mpesa_stk' && (
                  <div className="mt-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm text-destructive font-medium">
                      Cannot record payment with STK until system v2 implementation
                    </p>
                  </div>
                )}
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Filters */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="searchStudent">Search by Student</Label>
            <Input
              id="searchStudent"
              placeholder="Name or Student ID..."
              value={searchStudent}
              onChange={(e) => {
                setSearchStudent(e.target.value);
                setCurrentPage(1);
              }}
              className="border-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchAmount">Search by Amount</Label>
            <Input
              id="searchAmount"
              placeholder="e.g., 1850..."
              value={searchAmount}
              onChange={(e) => {
                setSearchAmount(e.target.value);
                setCurrentPage(1);
              }}
              className="border-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchTerm">Search by Term</Label>
            <Select
              value={searchTerm}
              onValueChange={(value) => {
                setSearchTerm(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="border-2">
                <SelectValue placeholder="All terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                <SelectItem value="Term 1">Term 1</SelectItem>
                <SelectItem value="Term 2">Term 2</SelectItem>
                <SelectItem value="Term 3">Term 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {Math.min(itemsPerPage, filteredPayments.length)} of {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block border-2 border-border rounded-lg overflow-hidden bg-card">
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
              <div className="max-h-[calc(100vh-20rem)] overflow-auto">
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
                  {paginatedPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">
                        {format(new Date(payment.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <p>
                          <button className="font-medium underline" onClick={() => openStudentModal(payment.student!)}>
                            {payment.student?.name}
                          </button>
                        </p>
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
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredPayments.length > itemsPerPage && (
          <div className="hidden md:flex items-center justify-between">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border-2 border-border rounded-lg">
              {searchStudent || searchAmount || searchTerm ? 'No payments found' : 'No payments recorded'}
            </div>
          ) : (
            paginatedPayments.map((payment) => (
              <div
                key={payment.id}
                className="border-2 border-border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{payment.student?.name}</p>
                    <p className="text-sm text-muted-foreground">{payment.student?.student_id}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium uppercase rounded ${
                    payment.status === 'completed' 
                      ? 'bg-chart-2/10 text-chart-2' 
                      : payment.status === 'pending'
                      ? 'bg-chart-4/10 text-chart-4'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {payment.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(payment.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Term</p>
                    <p className="font-medium">{payment.admission_term || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Year</p>
                    <p className="font-medium">{payment.admission_year || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium uppercase text-xs">{payment.method}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reference</p>
                    <p className="font-mono text-xs">{payment.reference || '—'}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openStudentModal(payment.student!)}
                  >
                    View Student
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPayment(payment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mobile Pagination */}
        {filteredPayments.length > itemsPerPage && (
          <div className="md:hidden flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="flex-1"
            >
              Previous
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              {currentPage} / {totalPages}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <EditPaymentDialog
        payment={editingPayment}
        open={!!editingPayment}
        onOpenChange={(open) => !open && setEditingPayment(null)}
        onSave={handleEditPayment}
      />
      <StudentDetailsModal
        student={modalStudent}
        payments={payments}
        gradeTerms={gradeTerms}
        grades={grades}
        open={studentModalOpen}
        onOpenChange={setStudentModalOpen}
        onCreatePaymentForTerm={handleCreatePaymentForTerm}
      />
    </AppLayout>
  );
}
