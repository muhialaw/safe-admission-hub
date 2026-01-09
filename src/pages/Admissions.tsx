import { useState, useEffect } from 'react';
import { Loader2, Plus, Search, WifiOff, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Grade, Student } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { generateLocalId, isOnline, offlineDb } from '@/lib/offline-db';

interface Guardian {
  id: string;
  name: string;
  phone: string;
  area: string;
  isEmergency: boolean;
}

interface AdmissionFormData {
  // Basic Info
  name: string;
  dob: string;
  gradeId: string;
  admissionTerm: string;
  admissionYear: number;
  // Healthcare
  allergies: string;
  medicalConditions: string;
  // Guardians
  guardians: Guardian[];
}

export default function Admissions() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const { addOfflineStudent, isOffline } = useOfflineSync();
  
  // Form state
  const [formData, setFormData] = useState<AdmissionFormData>({
    name: '',
    dob: '',
    gradeId: '',
    admissionTerm: 'Term 1',
    admissionYear: new Date().getFullYear(),
    allergies: '',
    medicalConditions: '',
    guardians: [],
  });

  // Temporary guardian form for adding
  const [tempGuardian, setTempGuardian] = useState<Partial<Guardian>>({
    name: '',
    phone: '',
    area: '',
    isEmergency: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [studentsRes, gradesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*, grade:grades(*)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('grades')
          .select('*')
          .eq('active', true)
          .order('name'),
      ]);

      if (studentsRes.data) setStudents(studentsRes.data as unknown as Student[]);
      if (gradesRes.data) setGrades(gradesRes.data as Grade[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGuardian = () => {
    if (!tempGuardian.name?.trim()) {
      toast.error('Guardian name is required');
      return;
    }

    const newGuardian: Guardian = {
      id: generateLocalId(),
      name: tempGuardian.name,
      phone: tempGuardian.phone || '',
      area: tempGuardian.area || '',
      isEmergency: tempGuardian.isEmergency || false,
    };

    setFormData({
      ...formData,
      guardians: [...formData.guardians, newGuardian],
    });

    setTempGuardian({
      name: '',
      phone: '',
      area: '',
      isEmergency: false,
    });

    toast.success('Guardian added');
  };

  const handleRemoveGuardian = (id: string) => {
    setFormData({
      ...formData,
      guardians: formData.guardians.filter((g) => g.id !== id),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Student name is required');
      return;
    }

    if (formData.guardians.length === 0) {
      toast.error('At least one guardian is required');
      return;
    }

    setIsSubmitting(true);

    // If offline, save locally
    if (!isOnline()) {
      try {
        await addOfflineStudent({
          localId: generateLocalId(),
          name: formData.name,
          dob: formData.dob || null,
          gradeId: formData.gradeId || null,
          admissionTerm: formData.admissionTerm,
          admissionYear: formData.admissionYear,
          guardianName: formData.guardians[0]?.name || null,
          guardianPhone: formData.guardians[0]?.phone || null,
          guardianArea: formData.guardians[0]?.area || null,
        });

        toast.success('Student saved offline. Will sync when online.');
        setIsDialogOpen(false);
        resetForm();
      } catch (error) {
        console.error('Error saving offline:', error);
        toast.error('Failed to save offline');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      // Insert student (student_id will be auto-generated by trigger)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          student_id: '',
          name: formData.name,
          dob: formData.dob || null,
          grade_id: formData.gradeId || null,
          admission_term: formData.admissionTerm,
          admission_year: formData.admissionYear,
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // Insert guardians
      const guardianInserts = formData.guardians.map((guardian) => ({
        student_id: student.id,
        name: guardian.name,
        phone: guardian.phone || null,
        area: guardian.area || null,
        is_emergency: guardian.isEmergency,
      }));

      const { error: guardiansError } = await supabase
        .from('guardians')
        .insert(guardianInserts);

      if (guardiansError) throw guardiansError;

      toast.success(`Student ${student.student_id} admitted successfully`);
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating admission:', error);
      toast.error('Failed to create admission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      dob: '',
      gradeId: '',
      admissionTerm: 'Term 1',
      admissionYear: new Date().getFullYear(),
      allergies: '',
      medicalConditions: '',
      guardians: [],
    });
    setTempGuardian({
      name: '',
      phone: '',
      area: '',
      isEmergency: false,
    });
    setCurrentStep(0);
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admissions</h1>
            <p className="text-muted-foreground">
              Register new students
              {isOffline && (
                <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </span>
              )}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Admission
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  New Student Admission
                  {isOffline && (
                    <span className="ml-2 text-sm font-normal text-destructive">
                      (Offline Mode)
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Complete the multi-step admission form. Use Next to continue.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                {/* Step Indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${currentStep >= 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        1
                      </div>
                      <span className="text-sm font-medium">Basic Info</span>
                    </div>
                    <div className={`flex-1 h-1 mx-2 ${currentStep >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      2
                    </div>
                    <span className="text-sm font-medium">Healthcare</span>
                    <div className={`flex-1 h-1 mx-2 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      3
                    </div>
                    <span className="text-sm font-medium">Guardians</span>
                  </div>
                </div>

                {/* Step 1: Basic Info */}
                {currentStep === 0 && (
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Student Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter full name"
                        required
                        className="border-2"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={formData.dob}
                          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                          className="border-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="grade">Grade</Label>
                        <Select
                          value={formData.gradeId}
                          onValueChange={(value) => setFormData({ ...formData, gradeId: value })}
                        >
                          <SelectTrigger className="border-2">
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {grades.map((grade) => (
                              <SelectItem key={grade.id} value={grade.id}>
                                {grade.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="term">Admission Term</Label>
                        <Select
                          value={formData.admissionTerm}
                          onValueChange={(value) => setFormData({ ...formData, admissionTerm: value })}
                        >
                          <SelectTrigger className="border-2">
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
                        <Label htmlFor="year">Admission Year</Label>
                        <Input
                          id="year"
                          type="number"
                          value={formData.admissionYear}
                          onChange={(e) => setFormData({ ...formData, admissionYear: parseInt(e.target.value) })}
                          className="border-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Healthcare */}
                {currentStep === 1 && (
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">Optional health information</p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="allergies">Allergies</Label>
                      <Textarea
                        id="allergies"
                        value={formData.allergies}
                        onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                        placeholder="List any known allergies (e.g., peanuts, milk, etc.)"
                        className="border-2 min-h-24"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="medical">Medical Conditions</Label>
                      <Textarea
                        id="medical"
                        value={formData.medicalConditions}
                        onChange={(e) => setFormData({ ...formData, medicalConditions: e.target.value })}
                        placeholder="List any medical conditions or medications (e.g., asthma, diabetes, etc.)"
                        className="border-2 min-h-24"
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Guardians */}
                {currentStep === 2 && (
                  <div className="space-y-4 mt-4">
                    <div className="space-y-4 p-3 bg-muted rounded-lg">
                      <h3 className="font-medium">Add Guardian/Parent</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="guardianName">Name *</Label>
                        <Input
                          id="guardianName"
                          value={tempGuardian.name || ''}
                          onChange={(e) => setTempGuardian({ ...tempGuardian, name: e.target.value })}
                          placeholder="Guardian name"
                          className="border-2"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="guardianPhone">Phone</Label>
                          <Input
                            id="guardianPhone"
                            value={tempGuardian.phone || ''}
                            onChange={(e) => setTempGuardian({ ...tempGuardian, phone: e.target.value })}
                            placeholder="Phone number"
                            className="border-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="guardianArea">Area/Location</Label>
                          <Input
                            id="guardianArea"
                            value={tempGuardian.area || ''}
                            onChange={(e) => setTempGuardian({ ...tempGuardian, area: e.target.value })}
                            placeholder="Area or location"
                            className="border-2"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="emergency"
                          checked={tempGuardian.isEmergency || false}
                          onCheckedChange={(checked) =>
                            setTempGuardian({ ...tempGuardian, isEmergency: !!checked })
                          }
                        />
                        <Label htmlFor="emergency" className="font-normal cursor-pointer">
                          Mark as emergency contact
                        </Label>
                      </div>

                      <Button
                        type="button"
                        variant="default"
                        onClick={handleAddGuardian}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Guardian
                      </Button>
                    </div>

                    {/* Guardians List */}
                    {formData.guardians.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-medium text-sm">Added Guardians ({formData.guardians.length})</h3>
                        <div className="space-y-2">
                          {formData.guardians.map((guardian) => (
                            <div
                              key={guardian.id}
                              className="flex items-start justify-between gap-3 p-3 bg-card border-2 border-border rounded-lg"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{guardian.name}</p>
                                {guardian.phone && (
                                  <p className="text-xs text-muted-foreground">{guardian.phone}</p>
                                )}
                                {guardian.area && (
                                  <p className="text-xs text-muted-foreground">{guardian.area}</p>
                                )}
                                {guardian.isEmergency && (
                                  <p className="text-xs text-orange-600 font-medium mt-1">
                                    Emergency Contact
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveGuardian(guardian.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {formData.guardians.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Add at least one guardian to continue
                      </div>
                    )}
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-between gap-2 pt-6 border-t mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (currentStep > 0) {
                        setCurrentStep(currentStep - 1);
                      } else {
                        setIsDialogOpen(false);
                        resetForm();
                      }
                    }}
                  >
                    {currentStep === 0 ? 'Cancel' : 'Previous'}
                  </Button>

                  {currentStep < 2 && (
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Next
                    </Button>
                  )}

                  {currentStep === 2 && (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : isOffline ? (
                        'Save Offline'
                      ) : (
                        'Register Student'
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-2 pl-10"
          />
        </div>

        {/* Students Table */}
        <div className="border-2 border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No students found' : 'No admissions yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border bg-muted">
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Student ID
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Grade
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Age
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wide">
                      Admitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-sm">{student.student_id}</td>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3">{student.grade?.name || '—'}</td>
                      <td className="px-4 py-3">{student.age_cached ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {format(new Date(student.created_at), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
