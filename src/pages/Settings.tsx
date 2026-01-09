import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Grade } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cachedDataService } from '@/lib/cached-data-service';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const gradesData = await cachedDataService.getGrades();
      setGrades(gradesData);
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeeChange = (gradeId: string, newFee: string) => {
    setGrades(grades.map(grade =>
      grade.id === gradeId
        ? { ...grade, fee_per_term: parseFloat(newFee) || 0 }
        : grade
    ));
  };

  const handleCapacityChange = (gradeId: string, newCapacity: string) => {
    setGrades(grades.map(grade =>
      grade.id === gradeId
        ? { ...grade, capacity: parseInt(newCapacity) || 0 }
        : grade
    ));
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Only admins can update settings');
      return;
    }

    setIsSaving(true);
    try {
      for (const grade of grades) {
        const { error } = await supabase
          .from('grades')
          .update({
            fee_per_term: grade.fee_per_term,
            capacity: grade.capacity,
          })
          .eq('id', grade.id);

        if (error) throw error;
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
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
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage grades, fees, and system configuration</p>
        </div>

        {/* Grades & Fees */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Grades & Fee Structure</h2>
            {isAdmin && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border-2 border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted">
                      <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                        Grade
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                        Fee per Term
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                        Capacity
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{grade.name}</td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              value={grade.fee_per_term}
                              onChange={(e) => handleFeeChange(grade.id, e.target.value)}
                              className="w-32 border-2"
                            />
                          ) : (
                            formatCurrency(grade.fee_per_term)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <Input
                              type="number"
                              min="1"
                              value={grade.capacity}
                              onChange={(e) => handleCapacityChange(grade.id, e.target.value)}
                              className="w-24 border-2"
                            />
                          ) : (
                            grade.capacity
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs font-medium uppercase ${
                            grade.active 
                              ? 'bg-chart-2/10 text-chart-2' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {grade.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        {!isAdmin && (
          <div className="border-2 border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Only administrators can modify grade settings and fees.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
