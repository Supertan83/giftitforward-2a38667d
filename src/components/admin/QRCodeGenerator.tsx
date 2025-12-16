import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Printer, 
  Plus, 
  Trash2, 
  Download,
  QrCode,
  CreditCard,
  Grid3X3,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CSVImport } from '@/components/admin/CSVImport';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GeneratedCard {
  id: string;
  uniqueId: string;
  createdAt: Date;
}

// Generate a unique ID
const generateUniqueId = (prefix: string = 'QR') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

interface QRCodeGeneratorProps {
  onBack: () => void;
}

export const QRCodeGenerator = ({ onBack }: QRCodeGeneratorProps) => {
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [prefix, setPrefix] = useState('QR');
  const [quantity, setQuantity] = useState('10');
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [activeTab, setActiveTab] = useState('generate');
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { qrCards, importCards } = useAppStore();
  const existingCardIds = qrCards.map(c => c.uniqueId);

  const sizeConfig = {
    small: { qr: 80, card: 'w-32', cols: 'grid-cols-4 md:grid-cols-6' },
    medium: { qr: 120, card: 'w-44', cols: 'grid-cols-2 md:grid-cols-4' },
    large: { qr: 160, card: 'w-56', cols: 'grid-cols-2 md:grid-cols-3' },
  };

  const handleGenerate = () => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      toast({
        title: 'Invalid quantity',
        description: 'Please enter a number between 1 and 100',
        variant: 'destructive',
      });
      return;
    }

    const newCards: GeneratedCard[] = Array.from({ length: qty }, () => ({
      id: crypto.randomUUID(),
      uniqueId: generateUniqueId(prefix),
      createdAt: new Date(),
    }));

    setCards((prev) => [...prev, ...newCards]);
    toast({
      title: `${qty} cards generated`,
      description: 'Cards are ready for printing',
    });
  };

  const handleRemoveCard = (id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  };

  const handleClearAll = () => {
    setCards([]);
    toast({
      title: 'All cards cleared',
    });
  };

  const handlePrint = () => {
    if (cards.length === 0) {
      toast({
        title: 'No cards to print',
        description: 'Generate some cards first',
        variant: 'destructive',
      });
      return;
    }
    window.print();
  };

  const handleExportCSV = () => {
    if (cards.length === 0) return;

    const csv = [
      'Unique ID,Created At',
      ...cards.map((card) => `${card.uniqueId},${card.createdAt.toISOString()}`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-cards-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'CSV exported',
      description: `${cards.length} card IDs exported`,
    });
  };

  const handleCSVImport = useCallback((uniqueIds: string[]) => {
    // Import to store (registers them in the system)
    const importedCount = importCards(uniqueIds);

    // Also add to print preview
    const newCards: GeneratedCard[] = uniqueIds.map(uniqueId => ({
      id: crypto.randomUUID(),
      uniqueId,
      createdAt: new Date(),
    }));

    setCards(prev => [...prev, ...newCards]);

    toast({
      title: 'Cards imported',
      description: `${importedCount} cards registered in system and added to print queue`,
    });
  }, [importCards, toast]);

  const handleRegisterGeneratedCards = useCallback(() => {
    if (cards.length === 0) return;

    const uniqueIds = cards.map(c => c.uniqueId);
    const importedCount = importCards(uniqueIds);

    toast({
      title: 'Cards registered',
      description: `${importedCount} cards registered in the system`,
    });
  }, [cards, importCards, toast]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Hidden in print */}
      <header className="bg-card border-b border-border sticky top-0 z-10 print:hidden">
        <div className="container max-w-6xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-display font-bold text-lg">QR Code Generator</h1>
                <p className="text-sm text-muted-foreground">Create & import beneficiary cards</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV} disabled={cards.length === 0}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={handleRegisterGeneratedCards} disabled={cards.length === 0}>
                <CreditCard className="w-4 h-4" />
                Register All
              </Button>
              <Button onClick={handlePrint} disabled={cards.length === 0}>
                <Printer className="w-4 h-4" />
                Print Cards
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 print:py-0 print:max-w-none">
        {/* Generator/Import Controls - Hidden in print */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-6 shadow-card mb-6 print:hidden"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="generate" className="gap-2">
                <QrCode className="w-4 h-4" />
                Generate New
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2">
                <Upload className="w-4 h-4" />
                Import CSV
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>ID Prefix</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                    placeholder="QR"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min={1}
                    max={100}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Card Size</Label>
                  <Select value={cardSize} onValueChange={(v: 'small' | 'medium' | 'large') => setCardSize(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (80px)</SelectItem>
                      <SelectItem value="medium">Medium (120px)</SelectItem>
                      <SelectItem value="large">Large (160px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleGenerate} className="flex-1">
                    <Plus className="w-4 h-4" />
                    Generate
                  </Button>
                  {cards.length > 0 && (
                    <Button variant="outline" onClick={handleClearAll}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="import">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Import Pre-Printed Cards</p>
                    <p className="text-muted-foreground">
                      Upload a CSV file with QR card IDs to register them in the system. 
                      Cards will be added to the print queue for verification.
                    </p>
                  </div>
                </div>
                <CSVImport 
                  onImport={handleCSVImport}
                  existingCardIds={existingCardIds}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
            <span className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              {cards.length} cards in queue
            </span>
            <span className="flex items-center gap-1">
              <Grid3X3 className="w-4 h-4" />
              {sizeConfig[cardSize].cols.includes('4') ? '4' : '3'} per row
            </span>
            <span className="flex items-center gap-1 text-primary">
              <QrCode className="w-4 h-4" />
              {qrCards.length} total registered
            </span>
          </div>
        </motion.div>

        {/* Cards Preview/Print Area */}
        <div ref={printRef} className="print:p-0">
          {cards.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-2xl border border-border p-12 text-center print:hidden"
            >
              <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">No Cards in Queue</h3>
              <p className="text-muted-foreground mb-4">
                Generate new cards or import existing IDs to preview and print
              </p>
            </motion.div>
          ) : (
            <div className={cn('grid gap-4 print:gap-2', sizeConfig[cardSize].cols)}>
              {cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    'relative bg-card rounded-xl border-2 border-border p-4 print:p-3 print:break-inside-avoid',
                    sizeConfig[cardSize].card
                  )}
                >
                  {/* Remove button - Hidden in print */}
                  <button
                    onClick={() => handleRemoveCard(card.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-danger text-danger-foreground rounded-full flex items-center justify-center hover:bg-danger/90 print:hidden"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Card Content */}
                  <div className="flex flex-col items-center">
                    {/* QR Code */}
                    <div className="bg-white p-2 rounded-lg mb-2">
                      <QRCodeSVG
                        value={card.uniqueId}
                        size={sizeConfig[cardSize].qr}
                        level="H"
                        includeMargin={false}
                      />
                    </div>

                    {/* Card ID */}
                    <p className="font-mono text-xs font-semibold text-center break-all">
                      {card.uniqueId}
                    </p>

                    {/* Branding */}
                    <div className="mt-2 pt-2 border-t border-border w-full text-center">
                      <p className="text-[10px] text-muted-foreground font-medium">
                        CHARITY MARKETPLACE
                      </p>
                      <p className="text-[8px] text-muted-foreground">
                        15 Item Credits
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5cm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          [class*="print:"] {
            visibility: visible;
          }
          
          main, main * {
            visibility: visible;
          }
          
          main {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
