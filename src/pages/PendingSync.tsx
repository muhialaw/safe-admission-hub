import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Trash2, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { offlineDb, OfflinePayment, OfflineStudent, OfflineAdmission } from '@/lib/offline-db';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';

export default function PendingSync() {
  const { isOffline } = useOfflineSync();
  const [admissions, setAdmissions] = useState<OfflineAdmission[]>([]);
  const [students, setStudents] = useState<OfflineStudent[]>([]);
  const [payments, setPayments] = useState<OfflinePayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingItems();
    // Refresh every 5 seconds
    const interval = setInterval(loadPendingItems, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingItems = async () => {
    try {
      const allAdmissions = await offlineDb.admissions.toArray();
      const allStudents = await offlineDb.students.toArray();
      const allPayments = await offlineDb.payments.toArray();
      
      setAdmissions(allAdmissions);
      setStudents(allStudents);
      setPayments(allPayments);
    } catch (error) {
      console.error('Error loading pending items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (localId: string) => {
    try {
      await offlineDb.payments.where('localId').equals(localId).delete();
      setPayments(payments.filter(p => p.localId !== localId));
      toast.success('Payment removed');
    } catch (error) {
      toast.error('Failed to remove payment');
      console.error(error);
    }
  };

  const handleDeleteStudent = async (localId: string) => {
    try {
      await offlineDb.students.where('localId').equals(localId).delete();
      setStudents(students.filter(s => s.localId !== localId));
      toast.success('Student removed');
    } catch (error) {
      toast.error('Failed to remove student');
      console.error(error);
    }
  };

  const handleDeleteAdmission = async (localId: string) => {
    try {
      await offlineDb.admissions.where('localId').equals(localId).delete();
      setAdmissions(admissions.filter(a => a.localId !== localId));
      toast.success('Admission removed');
    } catch (error) {
      toast.error('Failed to remove admission');
      console.error(error);
    }
  };

  const getStatusBadge = (status: string, errorMessage?: string) => {
    if (status === 'pending') {
      return (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <Badge variant="outline" className="bg-yellow-50">Pending</Badge>
        </div>
      );
    }
    if (status === 'synced') {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <Badge className="bg-green-100 text-green-800">Synced</Badge>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <Badge className="bg-red-100 text-red-800">Failed</Badge>
          {errorMessage && (
            <span className="text-xs text-red-600" title={errorMessage}>
              ({errorMessage.substring(0, 20)}...)
            </span>
          )}
        </div>
      );
    }
  };

  const totalPending = admissions.filter(a => a.syncStatus === 'pending').length +
                       students.filter(s => s.syncStatus === 'pending').length +
                       payments.filter(p => p.syncStatus === 'pending').length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Pending Sync</h1>
            {isOffline && (
              <div className="flex items-center gap-1 text-destructive">
                <WifiOff className="h-5 w-5" />
                <span className="text-sm font-medium">Offline</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground">
            View and manage offline entries waiting to be synced to the server
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPending}</div>
              <p className="text-xs text-muted-foreground mt-1">Items to sync</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Admissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{admissions.filter(a => a.syncStatus === 'pending').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.filter(s => s.syncStatus === 'pending').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments.filter(p => p.syncStatus === 'pending').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="payments">
              Payments <Badge variant="outline" className="ml-2">{payments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="admissions">
              Admissions <Badge variant="outline" className="ml-2">{admissions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="students">
              Students <Badge variant="outline" className="ml-2">{students.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {payments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pending payments
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {payments.map(payment => (
                  <Card key={payment.localId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{payment.studentName}</h3>
                            {getStatusBadge(payment.syncStatus, payment.errorMessage)}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Amount:</span> Ksh {payment.amount.toLocaleString()}
                            </div>
                            <div>
                              <span className="font-medium">Method:</span> {payment.method === 'mobile' ? 'M-Pesa' : payment.method === 'bank' ? 'Bank' : 'Cash'}
                            </div>
                            <div>
                              <span className="font-medium">Term:</span> {payment.term}
                            </div>
                            <div>
                              <span className="font-medium">Year:</span> {payment.year}
                            </div>
                            {payment.reference && (
                              <div>
                                <span className="font-medium">Reference:</span> {payment.reference}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Recorded:</span> {format(new Date(payment.createdAt), 'MMM d, yyyy HH:mm')}
                            </div>
                          </div>
                          {payment.errorMessage && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                              <p className="text-sm text-red-700">
                                <span className="font-medium">Error:</span> {payment.errorMessage}
                              </p>
                            </div>
                          )}
                        </div>
                        {payment.syncStatus !== 'synced' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePayment(payment.localId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Admissions Tab */}
          <TabsContent value="admissions" className="space-y-4">
            {admissions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pending admissions
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {admissions.map(admission => (
                  <Card key={admission.localId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{admission.name}</h3>
                            {getStatusBadge(admission.syncStatus, admission.errorMessage)}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Grade:</span> {admission.gradeId || 'Not set'}
                            </div>
                            <div>
                              <span className="font-medium">Admission Term:</span> {admission.admissionTerm}
                            </div>
                            <div>
                              <span className="font-medium">Admission Year:</span> {admission.admissionYear}
                            </div>
                            {admission.dob && (
                              <div>
                                <span className="font-medium">DOB:</span> {format(new Date(admission.dob), 'MMM d, yyyy')}
                              </div>
                            )}
                            {admission.guardianName && (
                              <div>
                                <span className="font-medium">Guardian:</span> {admission.guardianName}
                              </div>
                            )}
                            {admission.guardianPhone && (
                              <div>
                                <span className="font-medium">Phone:</span> {admission.guardianPhone}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Recorded:</span> {format(new Date(admission.createdAt), 'MMM d, yyyy HH:mm')}
                            </div>
                          </div>
                          {admission.errorMessage && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                              <p className="text-sm text-red-700">
                                <span className="font-medium">Error:</span> {admission.errorMessage}
                              </p>
                            </div>
                          )}
                        </div>
                        {admission.syncStatus !== 'synced' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAdmission(admission.localId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-4">
            {students.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pending students
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {students.map(student => (
                  <Card key={student.localId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{student.name}</h3>
                            {getStatusBadge(student.syncStatus, student.errorMessage)}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Grade:</span> {student.gradeId || 'Not set'}
                            </div>
                            <div>
                              <span className="font-medium">Admission Term:</span> {student.admissionTerm}
                            </div>
                            <div>
                              <span className="font-medium">Admission Year:</span> {student.admissionYear}
                            </div>
                            {student.dob && (
                              <div>
                                <span className="font-medium">DOB:</span> {format(new Date(student.dob), 'MMM d, yyyy')}
                              </div>
                            )}
                            {student.guardianName && (
                              <div>
                                <span className="font-medium">Guardian:</span> {student.guardianName}
                              </div>
                            )}
                            {student.guardianPhone && (
                              <div>
                                <span className="font-medium">Phone:</span> {student.guardianPhone}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Recorded:</span> {format(new Date(student.createdAt), 'MMM d, yyyy HH:mm')}
                            </div>
                          </div>
                          {student.errorMessage && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                              <p className="text-sm text-red-700">
                                <span className="font-medium">Error:</span> {student.errorMessage}
                              </p>
                            </div>
                          )}
                        </div>
                        {student.syncStatus !== 'synced' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStudent(student.localId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Info Box */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              How Syncing Works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Offline entries are stored locally and automatically synced when you go online</p>
            <p>• <span className="font-medium text-yellow-700">Pending</span> items are waiting to be synced</p>
            <p>• <span className="font-medium text-green-700">Synced</span> items have been successfully uploaded to the server</p>
            <p>• <span className="font-medium text-red-700">Failed</span> items had errors during sync. Review the error message and try again or delete the entry</p>
            <p>• You can delete any pending or failed entry, but synced entries cannot be deleted from this page</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
