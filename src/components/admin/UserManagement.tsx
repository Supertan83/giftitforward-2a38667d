import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, UserPlus, Loader2, Shield, User, Mail, Lock, Trash2, Pencil, Briefcase, QrCode, MapPin, LogIn, ShoppingBag, LogOut, AlertTriangle, Trash, Phone, Calendar, Building2, Hash, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRole, useGenerateVolunteerQR, useUpdateVolunteerAssignment, useMarketplaces, UserWithRole, useCleanupOrphans, OrphanCleanupResult } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { z } from 'zod';
import { Plus } from 'lucide-react';

interface UserManagementProps {
  onBack: () => void;
}

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'volunteer', 'employee'], { required_error: 'Please select a role' }),
});

type VolunteerZone = 'entrance' | 'marketplace' | 'exit';

type RoleFilter = 'all' | 'admin' | 'employee' | 'volunteer';

export const UserManagement = ({ onBack }: UserManagementProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; email: string } | null>(null);
  const [qrPreviewUser, setQrPreviewUser] = useState<UserWithRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'volunteer' | 'employee'>('volunteer');
  const [editRole, setEditRole] = useState<'admin' | 'volunteer' | 'employee'>('volunteer');
  const [editEmail, setEditEmail] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editAssignedZone, setEditAssignedZone] = useState<VolunteerZone | 'none'>('none');
  const [editMarketplaceId, setEditMarketplaceId] = useState<string>('none');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [orphanScanResult, setOrphanScanResult] = useState<OrphanCleanupResult | null>(null);

  const { data: users = [], isLoading } = useUsers();
  const { data: marketplaces = [] } = useMarketplaces();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const updateUserRole = useUpdateUserRole();
  const updateVolunteerAssignment = useUpdateVolunteerAssignment();
  const generateQR = useGenerateVolunteerQR();
  const cleanupOrphans = useCleanupOrphans();
  const { toast } = useToast();

  const availableMarketplaces = marketplaces.filter(m => m.status === 'upcoming' || m.status === 'active');
  
  // Filter users based on selected role
  const filteredUsers = roleFilter === 'all' 
    ? users 
    : users.filter(u => u.role === roleFilter);

  // Pagination
  const pagination = usePagination(filteredUsers, { defaultPageSize: 10 });
  
  // Reset to page 1 when filter changes
  useEffect(() => {
    pagination.setCurrentPage(1);
  }, [roleFilter]);

  const handleGenerateAndPreviewQR = async (user: UserWithRole) => {
    try {
      const result = await generateQR.mutateAsync({
        userId: user.id,
        email: user.email,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined
      });
      
      toast({
        title: result.existing ? 'QR Code Found' : 'QR Code Generated',
        description: result.existing 
          ? `Existing QR code loaded for ${user.first_name || user.email}` 
          : `New QR code created for ${user.first_name || user.email}`,
      });
      
      // Open preview dialog after generation/finding
      setQrPreviewUser({ ...user, qr_codes: [result.unique_id] });
    } catch (error) {
      toast({
        title: 'Failed to Generate QR Code',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = async () => {
    setErrors({});
    
    const result = createUserSchema.safeParse({ email, password, role });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await createUser.mutateAsync({ email, password, role });
      toast({
        title: 'User Created',
        description: `${email} has been created as a ${role}`,
      });
      setShowCreateModal(false);
      setEmail('');
      setPassword('');
      setRole('volunteer');
    } catch (error) {
      toast({
        title: 'Failed to Create User',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    
    try {
      await deleteUser.mutateAsync(deleteConfirmUser.id);
      toast({
        title: 'User Deleted',
        description: `${deleteConfirmUser.email} has been removed`,
      });
      setDeleteConfirmUser(null);
    } catch (error) {
      toast({
        title: 'Failed to Delete User',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditEmail(user.email);
    setEditFirstName(user.first_name || '');
    setEditLastName(user.last_name || '');
    setEditAssignedZone(user.assigned_zone || 'none');
    setEditMarketplaceId(user.marketplace_id || 'none');
  };

  const handleUpdateRole = async () => {
    if (!editUser) return;
    
    try {
      // Update user role, name, and email
      await updateUserRole.mutateAsync({ 
        userId: editUser.id, 
        role: editRole,
        firstName: editFirstName.trim() || undefined,
        lastName: editLastName.trim() || undefined,
        email: editEmail.trim() !== editUser.email ? editEmail.trim() : undefined,
      });

      // If volunteer and has a pending_volunteer_id, update zone/marketplace assignment
      if (editRole === 'volunteer' && editUser.pending_volunteer_id) {
        const zoneValue = editAssignedZone === 'none' ? null : editAssignedZone;
        const marketplaceValue = editMarketplaceId === 'none' ? null : editMarketplaceId;
        
        await updateVolunteerAssignment.mutateAsync({
          pendingVolunteerId: editUser.pending_volunteer_id,
          assignedZone: zoneValue,
          marketplaceId: marketplaceValue,
        });
      }

      toast({
        title: 'User Updated',
        description: `${editFirstName || editUser.email} has been updated`,
      });
      setEditUser(null);
    } catch (error) {
      toast({
        title: 'Failed to Update User',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const adminCount = users.filter(u => u.role === 'admin').length;
  const volunteerCount = users.filter(u => u.role === 'volunteer').length;
  const employeeCount = users.filter(u => u.role === 'employee').length;

  const handleScanOrphans = async () => {
    try {
      const result = await cleanupOrphans.mutateAsync(true); // dryRun = true
      setOrphanScanResult(result);
      setShowCleanupDialog(true);
    } catch (error) {
      toast({
        title: 'Scan Failed',
        description: error instanceof Error ? error.message : 'Failed to scan for orphaned records',
        variant: 'destructive',
      });
    }
  };

  const handleCleanupOrphans = async () => {
    try {
      const result = await cleanupOrphans.mutateAsync(false); // dryRun = false
      toast({
        title: 'Cleanup Complete',
        description: result.message,
      });
      setShowCleanupDialog(false);
      setOrphanScanResult(null);
    } catch (error) {
      toast({
        title: 'Cleanup Failed',
        description: error instanceof Error ? error.message : 'Failed to cleanup orphaned records',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-base md:text-lg truncate">User Management</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage volunteers and admins</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleScanOrphans}
              disabled={cleanupOrphans.isPending}
              className="shrink-0 hidden sm:flex"
            >
              {cleanupOrphans.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash className="w-4 h-4 mr-2" />
              )}
              Cleanup
            </Button>
            <Button onClick={() => setShowCreateModal(true)} size="sm" className="shrink-0">
              <UserPlus className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Add User</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Role Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('all')}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            All Users
            <Badge variant="secondary" className="ml-1 bg-background/50">{users.length}</Badge>
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('admin')}
            className="gap-2"
          >
            <Shield className="w-4 h-4" />
            Admins
            <Badge variant="secondary" className="ml-1 bg-background/50">{adminCount}</Badge>
          </Button>
          <Button
            variant={roleFilter === 'employee' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('employee')}
            className="gap-2"
          >
            <Briefcase className="w-4 h-4" />
            Employees
            <Badge variant="secondary" className="ml-1 bg-background/50">{employeeCount}</Badge>
          </Button>
          <Button
            variant={roleFilter === 'volunteer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('volunteer')}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            Volunteers
            <Badge variant="secondary" className="ml-1 bg-background/50">{volunteerCount}</Badge>
          </Button>
        </div>

        {/* Users List */}
        <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card">
          <div className="p-4 md:p-6 border-b border-border">
            <h2 className="font-display font-bold text-lg">
              {roleFilter === 'all' ? 'All Users' : `${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}s`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredUsers.length} {roleFilter === 'all' ? 'total' : roleFilter} user{filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No {roleFilter === 'all' ? 'users' : `${roleFilter}s`} found</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {pagination.paginatedItems.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        user.role === 'admin' ? 'bg-primary-soft' : user.role === 'employee' ? 'bg-warning/10' : 'bg-muted'
                      }`}>
                        {user.role === 'admin' ? (
                          <Shield className="w-5 h-5 text-primary" />
                        ) : user.role === 'employee' ? (
                          <Briefcase className="w-5 h-5 text-warning" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {user.first_name || user.last_name 
                            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                            : user.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.first_name || user.last_name ? user.email : `Added ${new Date(user.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.role === 'volunteer' && user.qr_codes.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setQrPreviewUser(user)}
                          title="View QR codes"
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                      )}
                      {user.role === 'volunteer' && user.qr_codes.length === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => handleGenerateAndPreviewQR(user)}
                          disabled={generateQR.isPending}
                          title="Generate and preview QR code"
                        >
                          {generateQR.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Plus className="w-3 h-3 mr-1" />
                          )}
                          QR
                        </Button>
                      )}
                      <Badge variant={user.role === 'admin' ? 'default' : user.role === 'employee' ? 'outline' : 'secondary'}>
                        {user.role}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleEditUser(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteConfirmUser({ id: user.id, email: user.email })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="border-t border-border">
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  pageSize={pagination.pageSize}
                  pageSizeOptions={pagination.pageSizeOptions}
                  canGoNext={pagination.canGoNext}
                  canGoPrevious={pagination.canGoPrevious}
                  onPageChange={pagination.setCurrentPage}
                  onPageSizeChange={pagination.setPageSize}
                  onGoToFirst={pagination.goToFirstPage}
                  onGoToLast={pagination.goToLastPage}
                  onGoToNext={pagination.goToNextPage}
                  onGoToPrevious={pagination.goToPreviousPage}
                />
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create New User</DialogTitle>
            <DialogDescription>
              Add a new volunteer or admin to the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'volunteer' | 'employee')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Volunteer
                    </div>
                  </SelectItem>
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Employee
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit User</DialogTitle>
            <DialogDescription>
              Update information for {editUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  placeholder="First name"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  placeholder="Last name"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="editEmail"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="pl-10"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            {/* QR Code ID Section - show for volunteers with QR codes */}
            {editUser?.qr_codes && editUser.qr_codes.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" />
                  QR Code ID
                </Label>
                <div className="space-y-2">
                  {editUser.qr_codes.map((qrId, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={qrId}
                        readOnly
                        className="bg-muted font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(qrId);
                          toast({
                            title: 'Copied',
                            description: 'QR Code ID copied to clipboard',
                          });
                        }}
                      >
                        <span className="sr-only">Copy</span>
                        📋
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volunteer Metadata Section - show for volunteers with extended data */}
            {editUser && (editUser.phone_number || editUser.gender || editUser.external_company || editUser.employee_vertical || editUser.events_list || editUser.events_json) && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <UserCheck className="w-4 h-4" />
                  Volunteer Details (Read-only)
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {editUser.phone_number && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </Label>
                      <p className="text-sm bg-muted rounded px-2 py-1.5 truncate">{editUser.phone_number}</p>
                    </div>
                  )}
                  {editUser.gender && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Gender</Label>
                      <p className="text-sm bg-muted rounded px-2 py-1.5 capitalize">{editUser.gender}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {editUser.external_company && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Company
                      </Label>
                      <p className="text-sm bg-muted rounded px-2 py-1.5 truncate">{editUser.external_company}</p>
                    </div>
                  )}
                  {editUser.employee_vertical && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> Vertical
                      </Label>
                      <p className="text-sm bg-muted rounded px-2 py-1.5 truncate">{editUser.employee_vertical}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {editUser.employee_number && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Employee #
                      </Label>
                      <p className="text-sm bg-muted rounded px-2 py-1.5">{editUser.employee_number}</p>
                    </div>
                  )}
                  {editUser.source && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <Badge variant="outline" className="text-xs">{editUser.source}</Badge>
                    </div>
                  )}
                </div>

                {/* Registered Events from Webhook - with marketplace matching */}
                {(editUser.events_list || editUser.events_json) && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> 
                      Registered Events (from webhook)
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {editUser.events_list 
                          ? editUser.events_list.split(',').length 
                          : Array.isArray(editUser.events_json) 
                            ? editUser.events_json.length 
                            : 0}
                      </Badge>
                    </Label>
                    <div className="space-y-1.5">
                      {editUser.events_list ? (
                        editUser.events_list.split(',').map((eventName, idx) => {
                          const trimmedName = eventName.trim();
                          // Try to match to a marketplace by name
                          const matchedMarketplace = marketplaces.find(m => 
                            m.name.toLowerCase().includes(trimmedName.toLowerCase()) ||
                            trimmedName.toLowerCase().includes(m.name.toLowerCase())
                          );
                          return (
                            <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1.5">
                              <ShoppingBag className="w-3 h-3 text-primary shrink-0" />
                              <span className="text-sm flex-1 truncate">{trimmedName}</span>
                              {matchedMarketplace && (
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {matchedMarketplace.event_date || 'Matched'}
                                </Badge>
                              )}
                            </div>
                          );
                        })
                      ) : editUser.events_json && Array.isArray(editUser.events_json) ? (
                        (editUser.events_json as Array<{event_name?: string; event_slug?: string; event_date?: string; event_time?: string; event_location?: string}>).map((ev, idx) => {
                          const eventName = ev.event_name || ev.event_slug || 'Event';
                          // Try to match to a marketplace by name
                          const matchedMarketplace = marketplaces.find(m => 
                            m.name.toLowerCase().includes(eventName.toLowerCase()) ||
                            eventName.toLowerCase().includes(m.name.toLowerCase())
                          );
                          return (
                            <div key={idx} className="bg-muted/50 rounded-md px-2 py-1.5 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="w-3 h-3 text-primary shrink-0" />
                                <span className="text-sm font-medium flex-1 truncate">{eventName}</span>
                                {matchedMarketplace && (
                                  <Badge variant="default" className="text-[10px] shrink-0">Matched</Badge>
                                )}
                              </div>
                              {(ev.event_date || ev.event_time || ev.event_location) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground pl-5">
                                  {ev.event_date && <span>📅 {ev.event_date}</span>}
                                  {ev.event_time && <span>🕐 {ev.event_time}</span>}
                                  {ev.event_location && <span>📍 {ev.event_location}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">No events registered</span>
                      )}
                    </div>
                  </div>
                )}

                {/* QR Card Marketplace Assignments */}
                {editUser.marketplace_ids && editUser.marketplace_ids.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <QrCode className="w-3 h-3" /> 
                      QR Card Assignments
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {editUser.marketplace_ids.length}
                      </Badge>
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {editUser.marketplace_ids.map((mpId, idx) => {
                        const marketplace = marketplaces.find(m => m.id === mpId);
                        return (
                          <Badge key={idx} variant="outline" className="text-xs gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {marketplace?.name || mpId.slice(0, 8)}
                            {marketplace?.event_date && (
                              <span className="text-muted-foreground">({marketplace.event_date})</span>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as 'admin' | 'volunteer' | 'employee')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Volunteer
                    </div>
                  </SelectItem>
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Employee
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Volunteer Assignment Section - only show for volunteers with QR codes */}
            {editRole === 'volunteer' && editUser?.pending_volunteer_id && (
              <>
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Volunteer Assignment
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Assigned Zone</Label>
                  <Select value={editAssignedZone} onValueChange={(v) => setEditAssignedZone(v as VolunteerZone | 'none')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Not assigned</span>
                      </SelectItem>
                      <SelectItem value="entrance">
                        <div className="flex items-center gap-2">
                          <LogIn className="w-4 h-4 text-primary" />
                          Entrance
                        </div>
                      </SelectItem>
                      <SelectItem value="marketplace">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-warning" />
                          Marketplace
                        </div>
                      </SelectItem>
                      <SelectItem value="exit">
                        <div className="flex items-center gap-2">
                          <LogOut className="w-4 h-4 text-destructive" />
                          Exit
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned Marketplace</Label>
                  <Select value={editMarketplaceId} onValueChange={setEditMarketplaceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select marketplace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Not assigned</span>
                      </SelectItem>
                      {availableMarketplaces.map((mp) => (
                        <SelectItem key={mp.id} value={mp.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {mp.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateRole} 
              disabled={updateUserRole.isPending || updateVolunteerAssignment.isPending}
            >
              {(updateUserRole.isPending || updateVolunteerAssignment.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirmUser?.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Code Preview Dialog */}
      <Dialog open={!!qrPreviewUser} onOpenChange={(open) => !open && setQrPreviewUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Volunteer QR Codes
            </DialogTitle>
            <DialogDescription>
              {qrPreviewUser?.first_name || qrPreviewUser?.last_name 
                ? `${qrPreviewUser?.first_name || ''} ${qrPreviewUser?.last_name || ''}`.trim()
                : qrPreviewUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {qrPreviewUser?.qr_codes.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No QR codes assigned</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {qrPreviewUser?.qr_codes.map((code, index) => (
                  <div key={code} className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-lg">
                      <QRCodeSVG value={code} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {index === 0 ? 'Primary Card' : `Family Member ${index}`}
                      </p>
                      <p className="font-mono text-sm font-medium truncate">{code}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setQrPreviewUser(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cleanup Orphans Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Database Cleanup
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Found orphaned records that can be safely removed:
                </p>
                {orphanScanResult && (
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Orphaned user roles:</span>
                      <Badge variant={orphanScanResult.orphanedUserRoles > 0 ? 'destructive' : 'secondary'}>
                        {orphanScanResult.orphanedUserRoles}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Orphaned QR cards:</span>
                      <Badge variant={orphanScanResult.orphanedVolunteerQRCards > 0 ? 'destructive' : 'secondary'}>
                        {orphanScanResult.orphanedVolunteerQRCards}
                      </Badge>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
                      <span>Total to clean:</span>
                      <span>{orphanScanResult.orphanedUserRoles + orphanScanResult.orphanedVolunteerQRCards}</span>
                    </div>
                  </div>
                )}
                {orphanScanResult && (orphanScanResult.orphanedUserRoles + orphanScanResult.orphanedVolunteerQRCards) === 0 ? (
                  <p className="text-success text-sm">✓ No orphaned records found. Database is clean!</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This will permanently delete these orphaned records. This action cannot be undone.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrphanScanResult(null)}>Cancel</AlertDialogCancel>
            {orphanScanResult && (orphanScanResult.orphanedUserRoles + orphanScanResult.orphanedVolunteerQRCards) > 0 && (
              <AlertDialogAction
                onClick={handleCleanupOrphans}
                disabled={cleanupOrphans.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cleanupOrphans.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Orphaned Records
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
