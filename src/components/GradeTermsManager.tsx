import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { GradeTerm } from '@/types/database';
import { toast } from 'sonner';

interface GradeTermsManagerProps {
  gradeId: string;
  gradeName: string;
  academicYear?: number;
}

export function GradeTermsManager({ gradeId, gradeName, academicYear = new Date().getFullYear() }: GradeTermsManagerProps) {
  const [terms, setTerms] = useState<GradeTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    term_name: '',
    term_order: 1,
    fee_amount: '',
  });

  useEffect(() => {
    if (!gradeId || !academicYear) return;
    fetchTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, academicYear]);

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('grade_terms')
        .select('*')
        .eq('grade_id', gradeId)
        .eq('academic_year', academicYear)
        .eq('is_active', true)
        .order('term_order');

      if (error) throw error;
      setTerms(data as unknown as GradeTerm[]);
    } catch (error) {
      console.error('Error fetching grade terms:', error);
      toast.error('Failed to load terms');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const feeAmount = parseFloat(String(formData.fee_amount).replace(/[,\sKShksh$£€]/g, '').replace(/[^0-9.-]/g, ''));
      
      if (!formData.term_name.trim()) {
        toast.error('Enter term name');
        setIsSubmitting(false);
        return;
      }

      if (isNaN(feeAmount) || feeAmount <= 0) {
        toast.error('Enter a valid fee amount');
        setIsSubmitting(false);
        return;
      }

      // Check if term already exists
      const { data: existing } = await supabase
        .from('grade_terms')
        .select('id')
        .eq('grade_id', gradeId)
        .eq('term_name', formData.term_name.trim())
        .eq('academic_year', academicYear)
        .maybeSingle();

      if (existing) {
        toast.error('This term already exists for this academic year');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('grade_terms').insert({
        grade_id: gradeId,
        term_name: formData.term_name.trim(),
        term_order: formData.term_order,
        fee_amount: feeAmount,
        academic_year: academicYear,
        is_active: true,
      });

      if (error) throw error;

      toast.success(`${formData.term_name} added successfully`);
      setFormData({
        term_name: '',
        term_order: terms.length + 1,
        fee_amount: '',
      });
      setIsDialogOpen(false);
      fetchTerms();
    } catch (error) {
      console.error('Error creating term:', error);
      toast.error('Failed to add term');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTerm = async (termId: string, termName: string) => {
    if (!window.confirm(`Delete ${termName}? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('grade_terms')
        .update({ is_active: false })
        .eq('id', termId);

      if (error) throw error;
      toast.success('Term deleted');
      fetchTerms();
    } catch (error) {
      console.error('Error deleting term:', error);
      toast.error('Failed to delete term');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{gradeName} - Fee Structure</h3>
          <p className="text-sm text-muted-foreground">Academic Year {academicYear}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Term for {gradeName}</DialogTitle>
              <DialogDescription>Define fee amount for a specific term</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="term_name">Term Name *</Label>
                <Input
                  id="term_name"
                  placeholder="e.g., Term 1, Term 2, Term 3"
                  value={formData.term_name}
                  onChange={(e) => setFormData({ ...formData, term_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="term_order">Term Order</Label>
                <Input
                  id="term_order"
                  type="number"
                  min="1"
                  value={formData.term_order}
                  onChange={(e) => setFormData({ ...formData, term_order: parseInt(e.target.value || '1') })}
                />
                <p className="text-xs text-muted-foreground">Used to sort terms chronologically</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fee_amount">Fee Amount (KES) *</Label>
                <Input
                  id="fee_amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 15000"
                  value={formData.fee_amount}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
                    setFormData({ ...formData, fee_amount: cleaned });
                  }}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Term'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : terms.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <p>No terms defined yet</p>
          <p className="text-sm">Click "Add Term" to create the first term for this grade</p>
        </div>
      ) : (
        <div className="border-2 border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-muted">
                <th className="px-4 py-3 text-left text-sm font-medium uppercase">Term</th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase">Fee Amount</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{term.term_name}</p>
                    <p className="text-xs text-muted-foreground">Order: {term.term_order}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatCurrency(term.fee_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTerm(term.id, term.term_name)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
