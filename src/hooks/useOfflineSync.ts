import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  offlineDb,
  getPendingSyncCount,
  getPendingItems,
  markStudentSynced,
  markStudentFailed,
  markPaymentSynced,
  markPaymentFailed,
  isOnline,
  OfflineStudent,
  OfflineAdmission,
  OfflinePayment,
  markAdmissionSynced,
  markAdmissionFailed,
} from '@/lib/offline-db';
import { toast } from 'sonner';

export function useOfflineSync() {
  const { user, isAdmin } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online! Syncing data...');
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('You are offline. Data will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updatePendingCount]);

  // Sync a single admission
  const syncAdmission = async (admission: OfflineAdmission): Promise<boolean> => {
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          student_id: '',
          name: admission.name,
          dob: admission.dob,
          grade_id: admission.gradeId,
          admission_term: admission.admissionTerm,
          admission_year: admission.admissionYear,
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // Add guardian if exists
      if (admission.guardianName && student) {
        await supabase.from('guardians').insert({
          student_id: student.id,
          name: admission.guardianName,
          phone: admission.guardianPhone,
          area: admission.guardianArea,
          is_emergency: true,
        });
      }

      await markAdmissionSynced(admission.localId, student.id, student.student_id);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await markAdmissionFailed(admission.localId, message);
      return false;
    }
  };

  // Sync a single student
  const syncStudent = async (student: OfflineStudent): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('students')
        .insert({
          student_id: '',
          name: student.name,
          dob: student.dob,
          grade_id: student.gradeId,
          admission_term: student.admissionTerm,
          admission_year: student.admissionYear,
        })
        .select()
        .single();

      if (error) throw error;

      // Add guardian if exists
      if (student.guardianName && data) {
        await supabase.from('guardians').insert({
          student_id: data.id,
          name: student.guardianName,
          phone: student.guardianPhone,
          area: student.guardianArea,
          is_emergency: true,
        });
      }

      await markStudentSynced(student.localId, data.id);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await markStudentFailed(student.localId, message);
      return false;
    }
  };

  // Sync a single payment
  const syncPayment = async (payment: OfflinePayment): Promise<boolean> => {
    if (!user) return false;

    try {
      // Resolve student ID from input (could be student_id, student name, or actual UUID)
      let studentId = payment.studentId;
      
      // If studentId looks like a UUID, use it directly. Otherwise, search for student
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payment.studentId);
      
      if (!isUUID) {
        // Search by student_id or name
        const { data: students } = await supabase
          .from('students')
          .select('id, student_id, name')
          .or(`student_id.eq.${payment.studentId}, name.ilike.%${payment.studentId}%`)
          .limit(1);
        
        if (!students || students.length === 0) {
          throw new Error(`Student not found: ${payment.studentId}`);
        }
        
        studentId = students[0].id;
      }

      // Map offline method names to database format
      let dbMethod: string = payment.method;
      if (payment.method === 'mobile') {
        dbMethod = 'mpesa';
      }

      // Respect role: admin syncs as completed, others remain pending for review
      const { data, error } = await supabase
        .from('payments')
        .insert({
          student_id: studentId,
          amount: payment.amount,
          method: dbMethod,
          reference: payment.reference,
          entered_by: user.id,
          status: isAdmin ? 'completed' : 'pending',
          admission_term: payment.term,
          admission_year: payment.year,
        })
        .select()
        .single();

      if (error) throw error;

      await markPaymentSynced(payment.localId, data.id);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await markPaymentFailed(payment.localId, message);
      return false;
    }
  };

  // Sync all pending items
  const syncAll = useCallback(async () => {
    if (!isOnline() || isSyncing || !user) return;

    setIsSyncing(true);
    
    try {
      const { admissions, students, payments } = await getPendingItems();
      let syncedCount = 0;
      let failedCount = 0;

      // Sync admissions
      for (const admission of admissions) {
        const success = await syncAdmission(admission);
        if (success) syncedCount++;
        else failedCount++;
      }

      // Sync students
      for (const student of students) {
        const success = await syncStudent(student);
        if (success) syncedCount++;
        else failedCount++;
      }

      // Sync payments
      for (const payment of payments) {
        const success = await syncPayment(payment);
        if (success) syncedCount++;
        else failedCount++;
      }

      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} items`);
      }
      if (failedCount > 0) {
        toast.error(`Failed to sync ${failedCount} items`);
      }

      await updatePendingCount();
    } finally {
      setIsSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, user, updatePendingCount]);

  // Add offline admission
  const addOfflineAdmission = async (admission: Omit<OfflineAdmission, 'id' | 'syncStatus' | 'createdAt'>) => {
    await offlineDb.admissions.add({
      ...admission,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
    });
    await updatePendingCount();
    
    // Try to sync immediately if online
    if (isOnline()) {
      syncAll();
    }
  };

  // Add offline student
  const addOfflineStudent = async (student: Omit<OfflineStudent, 'id' | 'syncStatus' | 'createdAt'>) => {
    await offlineDb.students.add({
      ...student,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
    });
    await updatePendingCount();
    
    // Try to sync immediately if online
    if (isOnline()) {
      syncAll();
    }
  };

  // Add offline payment
  const addOfflinePayment = async (payment: Omit<OfflinePayment, 'id' | 'syncStatus' | 'createdAt'>) => {
    await offlineDb.payments.add({
      ...payment,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
    });
    await updatePendingCount();
    
    // Try to sync immediately if online
    if (isOnline()) {
      syncAll();
    }
  };

  return {
    pendingCount,
    isSyncing,
    isOffline,
    syncAll,
    addOfflineAdmission,
    addOfflineStudent,
    addOfflinePayment,
    updatePendingCount,
  };
}
