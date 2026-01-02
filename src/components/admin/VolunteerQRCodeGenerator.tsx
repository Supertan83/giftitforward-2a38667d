import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, QrCode, Plus, Trash2, Download, Printer, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useVolunteerQRCards, useVolunteerCardOperations } from '@/hooks/useSupabaseData';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

interface VolunteerQRCodeGeneratorProps {
  onBack: () => void;
}

interface GeneratedCard {
  id: string;
  uniqueId: string;
  createdAt: Date;
}

const generateUniqueId = (prefix: string): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const VolunteerQRCodeGenerator = ({ onBack }: VolunteerQRCodeGeneratorProps) => {
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [prefix, setPrefix] = useState('VOL');
  const [quantity, setQuantity] = useState(1);
  const [isRegistering, setIsRegistering] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const { data: registeredCards = [], isLoading } = useVolunteerQRCards();
  const { addVolunteerCards } = useVolunteerCardOperations();

  const handleGenerate = useCallback(() => {
    const newCards: GeneratedCard[] = [];
    for (let i = 0; i < quantity; i++) {
      newCards.push({
        id: crypto.randomUUID(),
        uniqueId: generateUniqueId(prefix),
        createdAt: new Date()
      });
    }
    setCards(prev => [...prev, ...newCards]);
    toast({
      title: 'Cards Generated',
      description: `${quantity} volunteer QR code(s) generated successfully.`
    });
  }, [prefix, quantity, toast]);

  const handleRemoveCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setCards([]);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportCSV = useCallback(() => {
    const csvContent = [
      ['Unique ID', 'Created At'],
      ...cards.map(c => [c.uniqueId, c.createdAt.toISOString()])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volunteer-qr-cards-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cards]);

  const handleRegisterCards = useCallback(async () => {
    if (cards.length === 0) return;
    
    setIsRegistering(true);
    try {
      const uniqueIds = cards.map(c => c.uniqueId);
      const count = await addVolunteerCards.mutateAsync(uniqueIds);
      toast({
        title: 'Cards Registered',
        description: `${count} volunteer card(s) registered successfully.`
      });
      setCards([]);
    } catch (error) {
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'Failed to register cards',
        variant: 'destructive'
      });
    } finally {
      setIsRegistering(false);
    }
  }, [cards, addVolunteerCards, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Checked In</Badge>;
      case 'checked_out':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30"><XCircle className="w-3 h-3 mr-1" />Checked Out</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Inactive</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Volunteer QR Cards</h1>
          <p className="text-sm text-muted-foreground">Generate and manage volunteer attendance cards</p>
        </div>
        {cards.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRegisterCards}
              disabled={isRegistering}
            >
              {isRegistering ? 'Registering...' : 'Register All'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="registered">Registered ({registeredCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          {/* Generation Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="prefix">ID Prefix</Label>
                <Input
                  id="prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  placeholder="VOL"
                  maxLength={6}
                />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={50}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleGenerate} className="flex-1">
                  <Plus className="w-4 h-4 mr-1" /> Generate
                </Button>
                {cards.length > 0 && (
                  <Button variant="outline" onClick={handleClearAll}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Generated Cards Preview */}
          {cards.length > 0 && (
            <div ref={printRef} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 print:grid-cols-3">
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-lg p-3 text-center relative group"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 print:hidden"
                    onClick={() => handleRemoveCard(card.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-primary">Volunteer</span>
                  </div>
                  <QRCodeSVG
                    value={card.uniqueId}
                    size={100}
                    level="M"
                    className="mx-auto mb-2"
                  />
                  <p className="text-xs font-mono font-medium truncate">{card.uniqueId}</p>
                </motion.div>
              ))}
            </div>
          )}

          {cards.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No volunteer cards generated yet</p>
              <p className="text-sm">Use the form above to generate QR codes</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="registered" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : registeredCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No volunteer cards registered yet</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Card ID</TableHead>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours Worked</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registeredCards.map((card: any) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-mono text-sm">{card.unique_id}</TableCell>
                      <TableCell>
                        {card.pending_volunteers 
                          ? `${card.pending_volunteers.first_name} ${card.pending_volunteers.last_name}`
                          : <span className="text-muted-foreground">Not linked</span>
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(card.status)}</TableCell>
                      <TableCell>{(card.total_hours_worked || 0).toFixed(1)}h</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {card.checked_out_at 
                          ? format(new Date(card.checked_out_at), 'MMM d, HH:mm')
                          : card.checked_in_at 
                            ? format(new Date(card.checked_in_at), 'MMM d, HH:mm')
                            : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!cardToDelete} onOpenChange={() => setCardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Card?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this volunteer card.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setCardToDelete(null)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:grid-cols-3, .print\\:grid-cols-3 * { visibility: visible; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};
