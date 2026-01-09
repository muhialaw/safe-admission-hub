export type AppRole = 'admin' | 'receptionist';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Grade {
  id: string;
  name: string;
  capacity: number;
  fee_per_term: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_id: string;
  name: string;
  dob: string | null;
  age_cached: number | null;
  grade_id: string | null;
  admission_term: string;
  admission_year: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  grade?: Grade;
  guardians?: Guardian[];
}

export interface Guardian {
  id: string;
  student_id: string;
  name: string;
  phone: string | null;
  area: string | null;
  is_emergency: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  method: 'mpesa' | 'bank' | 'manual';
  reference: string | null;
  entered_by: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  student?: Student;
}

export interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
}
