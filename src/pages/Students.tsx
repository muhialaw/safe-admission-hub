import { useState, useEffect } from 'react';
import { Loader2, Search, Eye } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Student, Guardian, Payment } from '@/types/database';
import { format } from 'date-fns';

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentGuardians, setStudentGuardians] = useState<Guardian[]>([]);
  const [studentPayments, setStudentPayments] = useState<Payment[]>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, grade:grades(*)')
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      setStudents(data as unknown as Student[]);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewStudent = async (student: Student) => {
    setSelectedStudent(student);
    
    // Fetch guardians and payments
    const [guardiansRes, paymentsRes] = await Promise.all([
      supabase
        .from('guardians')
        .select('*')
        .eq('student_id', student.id),
      supabase
        .from('payments')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false }),
    ]);

    setStudentGuardians((guardiansRes.data as Guardian[]) || []);
    setStudentPayments((paymentsRes.data as Payment[]) || []);
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchQuery.toLowerCase())
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">View and manage student records</p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-2 pl-10"
          />
        </div>

        {/* Students Table */}
        <div className="border-2 border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No students found' : 'No students registered'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border bg-muted">
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Student ID
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Grade
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Age
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Term
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-sm">{student.student_id}</td>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3">{student.grade?.name || '—'}</td>
                      <td className="px-4 py-3">{student.age_cached ?? '—'}</td>
                      <td className="px-4 py-3">{student.admission_term}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewStudent(student)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Student Detail Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                {/* Student Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Student ID</p>
                    <p className="font-mono font-medium">{selectedStudent.student_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedStudent.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grade</p>
                    <p className="font-medium">{selectedStudent.grade?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Age</p>
                    <p className="font-medium">{selectedStudent.age_cached ?? '—'} years</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">
                      {selectedStudent.dob 
                        ? format(new Date(selectedStudent.dob), 'MMMM d, yyyy')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admission</p>
                    <p className="font-medium">
                      {selectedStudent.admission_term} {selectedStudent.admission_year}
                    </p>
                  </div>
                </div>

                {/* Guardians */}
                <div className="border-t-2 border-border pt-4">
                  <h3 className="mb-3 font-medium">Guardians/Parents</h3>
                  {studentGuardians.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No guardians registered</p>
                  ) : (
                    <div className="space-y-2">
                      {studentGuardians.map((guardian) => (
                        <div key={guardian.id} className="border-2 border-border p-3">
                          <p className="font-medium">{guardian.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {guardian.phone} • {guardian.area}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div className="border-t-2 border-border pt-4">
                  <h3 className="mb-3 font-medium">Payment History</h3>
                  {studentPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {studentPayments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between border-2 border-border p-3">
                          <div>
                            <p className="font-medium">{formatCurrency(payment.amount)}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.method.toUpperCase()} • {payment.reference || 'No ref'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                              payment.status === 'completed' 
                                ? 'bg-chart-2/10 text-chart-2' 
                                : payment.status === 'pending'
                                ? 'bg-chart-4/10 text-chart-4'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {payment.status}
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {format(new Date(payment.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
