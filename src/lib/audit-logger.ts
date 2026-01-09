import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  action: string;
  table_name: string;
  record_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  performed_by: string | null;
  importance: 'normal' | 'important' | 'critical';
  details?: string;
}

/**
 * Log an important event to the audit trail
 * Includes detailed before/after data for critical operations
 */
export async function logImportantEdit(
  action: string,
  table_name: string,
  record_id: string,
  before_data: Record<string, unknown>,
  after_data: Record<string, unknown>,
  performed_by: string | null,
  edit_reason?: string
): Promise<void> {
  try {
    // Create comprehensive audit log entry
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: `${action}_IMPORTANT`,
        table_name,
        record_id: record_id || null,
        before_data: JSON.parse(JSON.stringify(before_data)),
        after_data: JSON.parse(JSON.stringify({
          ...after_data,
          edit_reason: edit_reason || 'No reason provided',
        })),
        performed_by,
      });

    if (error) {
      console.error('Audit log error:', error);
    }
  } catch (err) {
    console.error('Failed to log important edit:', err);
    // Silently fail - audit logging should not break the main operation
  }
}

/**
 * Get audit logs for a specific payment
 */
export async function getPaymentAuditLogs(paymentId: string) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('record_id', paymentId)
      .eq('table_name', 'payments')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    return [];
  }
}

/**
 * Get all important edits across the system
 */
export async function getImportantEdits(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .ilike('action', '%IMPORTANT%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to fetch important edits:', err);
    return [];
  }
}
