import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Download, Search, Users, Loader2, CheckCircle, XCircle, AlertCircle, Trash2, UserPlus, Pencil, Check, X } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BulkVolunteerUploadProps {
  onBack: () => void;
}

interface VolunteerEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  gender?: string;
  companyName?: string;
  isDhEmployee?: boolean;
  status: 'pending' | 'creating' | 'success' | 'error' | 'exists';
  errorMessage?: string;
}

interface EditingState {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const ITEMS_PER_PAGE = 10;

const SAMPLE_CSV_CONTENT = `first_name,last_name,email,event_name,event_date,event_time,event_location,gender,company_name,is_dh_employee
John,Doe,john.doe@company.com,Stronger Together Marketplace,Saturday February 21 2026,7:30AM - 11:30AM,Dubai Al Twar,Male,Tech Corp,No
Jane,Smith,jane.smith@company.com,Community Give Back,Sunday February 22 2026,9:00AM - 1:00PM,Abu Dhabi,Female,Dubai Holding,Yes
Ahmed,Ali,ahmed.ali@company.com,Stronger Together Marketplace,Saturday February 21 2026,7:30AM - 11:30AM,Dubai Al Twar,Male,External Partner,No`;

export const BulkVolunteerUpload = ({ onBack }: BulkVolunteerUploadProps) => {
  const [volunteers, setVolunteers] = useState<VolunteerEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingEntry, setEditingEntry] = useState<EditingState | null>(null);
  const { toast } = useToast();
  const { signOut } = useAuth();

  // Generate unique ID for each entry
  const generateId = () => `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Parse CSV content with proper handling of quoted fields
  const parseCSV = useCallback((content: string): VolunteerEntry[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse CSV line handling quoted fields with commas and escaped quotes
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      let cleanLine = line.trim();
      
      // Detect if the entire line is wrapped in quotes (common Excel export issue)
      // Check if it starts and ends with quotes and parsing would yield only 1 field
      if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
        // Try to unwrap - remove outer quotes and unescape internal quotes
        const innerContent = cleanLine.slice(1, -1).replace(/""/g, '"');
        
        // Check if this looks like a comma-separated list
        // by testing if it has multiple commas and roughly matches expected field count
        const commaCount = (innerContent.match(/,/g) || []).length;
        if (commaCount >= 5) {
          // Likely the entire row was wrapped in quotes - use inner content
          cleanLine = innerContent;
        }
      }
      
      for (let i = 0; i < cleanLine.length; i++) {
        const char = cleanLine[i];
        const nextChar = cleanLine[i + 1];
        
        if (char === '"') {
          // Handle escaped quotes ("") inside quoted fields
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip the next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      
      // Safety check: if we got exactly 1 result and it contains commas,
      // it might still be a wrapped line - try parsing it again
      if (result.length === 1 && result[0].includes(',')) {
        const innerResult = parseCSVLine(result[0]);
        if (innerResult.length > 1) {
          return innerResult;
        }
      }
      
      return result;
    };

    const headers = parseCSVLine(lines[0].toLowerCase());
    const firstNameIdx = headers.findIndex(h => h.includes('first') && h.includes('name') || h === 'firstname' || h === 'first_name');
    const lastNameIdx = headers.findIndex(h => h.includes('last') && h.includes('name') || h === 'lastname' || h === 'last_name');
    const emailIdx = headers.findIndex(h => h.includes('email') || h === 'e-mail');
    const eventNameIdx = headers.findIndex(h => h.includes('event') && h.includes('name') || h === 'event_name');
    const eventDateIdx = headers.findIndex(h => h.includes('event') && h.includes('date') || h === 'event_date');
    const eventTimeIdx = headers.findIndex(h => h.includes('event') && h.includes('time') || h === 'event_time');
    const eventLocationIdx = headers.findIndex(h => h.includes('event') && h.includes('location') || h === 'event_location' || h === 'location');
    const genderIdx = headers.findIndex(h => h === 'gender' || h.includes('gender'));
    const companyNameIdx = headers.findIndex(h => h.includes('company') && h.includes('name') || h === 'company_name' || h === 'company');
    const isDhEmployeeIdx = headers.findIndex(h => h.includes('dh_employee') || h.includes('is_employee') || h === 'is_dh_employee');

    if (emailIdx === -1) {
      toast({
        title: 'Invalid CSV Format',
        description: 'CSV must contain an email column',
        variant: 'destructive',
      });
      return [];
    }

    const entries: VolunteerEntry[] = [];
    const seenEmails = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const email = values[emailIdx]?.toLowerCase().trim();

      if (!email || !isValidEmail(email)) continue;
      if (seenEmails.has(email)) continue;

      const isDhEmployeeValue = isDhEmployeeIdx >= 0 ? values[isDhEmployeeIdx]?.toLowerCase() : '';
      const isDhEmployee = isDhEmployeeValue === 'yes' || isDhEmployeeValue === 'true' || isDhEmployeeValue === '1';

      seenEmails.add(email);
      entries.push({
        id: generateId(),
        firstName: firstNameIdx >= 0 ? values[firstNameIdx] || '' : '',
        lastName: lastNameIdx >= 0 ? values[lastNameIdx] || '' : '',
        email,
        eventName: eventNameIdx >= 0 ? values[eventNameIdx] || undefined : undefined,
        eventDate: eventDateIdx >= 0 ? values[eventDateIdx] || undefined : undefined,
        eventTime: eventTimeIdx >= 0 ? values[eventTimeIdx] || undefined : undefined,
        eventLocation: eventLocationIdx >= 0 ? values[eventLocationIdx] || undefined : undefined,
        gender: genderIdx >= 0 ? values[genderIdx] || undefined : undefined,
        companyName: companyNameIdx >= 0 ? values[companyNameIdx] || undefined : undefined,
        isDhEmployee,
        status: 'pending',
      });
    }

    return entries;
  }, [toast]);

  // Handle file upload
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseCSV(content);
      setVolunteers(parsed);
      setCurrentPage(1);
      setIsUploading(false);
      if (parsed.length > 0) {
        toast({
          title: 'CSV Uploaded',
          description: `Found ${parsed.length} volunteer entries`,
        });
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast({
        title: 'Upload Failed',
        description: 'Failed to read the file',
        variant: 'destructive',
      });
    };
    reader.readAsText(file);
  }, [parseCSV, toast]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  // Download sample CSV
  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'volunteer_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Template Downloaded',
      description: 'Fill in the template and upload it back',
    });
  };

  // Create bulk users
  const handleCreateBulkUsers = async () => {
    const pendingVolunteers = volunteers.filter(v => v.status === 'pending');
    if (pendingVolunteers.length === 0) {
      toast({
        title: 'No Pending Volunteers',
        description: 'All volunteers have already been processed',
      });
      return;
    }

    setIsCreating(true);

    // Mark all pending as creating
    setVolunteers(prev => prev.map(v => 
      v.status === 'pending' ? { ...v, status: 'creating' as const } : v
    ));

    try {
      const { data, error } = await supabase.functions.invoke('bulk-create-volunteers', {
        body: {
          volunteers: pendingVolunteers.map(v => ({
            email: v.email,
            firstName: v.firstName,
            lastName: v.lastName,
            eventName: v.eventName,
            eventDate: v.eventDate,
            eventTime: v.eventTime,
            eventLocation: v.eventLocation,
            gender: v.gender,
            companyName: v.companyName,
            isDhEmployee: v.isDhEmployee,
          })),
        },
      });

      if (error) throw error;

      // Update statuses based on results
      const results = data?.results || [];
      setVolunteers(prev => prev.map(v => {
        const result = results.find((r: any) => r.email.toLowerCase() === v.email.toLowerCase());
        if (!result) return v;
        
        if (result.status === 'created') {
          return { ...v, status: 'success' as const };
        } else if (result.status === 'exists') {
          return { ...v, status: 'exists' as const };
        } else {
          return { ...v, status: 'error' as const, errorMessage: result.error || 'Failed to create' };
        }
      }));

      const created = results.filter((r: any) => r.status === 'created').length;
      const exists = results.filter((r: any) => r.status === 'exists').length;
      const failed = results.filter((r: any) => r.status === 'error').length;

      toast({
        title: 'Bulk Creation Complete',
        description: `Created: ${created}, Already exists: ${exists}, Failed: ${failed}`,
      });
    } catch (error) {
      console.error('Bulk creation error:', error);
      setVolunteers(prev => prev.map(v => 
        v.status === 'creating' ? { ...v, status: 'error' as const, errorMessage: 'Request failed' } : v
      ));
      toast({
        title: 'Bulk Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create volunteers',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Remove entry
  const removeEntry = (id: string) => {
    setVolunteers(prev => prev.filter(v => v.id !== id));
  };

  // Start editing an entry
  const startEditing = (volunteer: VolunteerEntry) => {
    setEditingEntry({
      id: volunteer.id,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      email: volunteer.email,
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingEntry(null);
  };

  // Save edited entry
  const saveEditing = () => {
    if (!editingEntry) return;

    // Validate email
    if (!isValidEmail(editingEntry.email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate email (excluding current entry)
    const isDuplicate = volunteers.some(
      v => v.id !== editingEntry.id && v.email.toLowerCase() === editingEntry.email.toLowerCase()
    );
    if (isDuplicate) {
      toast({
        title: 'Duplicate Email',
        description: 'This email already exists in the list',
        variant: 'destructive',
      });
      return;
    }

    setVolunteers(prev => prev.map(v => 
      v.id === editingEntry.id
        ? { ...v, firstName: editingEntry.firstName.trim(), lastName: editingEntry.lastName.trim(), email: editingEntry.email.trim().toLowerCase() }
        : v
    ));
    setEditingEntry(null);
    toast({
      title: 'Entry Updated',
      description: 'Volunteer entry has been updated',
    });
  };

  // Clear all
  const clearAll = () => {
    setVolunteers([]);
    setCurrentPage(1);
    setSearchQuery('');
    setStatusFilter('all');
    setEditingEntry(null);
  };

  // Filter and search
  const filteredVolunteers = useMemo(() => {
    return volunteers.filter(v => {
      const matchesSearch = 
        v.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [volunteers, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredVolunteers.length / ITEMS_PER_PAGE);
  const paginatedVolunteers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVolunteers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVolunteers, currentPage]);

  // Stats
  const stats = useMemo(() => ({
    total: volunteers.length,
    pending: volunteers.filter(v => v.status === 'pending').length,
    success: volunteers.filter(v => v.status === 'success').length,
    exists: volunteers.filter(v => v.status === 'exists').length,
    error: volunteers.filter(v => v.status === 'error').length,
  }), [volunteers]);

  const getStatusBadge = (status: VolunteerEntry['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-muted">Pending</Badge>;
      case 'creating':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />Creating
        </Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">
          <CheckCircle className="w-3 h-3 mr-1" />Created
        </Badge>;
      case 'exists':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          <AlertCircle className="w-3 h-3 mr-1" />Exists
        </Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="w-3 h-3 mr-1" />Failed
        </Badge>;
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <BrandLogo size="md" />
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">GIF (Gift it Forward)</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Bulk Volunteer Upload</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Back Button */}
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Volunteer CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex-1 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Processing file...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag & drop your CSV file here, or
                    </p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <span className="text-sm text-primary hover:underline cursor-pointer">
                        browse to upload
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Sample Download */}
              <div className="flex flex-col justify-center gap-3 md:w-64">
                <p className="text-sm text-muted-foreground text-center md:text-left">
                  Need a template? Download our sample CSV file to share with partner companies.
                </p>
                <Button variant="outline" onClick={downloadSampleCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volunteers List */}
        {volunteers.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Volunteers ({filteredVolunteers.length})
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={clearAll}
                    disabled={isCreating}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleCreateBulkUsers}
                    disabled={isCreating || stats.pending === 0}
                    className="gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Create Bulk Users ({stats.pending})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <span className="text-muted-foreground">Total: <strong>{stats.total}</strong></span>
                <span className="text-muted-foreground">Pending: <strong className="text-foreground">{stats.pending}</strong></span>
                <span className="text-success">Created: <strong>{stats.success}</strong></span>
                <span className="text-warning">Exists: <strong>{stats.exists}</strong></span>
                <span className="text-destructive">Failed: <strong>{stats.error}</strong></span>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="success">Created</SelectItem>
                    <SelectItem value="exists">Exists</SelectItem>
                    <SelectItem value="error">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {/* Mobile card view */}
              <div className="md:hidden divide-y divide-border">
                <AnimatePresence mode="popLayout">
                  {paginatedVolunteers.map((volunteer) => {
                    const isEditing = editingEntry?.id === volunteer.id;
                    const canEdit = volunteer.status === 'pending' || volunteer.status === 'error';

                    return (
                      <motion.div
                        key={volunteer.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="p-3 flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input value={editingEntry.firstName} onChange={(e) => setEditingEntry({ ...editingEntry, firstName: e.target.value })} placeholder="First" className="h-8 text-sm" />
                                <Input value={editingEntry.lastName} onChange={(e) => setEditingEntry({ ...editingEntry, lastName: e.target.value })} placeholder="Last" className="h-8 text-sm" />
                              </div>
                              <Input value={editingEntry.email} onChange={(e) => setEditingEntry({ ...editingEntry, email: e.target.value })} placeholder="Email" className="h-8 text-sm" />
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-sm truncate">{volunteer.firstName} {volunteer.lastName}</p>
                              <p className="text-xs text-muted-foreground truncate">{volunteer.email}</p>
                            </>
                          )}
                          <div className="mt-1">{getStatusBadge(volunteer.status)}</div>
                          {volunteer.errorMessage && <span className="text-xs text-destructive">{volunteer.errorMessage}</span>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={saveEditing} className="h-8 w-8"><Check className="w-4 h-4 text-success" /></Button>
                              <Button variant="ghost" size="icon" onClick={cancelEditing} className="h-8 w-8"><X className="w-4 h-4" /></Button>
                            </>
                          ) : (
                            <>
                              {canEdit && <Button variant="ghost" size="icon" onClick={() => startEditing(volunteer)} disabled={volunteer.status === 'creating'} className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>}
                              <Button variant="ghost" size="icon" onClick={() => removeEntry(volunteer.id)} disabled={volunteer.status === 'creating'} className="h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {paginatedVolunteers.map((volunteer) => {
                        const isEditing = editingEntry?.id === volunteer.id;
                        const canEdit = volunteer.status === 'pending' || volunteer.status === 'error';

                        return (
                          <motion.tr
                            key={volunteer.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="border-b"
                          >
                            <TableCell className="font-medium">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <Input value={editingEntry.firstName} onChange={(e) => setEditingEntry({ ...editingEntry, firstName: e.target.value })} placeholder="First name" className="h-8 w-24" />
                                  <Input value={editingEntry.lastName} onChange={(e) => setEditingEntry({ ...editingEntry, lastName: e.target.value })} placeholder="Last name" className="h-8 w-24" />
                                </div>
                              ) : (
                                <>{volunteer.firstName} {volunteer.lastName}</>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {isEditing ? (
                                <Input value={editingEntry.email} onChange={(e) => setEditingEntry({ ...editingEntry, email: e.target.value })} placeholder="Email" className="h-8 w-48" />
                              ) : (
                                volunteer.email
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(volunteer.status)}
                                {volunteer.errorMessage && (
                                  <span className="text-xs text-destructive">{volunteer.errorMessage}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {isEditing ? (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={saveEditing} className="h-8 w-8"><Check className="w-4 h-4 text-success" /></Button>
                                    <Button variant="ghost" size="icon" onClick={cancelEditing} className="h-8 w-8"><X className="w-4 h-4 text-muted-foreground" /></Button>
                                  </>
                                ) : (
                                  <>
                                    {canEdit && (
                                      <Button variant="ghost" size="icon" onClick={() => startEditing(volunteer)} disabled={volunteer.status === 'creating'} className="h-8 w-8"><Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" /></Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => removeEntry(volunteer.id)} disabled={volunteer.status === 'creating'} className="h-8 w-8"><Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /></Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {paginatedVolunteers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No volunteers match your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};
