import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Pencil, Loader2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useOutreachPartners, useOutreachPartnerOperations } from '@/hooks/useOutreachPartners';
import { useToast } from '@/hooks/use-toast';

interface OutreachPartnerManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OutreachPartnerManager = ({ isOpen, onClose }: OutreachPartnerManagerProps) => {
  const [newPartnerName, setNewPartnerName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: partners = [], isLoading } = useOutreachPartners();
  const { createPartner, updatePartner, deletePartner } = useOutreachPartnerOperations();
  const { toast } = useToast();

  const handleAddPartner = async () => {
    if (!newPartnerName.trim()) return;

    try {
      await createPartner.mutateAsync(newPartnerName.trim());
      toast({
        title: 'Partner Added',
        description: `${newPartnerName} has been added`,
      });
      setNewPartnerName('');
    } catch (error) {
      toast({
        title: 'Failed to Add Partner',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      await updatePartner.mutateAsync({ id: editingId, name: editingName.trim() });
      toast({
        title: 'Partner Updated',
        description: 'Partner name has been updated',
      });
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      toast({
        title: 'Failed to Update Partner',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updatePartner.mutateAsync({ id, isActive: !currentActive });
      toast({
        title: currentActive ? 'Partner Deactivated' : 'Partner Activated',
        description: currentActive 
          ? 'Partner will no longer appear in dropdowns' 
          : 'Partner is now available for selection',
      });
    } catch (error) {
      toast({
        title: 'Failed to Update Partner',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    const partnerToDelete = partners.find(p => p.id === deleteConfirmId);
    
    try {
      await deletePartner.mutateAsync(deleteConfirmId);
      toast({
        title: 'Partner Deleted',
        description: `${partnerToDelete?.name || 'Partner'} has been removed`,
      });
      setDeleteConfirmId(null);
    } catch (error) {
      toast({
        title: 'Failed to Delete Partner',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const partnerToDelete = partners.find(p => p.id === deleteConfirmId);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Manage Outreach Partners
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Add New Partner */}
            <div className="flex gap-2">
              <Input
                placeholder="New partner name..."
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPartner()}
              />
              <Button 
                onClick={handleAddPartner} 
                disabled={!newPartnerName.trim() || createPartner.isPending}
                size="icon"
              >
                {createPartner.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Partners List */}
            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </div>
            ) : partners.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No partners yet</p>
                <p className="text-xs">Add your first outreach partner above</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {partners.map((partner) => (
                    <motion.div
                      key={partner.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`flex items-center gap-2 p-3 rounded-lg border ${
                        partner.isActive 
                          ? 'bg-card border-border' 
                          : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      {editingId === partner.id ? (
                        <>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={handleSaveEdit}
                            disabled={updatePartner.isPending}
                          >
                            <Check className="w-4 h-4 text-emerald-500" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className={`flex-1 text-sm ${!partner.isActive ? 'text-muted-foreground' : ''}`}>
                            {partner.name}
                          </span>
                          {!partner.isActive && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleToggleActive(partner.id, partner.isActive)}
                            title={partner.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {partner.isActive ? (
                              <ToggleRight className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(partner.id, partner.name)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(partner.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{partnerToDelete?.name}"? 
              This action cannot be undone. Marketplaces using this partner will keep 
              their current assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePartner.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
