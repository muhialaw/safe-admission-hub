import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { GradeTerm, Payment, Student } from '@/types/database';

interface Props {
  student: Student | null;
  payments: (Payment & { student?: Student })[];
  gradeTerms: GradeTerm[];
  grades: { id: string; name: string; fee_per_term?: number }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePaymentForTerm?: (termName: string, year: number) => void;
}

export function StudentDetailsModal({ student, payments, gradeTerms, grades, open, onOpenChange, onCreatePaymentForTerm }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const studentPayments = useMemo(() => payments.filter(p => p.student?.id === student?.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [payments, student]);

  const totalPages = Math.max(1, Math.ceil(studentPayments.length / pageSize));

  const paginated = useMemo(() => studentPayments.slice((page-1)*pageSize, page*pageSize), [studentPayments, page]);

  const unpaidTerms = useMemo(() => {
    if (!student) return [] as { term: string; year: number; amountDue: number }[];
    const result: { term: string; year: number; amountDue: number }[] = [];
    const studentAdmissionOrder = parseInt((student.admission_term || 'Term 1').match(/(\d+)/)?.[1] || '1', 10);
    const academicYear = student.admission_year || new Date().getFullYear();

    // collect grade terms for student's grade and year
    const termsForGrade = gradeTerms.filter(gt => gt.grade_id === student.grade_id && gt.academic_year === academicYear && gt.is_active).sort((a,b)=>a.term_order-b.term_order);

    // if no grade terms, fallback to single fee_per_term from grades
    if (termsForGrade.length === 0) {
      const fee = grades.find(g => g.id === student.grade_id)?.fee_per_term;
      if (fee == null) return [];
      // assume 3 terms
      for (let t = studentAdmissionOrder; t <= 3; t++) {
        const termName = `Term ${t}`;
        const totalPaid = payments.filter(p => p.student?.id === student.id && p.admission_term === termName && p.admission_year === academicYear).reduce((s,p)=>s+(p.amount||0),0);
        if (totalPaid < fee) result.push({ term: termName, year: academicYear, amountDue: fee - totalPaid });
      }
      return result;
    }

    for (const gt of termsForGrade) {
      const termOrder = gt.term_order;
      if (termOrder < studentAdmissionOrder) continue;
      const totalPaid = payments.filter(p => p.student?.id === student.id && p.admission_term === gt.term_name && p.admission_year === academicYear).reduce((s,p)=>s+(p.amount||0),0);
      if (totalPaid < Number(gt.fee_amount)) result.push({ term: gt.term_name, year: academicYear, amountDue: Number(gt.fee_amount) - totalPaid });
    }

    return result;
  }, [student, payments, gradeTerms, grades]);

  const totalUnpaid = unpaidTerms.reduce((s, u) => s + u.amountDue, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[calc(100vh-4rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Student Details</DialogTitle>
          <DialogDescription>{student.name} — {student.student_id}</DialogDescription>
          <div className="mt-2">
            {totalUnpaid > 0 ? (
              <div className="text-sm text-destructive font-medium">-KSh {Math.round(totalUnpaid)} overdue</div>
            ) : (
              <div className="text-sm text-muted-foreground">All terms up to date</div>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(100vh-10rem)] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="p-4 border rounded">
                <p className="text-sm text-muted-foreground">Grade</p>
                <p className="font-medium">{grades.find(g=>g.id===student.grade_id)?.name || '—'}</p>
                <p className="text-sm text-muted-foreground">Admission</p>
                <p className="font-medium">{student.admission_term} {student.admission_year}</p>
              </div>

              <div className="p-4 border rounded">
                <p className="text-sm text-muted-foreground">Unpaid Terms</p>
                {unpaidTerms.length === 0 ? (
                  <p className="font-medium">All terms fully paid</p>
                ) : (
                  <ul className="space-y-2">
                    {unpaidTerms.map(u => (
                      <li key={`${u.term}-${u.year}`} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{u.term} {u.year}</p>
                          <p className="text-sm text-muted-foreground">Due: {formatCurrency(Math.round(u.amountDue))}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => onCreatePaymentForTerm?.(u.term, u.year)}>Record Payment</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <div className="p-4 border rounded mb-4">
                <p className="text-sm text-muted-foreground">Recent Payments</p>
                {studentPayments.length === 0 ? (
                  <p className="font-medium">No payments yet</p>
                ) : (
                  <div>
                    <div className="space-y-2">
                      {paginated.map(p => {
                        // compute amount still due for this term
                        const termPayments = studentPayments.filter(sp => sp.admission_term === p.admission_term && sp.admission_year === p.admission_year);
                        const totalPaidForTerm = termPayments.reduce((s, sp) => s + (sp.amount || 0), 0);
                        const gradeTerm = gradeTerms.find(gt => gt.grade_id === student?.grade_id && gt.term_name === p.admission_term && gt.academic_year === p.admission_year);
                        const fee = gradeTerm ? Number(gradeTerm.fee_amount) : grades.find(g => g.id === student?.grade_id)?.fee_per_term;
                        const remaining = fee ? fee - totalPaidForTerm : 0;
                        return (
                          <div key={p.id} className="border rounded p-2 text-sm">
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium">{formatCurrency(Math.round(p.amount))}</p>
                                <p className="text-xs text-muted-foreground">{p.admission_term} {p.admission_year} • {p.method.toUpperCase()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'MMM d')}</p>
                                <p className={`text-xs font-medium ${remaining > 0 ? 'text-destructive' : 'text-chart-2'}`}>
                                  {remaining > 0 ? `-KSh ${Math.round(remaining)}` : 'Paid'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</Button>
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// local helper (kept here to avoid import cycles)
function parseTermOrder(term: string) {
  const m = String(term).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
