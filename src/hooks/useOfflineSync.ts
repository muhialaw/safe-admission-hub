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
  OfflinePayment,
} from '@/lib/offline-db';
import { toast } from 'sonner';

export function useOfflineSync() {
  const { user } = useAuth();
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
      syncAll();
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
      const { data, error } = await supabase
        .from('payments')
        .insert({
          student_id: payment.studentId,
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference,
          entered_by: user.id,
          status: 'completed',
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
      const { students, payments } = await getPendingItems();
      let syncedCount = 0;
      let failedCount = 0;

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
  }, [user, isSyncing, updatePendingCount]);

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
    addOfflineStudent,
    addOfflinePayment,
    updatePendingCount,
  };
}
