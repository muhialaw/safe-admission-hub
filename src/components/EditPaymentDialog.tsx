import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Payment, Student } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface EditPaymentDialogProps {
  payment: (Payment & { student: Student }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { amount: number; method: string; reference: string | null; admission_term: string; admission_year: number; edit_reason: string }) => Promise<void>;
}

export function EditPaymentDialog({
  payment,
  open,
  onOpenChange,
  onSave,
}: EditPaymentDialogProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    admission_term: 'Term 1',
    admission_year: new Date().getFullYear(),
    edit_reason: '',
  });

  // Initialize form when payment changes
  if (payment && open && !formData.amount) {
    setFormData({
      amount: String(payment.amount),
      method: payment.method,
      reference: payment.reference || '',
      admission_term: payment.admission_term,
      admission_year: payment.admission_year,
      edit_reason: '',
    });
  }

  const hasChanges =
    payment &&
    (parseFloat(formData.amount) !== payment.amount ||
      formData.method !== payment.method ||
      formData.reference !== (payment.reference || '') ||
      formData.admission_term !== payment.admission_term ||
      formData.admission_year !== payment.admission_year);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.edit_reason.trim()) {
      toast.error('Please provide a reason for this edit');
      return;
    }

    if (!payment) return;

    // Show warning dialog
    setShowWarning(true);
  };

  const confirmEdit = async () => {
    setShowWarning(false);
    setIsSubmitting(true);

    try {
      const numericAmount = parseFloat(String(formData.amount).replace(/[,\sKShksh$£€]/g, '').replace(/[^0-9.-]/g, ''));
      if (isNaN(numericAmount) || numericAmount <= 0) {
        toast.error('Enter a valid amount greater than 0');
        return;
      }

      await onSave({
        amount: numericAmount,
        method: formData.method,
        reference: formData.reference.trim() || null,
        admission_term: formData.admission_term,
        admission_year: formData.admission_year,
        edit_reason: formData.edit_reason.trim(),
      });

      // Reset form
      setFormData({
        amount: '',
        method: 'cash',
        reference: '',
        admission_term: 'Term 1',
        admission_year: new Date().getFullYear(),
        edit_reason: '',
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payment) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment Details</DialogTitle>
            <DialogDescription>
              Update payment for {payment.student?.name} ({payment.student?.student_id})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Changes will be logged</p>
                <p className="text-xs mt-1">All edits are recorded in audit logs with timestamp and reason.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="original-amount">Original Amount</Label>
              <Input
                id="original-amount"
                value={formatCurrency(payment.amount)}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">New Amount (KES) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder={String(payment.amount)}
                value={formData.amount}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
                  setFormData({ ...formData, amount: cleaned });
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select
                value={formData.method}
                onValueChange={(value) => setFormData({ ...formData, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash/Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Transaction ID/Reference</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder={payment.reference || 'Optional'}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="term">Term</Label>
                <Select
                  value={formData.admission_term}
                  onValueChange={(value) => setFormData({ ...formData, admission_term: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.admission_year}
                  onChange={(e) => setFormData({ ...formData, admission_year: parseInt(e.target.value || String(new Date().getFullYear())) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Edit *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this change is being made (e.g., 'Correction: amount was incorrectly entered', 'Student requested...', etc.)"
                value={formData.edit_reason}
                onChange={(e) => setFormData({ ...formData, edit_reason: e.target.value })}
                required
                className="resize-none h-20"
              />
              <p className="text-xs text-muted-foreground">
                This reason will be logged and visible in audit records
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !hasChanges || !formData.edit_reason.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Confirm Payment Edit
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <div>
                <p className="font-medium text-foreground mb-3">Original Details:</p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Amount:</dt>
                    <dd className="font-medium">{formatCurrency(payment.amount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Method:</dt>
                    <dd className="font-medium uppercase">{payment.method}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Term/Year:</dt>
                    <dd className="font-medium">
                      {payment.admission_term} {payment.admission_year}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border-t pt-4">
                <p className="font-medium text-foreground mb-3">New Details:</p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Amount:</dt>
                    <dd className="font-medium">{formatCurrency(parseFloat(formData.amount) || 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Method:</dt>
                    <dd className="font-medium uppercase">{formData.method}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Term/Year:</dt>
                    <dd className="font-medium">
                      {formData.admission_term} {formData.admission_year}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border-t pt-4 bg-amber-50 p-3 rounded">
                <p className="text-xs font-medium text-amber-900 mb-1">Edit Reason:</p>
                <p className="text-xs text-amber-800">{formData.edit_reason}</p>
              </div>

              <p className="text-xs text-destructive font-medium">
                ⚠️ This edit will be logged and permanently recorded in the audit trail.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEdit} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Confirm Edit & Log'
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
