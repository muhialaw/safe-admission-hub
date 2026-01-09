import { useState, useEffect } from 'react';
import { Loader2, Search, Eye } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Student, Guardian, Payment } from '@/types/database';
import { format } from 'date-fns';
import { cachedDataService } from '@/lib/cached-data-service';

export default function Students() {
  const { user, isAdmin, role } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentGuardians, setStudentGuardians] = useState<Guardian[]>([]);
  const [studentPayments, setStudentPayments] = useState<Payment[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showDeletedStudents, setShowDeletedStudents] = useState(false);
  const [deletedStudents, setDeletedStudents] = useState<Student[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', admission_term: '', admission_year: 0, grade_id: '' });

  useEffect(() => {
    fetchStudents(page);
    if (isAdmin) fetchDeletedStudents();
  }, [page, isAdmin]);

  const fetchStudents = async (pageNumber = 1) => {
    try {
      // Use cached students for listing
      const allStudents = await cachedDataService.getStudents();
      
      // Paginate the cached results
      const start = (pageNumber - 1) * pageSize;
      const end = start + pageSize;
      
      setStudents(allStudents.slice(start, end));
      setTotalPages(Math.max(1, Math.ceil(allStudents.length / pageSize)));
    } catch (error) {
      console.error('Error fetching students:', error);
      if (!navigator.onLine) {
        toast.error('Offline mode', {
          description: 'Student data is not available. Please go online to load student data.',
        });
      } else {
        toast.error('Failed to load students', {
          description: 'Please try again or refresh the page.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewStudent = async (student: Student) => {
    setSelectedStudent(student);
    setIsEditing(false);
    setEditData({ name: student.name, admission_term: student.admission_term, admission_year: student.admission_year, grade_id: student.grade_id });
    
    // Fetch guardians and payments
    try {
      const [guardiansRes, paymentsRes] = await Promise.all([
        supabase
          .from('guardians')
          .select('*')
          .eq('student_id', student.id),
        supabase
          .from('payments')
          .select('*')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .range(0, 49), // fetch up to 50 recent payments, load more on demand
      ]);

      setStudentGuardians((guardiansRes.data as Guardian[]) || []);
      setStudentPayments((paymentsRes.data as Payment[]) || []);
    } catch (err) {
      console.error('Error fetching student details:', err);
      setStudentGuardians([]);
      setStudentPayments([]);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedStudent || !user) return;
    try {
      const payload: Record<string, unknown> = {};
      if (editData.name) payload.name = editData.name;
      if (editData.admission_term) payload.admission_term = editData.admission_term;
      if (editData.admission_year) payload.admission_year = editData.admission_year;
      if (editData.grade_id) payload.grade_id = editData.grade_id;

      const { error } = await supabase.from('students').update(payload).eq('id', selectedStudent.id);
      if (error) throw error;
      toast.success('Student updated');
      // refresh list & details
      fetchStudents(page);
      handleViewStudent((await supabase.from('students').select('*, grade:grades(*)').eq('id', selectedStudent.id).maybeSingle()).data as Student);
      setIsEditing(false);
    } catch (err) {
      console.error('Update student error', err);
      toast.error('Failed to update student (check permissions)');
    }
  };

  const handleSoftDelete = async () => {
    if (!selectedStudent || !user) return;
    if (!confirm('Soft-delete this student? It will be recoverable for 30 days.')) return;
    try {
      // record soft delete
      const { error: sdErr } = await supabase.from('soft_deletes').insert({ table_name: 'students', record_id: selectedStudent.id });
      if (sdErr) throw sdErr;

      const { error: updErr } = await supabase.from('students').update({ is_deleted: true }).eq('id', selectedStudent.id);
      if (updErr) throw updErr;

      toast.success('Student soft-deleted (recoverable for 30 days)');
      setSelectedStudent(null);
      fetchStudents(page);
      if (isAdmin) fetchDeletedStudents();
    } catch (err) {
      console.error('Soft delete error', err);
      toast.error('Failed to delete student (check permissions)');
    }
  };

  const fetchDeletedStudents = async () => {
    try {
      const { data: softDeletes } = await supabase.from('soft_deletes').select('*').eq('table_name', 'students');
      if (!softDeletes) return;

      const deletedIds = softDeletes.map(sd => sd.record_id);
      if (deletedIds.length === 0) {
        setDeletedStudents([]);
        return;
      }

      const { data: students } = await supabase.from('students').select('id,name,student_id').in('id', deletedIds).eq('is_deleted', true);
      if (!students) return;

      const enriched = softDeletes.map(sd => {
        const s = (students as any[]).find(st => st.id === sd.record_id);
        const restoreUntil = new Date(sd.restore_until);
        const daysLeft = Math.ceil((restoreUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: sd.record_id,
          name: s?.name || '—',
          student_id: s?.student_id || '—',
          deleted_at: sd.deleted_at,
          restore_until: sd.restore_until,
          deleted_days: daysLeft,
        };
      });

      setDeletedStudents(enriched);
    } catch (err) {
      console.error('Fetch deleted students error', err);
    }
  };

  const handleRestoreStudent = async (studentId: string) => {
    if (!user) return;
    if (!confirm('Restore this student record?')) return;
    try {
      const { error: delErr } = await supabase.from('soft_deletes').delete().eq('record_id', studentId);
      if (delErr) throw delErr;

      const { error: updErr } = await supabase.from('students').update({ is_deleted: false }).eq('id', studentId);
      if (updErr) throw updErr;

      toast.success('Student restored successfully');
      fetchDeletedStudents();
      fetchStudents(page);
    } catch (err) {
      console.error('Restore error', err);
      toast.error('Failed to restore student');
    }
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
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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

              {/* Mobile Card View */}
              <div className="md:hidden space-y-2 p-4">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="border-2 border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{student.student_id}</p>
                        <p className="text-sm text-muted-foreground mt-1">{student.grade?.name || '—'} • {student.admission_term}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStudent(student)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* View More Toggle */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <button
                        className="text-xs font-medium text-primary"
                        onClick={() => {
                          const newExpanded = new Set(expandedRows);
                          if (newExpanded.has(student.id)) {
                            newExpanded.delete(student.id);
                          } else {
                            newExpanded.add(student.id);
                          }
                          setExpandedRows(newExpanded);
                        }}
                      >
                        {expandedRows.has(student.id) ? '▼ Hide Details' : '▶ View More'}
                      </button>
                      
                      {/* Expanded Details */}
                      {expandedRows.has(student.id) && (
                        <div className="mt-3 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Age:</span>
                            <span className="font-medium">{student.age_cached ?? '—'} years</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Admission:</span>
                            <span className="font-medium">{student.admission_term} {student.admission_year}</span>
                          </div>
                          {student.dob && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">DOB:</span>
                              <span className="font-medium">{format(new Date(student.dob), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination controls for students */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next</Button>
          </div>
        </div>

        {/* Admin: Soft-Deleted Students Restore Section */}
        {isAdmin && (
          <div className="mt-8 border-t-2 border-border pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Soft-Deleted Students</h2>
              <Button size="sm" variant="outline" onClick={() => { setShowDeletedStudents(!showDeletedStudents); if (!showDeletedStudents) fetchDeletedStudents(); }}>
                {showDeletedStudents ? 'Hide' : 'Show'} ({deletedStudents.length})
              </Button>
            </div>
            {showDeletedStudents && (
              <div className="space-y-2">
                {deletedStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No soft-deleted students</p>
                ) : (
                  deletedStudents.map(sd => (
                    <div key={sd.id} className="flex items-center justify-between border rounded p-3">
                      <div>
                        <p className="font-medium">{sd.name}</p>
                        <p className="text-sm text-muted-foreground">{sd.student_id} • Deleted {format(new Date(sd.deleted_at), 'MMM d, yyyy')}</p>
                        <p className={`text-xs font-medium mt-1 ${sd.deleted_days > 7 ? 'text-chart-2' : 'text-destructive'}`}>
                          {sd.deleted_days > 0 ? `${sd.deleted_days} days remaining` : 'Expired - cannot restore'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={sd.deleted_days > 0 ? 'default' : 'ghost'}
                        onClick={() => handleRestoreStudent(sd.id)}
                        disabled={sd.deleted_days <= 0}
                      >
                        {sd.deleted_days > 0 ? 'Restore' : 'Expired'}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Student Detail Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="overflow-auto max-h-[calc(100vh-12rem)] p-4 space-y-6">
                {/* Student Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Student ID</p>
                    <p className="font-mono font-medium">{selectedStudent.student_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    {isEditing ? (
                      <input className="w-full border px-2 py-1" value={editData.name || ''} onChange={(e) => setEditData({...editData, name: e.target.value})} />
                    ) : (
                      <p className="font-medium">{selectedStudent.name}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grade</p>
                    {isEditing ? (
                      <input className="w-full border px-2 py-1" value={editData.grade_id || ''} onChange={(e) => setEditData({...editData, grade_id: e.target.value})} />
                    ) : (
                      <p className="font-medium">{selectedStudent.grade?.name || '—'}</p>
                    )}
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
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input className="w-1/2 border px-2 py-1" value={editData.admission_term || ''} onChange={(e) => setEditData({...editData, admission_term: e.target.value})} />
                        <input className="w-1/2 border px-2 py-1" type="number" value={editData.admission_year || selectedStudent.admission_year} onChange={(e) => setEditData({...editData, admission_year: parseInt(e.target.value || String(selectedStudent.admission_year))})} />
                      </div>
                    ) : (
                      <p className="font-medium">{selectedStudent.admission_term} {selectedStudent.admission_year}</p>
                    )}
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
                {/* Actions */}
                <div className="flex justify-end gap-2 mt-4">
                  {(role === 'receptionist' || isAdmin) && (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(v => !v)}>{isEditing ? 'Cancel' : 'Edit'}</Button>
                  )}
                  {isEditing && (
                    <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="destructive" onClick={handleSoftDelete}>Soft Delete</Button>
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
