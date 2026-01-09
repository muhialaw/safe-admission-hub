import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, GripVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { GradeTerm } from '@/types/database';
import { toast } from 'sonner';
import { cachedDataService } from '@/lib/cached-data-service';

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
  const [draggedTerm, setDraggedTerm] = useState<GradeTerm | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GradeTerm | null>(null);
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
      const gradeTerms = await cachedDataService.getGradeTermsByGrade(gradeId, academicYear);
      setTerms(gradeTerms);
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

      if (editingTerm) {
        // Update existing term
        const { error } = await supabase
          .from('grade_terms')
          .update({
            term_name: formData.term_name.trim(),
            fee_amount: feeAmount,
          })
          .eq('id', editingTerm.id);

        if (error) throw error;
        toast.success(`${formData.term_name} updated successfully`);
      } else {
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
      }

      setFormData({
        term_name: '',
        term_order: terms.length + 1,
        fee_amount: '',
      });
      setEditingTerm(null);
      setIsDialogOpen(false);
      fetchTerms();
    } catch (error) {
      console.error('Error saving term:', error);
      toast.error('Failed to save term');
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

  const handleDragStart = (term: GradeTerm) => {
    setDraggedTerm(term);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-muted/50');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.currentTarget.classList.remove('bg-muted/50');
  };

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetTerm: GradeTerm) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-muted/50');

    if (!draggedTerm || draggedTerm.id === targetTerm.id) return;

    setIsUpdatingOrder(true);
    try {
      // Swap the order values
      const draggedOrder = draggedTerm.term_order;
      const targetOrder = targetTerm.term_order;

      // Update both terms
      await Promise.all([
        supabase
          .from('grade_terms')
          .update({ term_order: targetOrder })
          .eq('id', draggedTerm.id),
        supabase
          .from('grade_terms')
          .update({ term_order: draggedOrder })
          .eq('id', targetTerm.id),
      ]);

      toast.success('Term order updated');
      fetchTerms();
    } catch (error) {
      console.error('Error updating term order:', error);
      toast.error('Failed to update term order');
    } finally {
      setIsUpdatingOrder(false);
      setDraggedTerm(null);
    }
  };

  const openEditTerm = (term: GradeTerm) => {
    setEditingTerm(term);
    setFormData({
      term_name: term.term_name,
      term_order: term.term_order,
      fee_amount: term.fee_amount.toString(),
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      term_name: '',
      term_order: terms.length + 1,
      fee_amount: '',
    });
    setEditingTerm(null);
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
              <DialogTitle>{editingTerm ? `Edit ${editingTerm.term_name}` : `Add Term for ${gradeName}`}</DialogTitle>
              <DialogDescription>{editingTerm ? 'Update term details and fee amount' : 'Define fee amount for a specific term'}</DialogDescription>
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
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingTerm ? 'Update Term' : 'Add Term'
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
                <th className="w-8 px-4 py-3 text-center text-sm font-medium"></th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase">Term</th>
                <th className="px-4 py-3 text-left text-sm font-medium uppercase">Fee Amount</th>
                <th className="px-4 py-3 text-right text-sm font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr
                  key={term.id}
                  draggable
                  onDragStart={() => handleDragStart(term)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, term)}
                  className="border-b border-border last:border-0 cursor-move hover:bg-muted/30 transition-colors"
                >
                  <td className="w-8 px-2 py-3 text-center text-muted-foreground">
                    <GripVertical className="h-4 w-4 mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{term.term_name}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatCurrency(term.fee_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditTerm(term)}
                        disabled={isUpdatingOrder}
                        className="text-blue-600 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTerm(term.id, term.term_name)}
                        disabled={isUpdatingOrder}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isUpdatingOrder && (
            <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/50">
              Updating term order...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
