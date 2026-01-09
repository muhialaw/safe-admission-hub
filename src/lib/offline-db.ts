import Dexie, { Table } from 'dexie';

export interface OfflineAdmission {
  id?: number;
  localId: string;
  name: string;
  dob: string | null;
  gradeId: string | null;
  admissionTerm: string;
  admissionYear: number;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianArea: string | null;
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
  syncedId?: string; // Server ID after sync
  syncedStudentId?: string; // Server-assigned student_id after sync
  errorMessage?: string;
}

export interface OfflineStudent {
  id?: number;
  localId: string;
  name: string;
  dob: string | null;
  gradeId: string | null;
  admissionTerm: string;
  admissionYear: number;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianArea: string | null;
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
  syncedId?: string; // Server ID after sync
  errorMessage?: string;
}

export interface OfflinePayment {
  id?: number;
  localId: string;
  studentId: string; // Can be server ID or manual entry (offline)
  studentName: string;
  amount: number;
  method: 'cash' | 'mobile' | 'bank';
  reference: string | null;
  term: string;
  year: number;
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: string;
  syncedId?: string;
  errorMessage?: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'student' | 'payment';
  localId: string;
  data: Record<string, unknown>;
  attempts: number;
  lastAttempt: string | null;
  status: 'pending' | 'processing' | 'failed';
}

class ShuleOfflineDB extends Dexie {
  admissions!: Table<OfflineAdmission>;
  students!: Table<OfflineStudent>;
  payments!: Table<OfflinePayment>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('ShulePOS');
    
    this.version(1).stores({
      admissions: '++id, localId, syncStatus, createdAt',
      students: '++id, localId, syncStatus, createdAt',
      payments: '++id, localId, studentId, syncStatus, createdAt',
      syncQueue: '++id, type, localId, status',
    });
  }
}

export const offlineDb = new ShuleOfflineDB();

// Helper to generate local IDs
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check if we're online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  const pendingAdmissions = await offlineDb.admissions
    .where('syncStatus')
    .equals('pending')
    .count();

  const pendingStudents = await offlineDb.students
    .where('syncStatus')
    .equals('pending')
    .count();
  
  const pendingPayments = await offlineDb.payments
    .where('syncStatus')
    .equals('pending')
    .count();
  
  return pendingAdmissions + pendingStudents + pendingPayments;
}

// Get all pending items
export async function getPendingItems() {
  const admissions = await offlineDb.admissions
    .where('syncStatus')
    .equals('pending')
    .toArray();

  const students = await offlineDb.students
    .where('syncStatus')
    .equals('pending')
    .toArray();
  
  const payments = await offlineDb.payments
    .where('syncStatus')
    .equals('pending')
    .toArray();
  
  return { admissions, students, payments };
}

// Mark item as synced
export async function markStudentSynced(localId: string, serverId: string) {
  await offlineDb.students
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'synced', syncedId: serverId });
}

export async function markAdmissionSynced(localId: string, serverId: string, syncedStudentId: string) {
  await offlineDb.admissions
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'synced', syncedId: serverId, syncedStudentId });
}

export async function markAdmissionFailed(localId: string, errorMessage: string) {
  await offlineDb.admissions
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'failed', errorMessage });
}

export async function markPaymentSynced(localId: string, serverId: string) {
  await offlineDb.payments
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'synced', syncedId: serverId });
}

// Mark item as failed
export async function markStudentFailed(localId: string, error: string) {
  await offlineDb.students
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'failed', errorMessage: error });
}

export async function markPaymentFailed(localId: string, error: string) {
  await offlineDb.payments
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'failed', errorMessage: error });
}
