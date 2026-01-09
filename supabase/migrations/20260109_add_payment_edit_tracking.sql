-- Add new columns to payments table for admission tracking and edit history
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS admission_term TEXT DEFAULT 'Term 1',
ADD COLUMN IF NOT EXISTS admission_year INTEGER DEFAULT 2026,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- Create unique index on reference to prevent duplicate transaction IDs
CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_unique_idx 
ON public.payments(reference) 
WHERE reference IS NOT NULL;

-- Create grade_terms table for multiple term amounts per grade
CREATE TABLE IF NOT EXISTS public.grade_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE NOT NULL,
    term_name TEXT NOT NULL,
    term_order INTEGER NOT NULL,
    fee_amount NUMERIC(10, 2) NOT NULL,
    academic_year INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (grade_id, term_name, academic_year)
);

-- Enable RLS on grade_terms
ALTER TABLE public.grade_terms ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for grade_terms - allow read to all authenticated users
CREATE POLICY "Allow authenticated users to read grade_terms"
ON public.grade_terms
FOR SELECT
TO authenticated
USING (true);

-- Create RLS policy for grade_terms - allow insert/update/delete to admin only
CREATE POLICY "Allow admin to manage grade_terms"
ON public.grade_terms
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Update payments RLS to allow admin to edit
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can read all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can read all payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admin can update payments" ON public.payments;

-- Create new payment RLS policies
-- Allow admins and receptionists to read all payments
CREATE POLICY "All authenticated users can read payments"
ON public.payments
FOR SELECT
TO authenticated
USING (true);

-- Allow insert for authenticated users
CREATE POLICY "Authenticated users can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow admin to update payments
CREATE POLICY "Admin can update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Create function to log payment edits automatically
CREATE OR REPLACE FUNCTION public.log_payment_edit()
RETURNS TRIGGER AS $$
BEGIN
    -- If any editable field changed, log it
    IF OLD.amount IS DISTINCT FROM NEW.amount
        OR OLD.method IS DISTINCT FROM NEW.method
        OR OLD.reference IS DISTINCT FROM NEW.reference
        OR OLD.admission_term IS DISTINCT FROM NEW.admission_term
        OR OLD.admission_year IS DISTINCT FROM NEW.admission_year
    THEN
        INSERT INTO public.audit_logs (
            action,
            table_name,
            record_id,
            before_data,
            after_data,
            performed_by,
            created_at
        ) VALUES (
            'PAYMENT_EDITED',
            'payments',
            NEW.id,
            jsonb_build_object(
                'amount', OLD.amount,
                'method', OLD.method,
                'reference', OLD.reference,
                'admission_term', OLD.admission_term,
                'admission_year', OLD.admission_year
            ),
            jsonb_build_object(
                'amount', NEW.amount,
                'method', NEW.method,
                'reference', NEW.reference,
                'admission_term', NEW.admission_term,
                'admission_year', NEW.admission_year,
                'edit_reason', NEW.edit_reason
            ),
            NEW.edited_by,
            NEW.edited_at
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment edits
DROP TRIGGER IF EXISTS payment_edit_trigger ON public.payments;
CREATE TRIGGER payment_edit_trigger
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_edit();

-- Add comment to audit_logs action field for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit log for all data modifications. Actions: PAYMENT_CREATED, PAYMENT_EDITED, PAYMENT_APPROVED, etc.';
