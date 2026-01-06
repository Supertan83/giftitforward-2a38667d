import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, QrCode, Clock, Scan, Loader2, MapPin, UserX, Users, LogIn, ShoppingBag, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useVolunteerQRCards, useVolunteerCardOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type ActionMode = 'check-in' | 'check-out';
type VolunteerZoneType = 'entrance' | 'marketplace' | 'exit';

const zoneOptions: { value: VolunteerZoneType; label: string; icon: React.ElementType }[] = [
  { value: 'entrance', label: 'Entrance', icon: LogIn },
  { value: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { value: 'exit', label: 'Exit', icon: LogOut },
];

export const VolunteerZone = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>('check-in');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  
  // Zone assignment dialog state
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<VolunteerZoneType>('entrance');

  const { data: volunteerCards = [], isLoading } = useVolunteerQRCards();
  const { checkInVolunteer, checkOutVolunteer } = useVolunteerCardOperations();
  const { data: marketplaces = [], isLoading: isLoadingMarketplaces } = useMarketplaces();

  // Filter to show only upcoming or active marketplaces
  const availableMarketplaces = marketplaces.filter(m => m.status === 'upcoming' || m.status === 'active');
  const selectedMarketplace = availableMarketplaces.find(m => m.id === selectedMarketplaceId);

  // Stats for selected marketplace
  const marketplaceStats = useMemo(() => {
    const cardsForMarketplace = selectedMarketplaceId 
      ? volunteerCards.filter(c => c.marketplace_id === selectedMarketplaceId)
      : volunteerCards;
    
    return {
      checkedIn: cardsForMarketplace.filter(c => c.status === 'checked_in').length,
      checkedOut: cardsForMarketplace.filter(c => c.status === 'checked_out').length,
      total: cardsForMarketplace.length,
    };
  }, [volunteerCards, selectedMarketplaceId]);

  // Get currently checked-in volunteers for selected marketplace
  const checkedInVolunteers = useMemo(() => {
    return volunteerCards
      .filter(c => c.status === 'checked_in' && (!selectedMarketplaceId || c.marketplace_id === selectedMarketplaceId))
      .slice(0, 5);
  }, [volunteerCards, selectedMarketplaceId]);

  const handleScan = useCallback((code: string) => {
    setShowScanner(false);
    
    if (actionMode === 'check-in') {
      // Show zone assignment dialog for check-in
      setScannedCode(code);
      setShowZoneDialog(true);
    } else {
      // Direct check-out
      processCheckOut(code);
    }
  }, [actionMode]);

  const processCheckIn = useCallback(async () => {
    setShowZoneDialog(false);
    setIsProcessing(true);
    
    try {
      await checkInVolunteer.mutateAsync({
        uniqueId: scannedCode,
        marketplaceId: selectedMarketplaceId || undefined,
        assignedZone: selectedZone
      });
      
      const zoneLabel = zoneOptions.find(z => z.value === selectedZone)?.label || selectedZone;
      setFeedback({
        type: 'success',
        title: 'Volunteer Checked In!',
        subtitle: `Assigned to ${zoneLabel}`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'Check-In Failed',
        subtitle: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsProcessing(false);
      setScannedCode('');
    }
  }, [checkInVolunteer, scannedCode, selectedMarketplaceId, selectedZone]);

  const processCheckOut = useCallback(async (code: string) => {
    setIsProcessing(true);
    
    try {
      const result = await checkOutVolunteer.mutateAsync(code);
      const surveySentMessage = result.surveySent 
        ? 'Survey email sent!' 
        : 'Hours logged successfully';
      setFeedback({
        type: 'success',
        title: 'Volunteer Checked Out!',
        subtitle: surveySentMessage,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'Check-Out Failed',
        subtitle: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [checkOutVolunteer]);

  return (
    <div className="min-h-full p-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 md:mb-6"
      >
        <div className="flex items-center gap-2 text-warning mb-1">
          <UserCheck className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium uppercase tracking-wider">Volunteer Attendance</span>
        </div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Volunteer Zone
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 md:mt-1">
          Track volunteer check-ins and check-outs
        </p>
      </motion.div>

      {/* Marketplace Selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-4 md:mb-6"
      >
        <div className="bg-card rounded-xl border border-border p-3 md:p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium">Select Marketplace</span>
          </div>
          <Select
            value={selectedMarketplaceId}
            onValueChange={setSelectedMarketplaceId}
            disabled={isLoadingMarketplaces}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose marketplace..." />
            </SelectTrigger>
            <SelectContent>
              {availableMarketplaces.map((marketplace) => (
                <SelectItem key={marketplace.id} value={marketplace.id}>
                  <div className="flex items-center gap-2">
                    <span>{marketplace.name}</span>
                    {marketplace.location && (
                      <span className="text-muted-foreground text-xs">
                        ({marketplace.location})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {availableMarketplaces.length === 0 && (
                <SelectItem value="none" disabled>
                  No marketplaces available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedMarketplace && (
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMarketplace.event_date 
                ? `Event date: ${new Date(selectedMarketplace.event_date).toLocaleDateString()}`
                : 'No date set'}
            </p>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6">
        <StatCard
          icon={UserCheck}
          label="Checked In"
          value={isLoading ? '-' : marketplaceStats.checkedIn}
          variant="success"
        />
        <StatCard
          icon={UserX}
          label="Checked Out"
          value={isLoading ? '-' : marketplaceStats.checkedOut}
          variant="default"
        />
        <StatCard
          icon={Users}
          label="Total"
          value={isLoading ? '-' : marketplaceStats.total}
          variant="primary"
        />
      </div>

      {/* Action Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-4 md:mb-6"
      >
        <div className="bg-card rounded-xl border border-border p-2 shadow-card">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={actionMode === 'check-in' ? 'default' : 'ghost'}
              className="w-full"
              onClick={() => setActionMode('check-in')}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Check In
            </Button>
            <Button
              variant={actionMode === 'check-out' ? 'default' : 'ghost'}
              className="w-full"
              onClick={() => setActionMode('check-out')}
            >
              <UserX className="w-4 h-4 mr-2" />
              Check Out
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Action */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card mb-4 md:mb-6"
      >
        <div className="text-center mb-4 md:mb-6">
          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 ${
            actionMode === 'check-in' ? 'bg-success-soft' : 'bg-warning-soft'
          }`}>
            {actionMode === 'check-in' ? (
              <UserCheck className="w-8 h-8 md:w-10 md:h-10 text-success" />
            ) : (
              <Clock className="w-8 h-8 md:w-10 md:h-10 text-warning" />
            )}
          </div>
          <h2 className="font-display font-semibold text-base md:text-lg mb-1.5 md:mb-2">
            {actionMode === 'check-in' ? 'Volunteer Check-In' : 'Volunteer Check-Out'}
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            {actionMode === 'check-in' 
              ? 'Scan volunteer QR card to record arrival'
              : 'Scan volunteer QR card to log departure and hours'}
          </p>
        </div>

        <Button 
          onClick={() => setShowScanner(true)} 
          variant={actionMode === 'check-in' ? 'default' : 'secondary'}
          size="xl" 
          className="w-full"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
          ) : (
            <Scan className="w-5 h-5 md:w-6 md:h-6" />
          )}
          {isProcessing ? 'Processing...' : `Scan to ${actionMode === 'check-in' ? 'Check In' : 'Check Out'}`}
        </Button>
      </motion.div>

      {/* Recently Checked-In Volunteers */}
      <AnimatePresence>
        {checkedInVolunteers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Currently Checked In
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {checkedInVolunteers.map((volunteer) => (
                  <div 
                    key={volunteer.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{volunteer.unique_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {volunteer.checked_in_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(volunteer.checked_in_at), 'HH:mm')}
                        </span>
                      )}
                      <Badge variant="outline" className="bg-success-soft text-success border-success/20">
                        Active
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone Assignment Dialog */}
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Volunteer Zone</DialogTitle>
            <DialogDescription>
              Select which zone this volunteer will work in today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Scanned Card</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <QrCode className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm">{scannedCode}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign to Zone</Label>
              <div className="grid grid-cols-3 gap-2">
                {zoneOptions.map((zone) => {
                  const Icon = zone.icon;
                  const isSelected = selectedZone === zone.value;
                  return (
                    <Button
                      key={zone.value}
                      variant={isSelected ? 'default' : 'outline'}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      onClick={() => setSelectedZone(zone.value)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs">{zone.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZoneDialog(false)}>
              Cancel
            </Button>
            <Button onClick={processCheckIn} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="w-4 h-4 mr-2" />
              )}
              Confirm Check-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
        title={actionMode === 'check-in' ? 'Volunteer Check-In' : 'Volunteer Check-Out'}
      />

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay
            type={feedback.type}
            title={feedback.title}
            subtitle={feedback.subtitle}
            isVisible={!!feedback}
            onComplete={() => setFeedback(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
