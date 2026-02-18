import React, { useState, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import JSZip from 'jszip';
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
  FileSpreadsheet,
  Loader2,
  Database,
  XCircle,
  Eye,
  X,
  FileDown,
  FileText,
  ChevronDown,
  ChevronRight
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { CSVImport } from '@/components/admin/CSVImport';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQRCards, useCardOperations } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  const [isRegistering, setIsRegistering] = useState(false);
  const [cardToUnregister, setCardToUnregister] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const [previewCard, setPreviewCard] = useState<string | null>(null);
  const [cardsToPreview, setCardsToPreview] = useState<string[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const previewPrintRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: qrCards = [] } = useQRCards();
  const { addCards, unregisterCard } = useCardOperations();
  const existingCardIds = qrCards.map(c => c.uniqueId);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Group registered cards by batch
  const batchGroups = useMemo(() => {
    const groups: Record<string, typeof qrCards> = {};
    for (const card of qrCards) {
      const key = card.registrationBatch || '__ungrouped__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
    // Sort batches by earliest created_at (newest first)
    const sorted = Object.entries(groups)
      .filter(([k]) => k !== '__ungrouped__')
      .sort((a, b) => {
        const aTime = a[1][0]?.createdAt || '';
        const bTime = b[1][0]?.createdAt || '';
        return bTime.localeCompare(aTime);
      });
    const ungrouped = groups['__ungrouped__'];
    if (ungrouped?.length) sorted.push(['__ungrouped__', ungrouped]);
    return sorted;
  }, [qrCards]);

  const toggleBatchExpand = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const toggleBatchSelectAll = (batchCards: typeof qrCards) => {
    const batchIds = batchCards.map(c => c.uniqueId);
    const allSelected = batchIds.every(id => selectedCards.has(id));
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (allSelected) {
        batchIds.forEach(id => next.delete(id));
      } else {
        batchIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleConfirmUnregister = async () => {
    if (!cardToUnregister) return;
    
    setIsUnregistering(true);
    try {
      await unregisterCard.mutateAsync(cardToUnregister);
      toast({
        title: 'Card unregistered',
        description: `Card ${cardToUnregister} has been removed from the system`,
      });
    } catch (error) {
      toast({
        title: 'Unregister failed',
        description: error instanceof Error ? error.message : 'Failed to unregister card',
        variant: 'destructive',
      });
    } finally {
      setIsUnregistering(false);
      setCardToUnregister(null);
    }
  };

  const handleBulkUnregister = async () => {
    if (selectedCards.size === 0) return;
    
    setIsUnregistering(true);
    const cardIds = Array.from(selectedCards);
    let successCount = 0;
    let failCount = 0;

    for (const uniqueId of cardIds) {
      try {
        await unregisterCard.mutateAsync(uniqueId);
        successCount++;
      } catch {
        failCount++;
      }
    }

    toast({
      title: 'Bulk unregister complete',
      description: `${successCount} cards removed${failCount > 0 ? `, ${failCount} failed` : ''}`,
      variant: failCount > 0 ? 'destructive' : 'default',
    });

    setSelectedCards(new Set());
    setShowBulkConfirm(false);
    setIsUnregistering(false);
  };

  const toggleCardSelection = (uniqueId: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(uniqueId)) {
        next.delete(uniqueId);
      } else {
        next.add(uniqueId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCards.size === qrCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(qrCards.map(c => c.uniqueId)));
    }
  };

  const handlePreviewCard = (uniqueId: string) => {
    setCardsToPreview([uniqueId]);
    setShowPreviewDialog(true);
  };

  const handlePreviewSelected = () => {
    if (selectedCards.size === 0) return;
    setCardsToPreview(Array.from(selectedCards));
    setShowPreviewDialog(true);
  };

  const handlePrintPreview = () => {
    // Create a print-specific window for the preview cards
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Print blocked',
        description: 'Please allow popups for printing',
        variant: 'destructive',
      });
      return;
    }

    const cardsHtml = cardsToPreview.map(uniqueId => `
      <div style="
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px;
        width: ${cardSize === 'small' ? '120px' : cardSize === 'medium' ? '160px' : '200px'};
        display: flex;
        flex-direction: column;
        align-items: center;
        break-inside: avoid;
      ">
        <div style="background: white; padding: 8px; border-radius: 8px; margin-bottom: 8px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=${sizeConfig[cardSize].qr}x${sizeConfig[cardSize].qr}&data=${encodeURIComponent(uniqueId)}&ecc=H" 
               alt="QR Code" 
               style="width: ${sizeConfig[cardSize].qr}px; height: ${sizeConfig[cardSize].qr}px;" />
        </div>
        <p style="font-family: monospace; font-size: 11px; font-weight: 600; text-align: center; word-break: break-all; margin: 0;">
          ${uniqueId}
        </p>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; width: 100%; text-align: center;">
          <p style="font-size: 9px; color: #6b7280; font-weight: 500; margin: 0;">GIF (GIFT IT FORWARD)</p>
          <p style="font-size: 7px; color: #9ca3af; margin: 2px 0 0 0;">15 Item Credits</p>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Cards</title>
          <style>
            @page { margin: 0.5cm; }
            body { 
              margin: 0; 
              padding: 20px;
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(${cardSize === 'small' ? '130px' : cardSize === 'medium' ? '170px' : '210px'}, 1fr));
              gap: 16px;
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const sizeConfig = {
    small: { qr: 80, card: 'w-32', cols: 'grid-cols-4 md:grid-cols-6' },
    medium: { qr: 120, card: 'w-44', cols: 'grid-cols-2 md:grid-cols-4' },
    large: { qr: 160, card: 'w-56', cols: 'grid-cols-2 md:grid-cols-3' },
  };

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const renderCardToPngBlob = useCallback((uniqueId: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));

      const width = 400;
      const height = 500;
      canvas.width = width;
      canvas.height = height;

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Try to find existing SVG in DOM first, otherwise generate via external API
      const wrapper = document.querySelector(`[data-qr-id="${uniqueId}"]`);
      const svgEl = wrapper?.querySelector('svg');
      
      let svgUrl: string;

      const drawCard = (qrImage: HTMLImageElement) => {
        const qrX = (width - 280) / 2;
        const qrY = 40;
        ctx.drawImage(qrImage, qrX, qrY, 280, 280);

        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(uniqueId, width / 2, 360);

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 390);
        ctx.lineTo(width - 60, 390);
        ctx.stroke();

        ctx.fillStyle = '#6b7280';
        ctx.font = '600 14px sans-serif';
        ctx.fillText('GIF (GIFT IT FORWARD)', width / 2, 420);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '11px sans-serif';
        ctx.fillText('15 Item Credits', width / 2, 445);

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.roundRect(4, 4, width - 8, height - 8, 12);
        ctx.stroke();

        canvas.toBlob((blob) => {
          if (svgUrl) URL.revokeObjectURL(svgUrl);
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      };

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onerror = () => {
        if (svgUrl) URL.revokeObjectURL(svgUrl);
        reject(new Error('Failed to load QR image'));
      };
      img.onload = () => drawCard(img);

      if (svgEl) {
        const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('width', '280');
        clonedSvg.setAttribute('height', '280');
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        svgUrl = URL.createObjectURL(svgBlob);
        img.src = svgUrl;
      } else {
        // Generate QR programmatically using a temporary off-screen element
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);
        
        const root = createRoot(tempDiv);
        root.render(React.createElement(QRCodeSVG, { value: uniqueId, size: 280, level: 'H' }));
        
        // Wait for render
        setTimeout(() => {
          const generatedSvg = tempDiv.querySelector('svg');
          if (!generatedSvg) {
            root.unmount();
            tempDiv.remove();
            return reject(new Error('Failed to generate QR SVG'));
          }
          const svgData = new XMLSerializer().serializeToString(generatedSvg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          svgUrl = URL.createObjectURL(svgBlob);
          img.src = svgUrl;
          root.unmount();
          tempDiv.remove();
        }, 50);
      }
    });
  }, []);

  const handleDownloadSinglePng = useCallback(async (uniqueId: string) => {
    try {
      const blob = await renderCardToPngBlob(uniqueId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uniqueId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Could not generate PNG',
        variant: 'destructive',
      });
    }
  }, [renderCardToPngBlob, toast]);

  // Determine which card IDs the header buttons should act on
  const activeCardIds = useMemo(() => {
    if (activeTab === 'registered' && selectedCards.size > 0) {
      return Array.from(selectedCards);
    }
    return cards.map(c => c.uniqueId);
  }, [activeTab, selectedCards, cards]);

  const hasActiveCards = activeCardIds.length > 0;

  const handleDownloadAllZip = useCallback(async () => {
    if (activeCardIds.length === 0) return;
    
    setIsDownloadingZip(true);
    setZipProgress(0);
    
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < activeCardIds.length; i++) {
        const blob = await renderCardToPngBlob(activeCardIds[i]);
        zip.file(`${activeCardIds[i]}.png`, blob);
        setZipProgress(Math.round(((i + 1) / activeCardIds.length) * 100));
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-cards-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Download complete',
        description: `${activeCardIds.length} QR codes downloaded as ZIP`,
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Could not generate ZIP file',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingZip(false);
      setZipProgress(0);
    }
  }, [activeCardIds, renderCardToPngBlob, toast]);

  const handleGenerate = () => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      toast({
        title: 'Invalid quantity',
        description: 'Please enter a number between 1 and 1000',
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
    if (activeCardIds.length === 0) {
      toast({
        title: 'No cards to print',
        description: 'Generate cards or select registered cards first',
        variant: 'destructive',
      });
      return;
    }
    // If on registered tab with selected cards, use print preview approach
    if (activeTab === 'registered' && selectedCards.size > 0) {
      setCardsToPreview(Array.from(selectedCards));
      setShowPreviewDialog(true);
      return;
    }
    window.print();
  };

  const handleExportCSV = () => {
    if (activeCardIds.length === 0) return;

    // If on registered tab, export selected registered cards with more details
    if (activeTab === 'registered' && selectedCards.size > 0) {
      handleExportSelectedCSV();
      return;
    }

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

  const handleExportSelectedCSV = useCallback(() => {
    if (selectedCards.size === 0) return;
    const selected = qrCards.filter(c => selectedCards.has(c.uniqueId));
    const csv = [
      'Unique ID,Status,Credit Balance,Created At',
      ...selected.map(c => `${c.uniqueId},${c.status},${c.creditBalance},${c.createdAt || ''}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registered-cards-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: `${selected.length} registered card IDs exported` });
  }, [selectedCards, qrCards, toast]);

  const handleCSVImport = useCallback(async (uniqueIds: string[]) => {
    setIsRegistering(true);
    try {
      // Import to database
      const importedCount = await addCards.mutateAsync(uniqueIds);

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
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import cards',
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  }, [addCards, toast]);

  const handleRegisterGeneratedCards = useCallback(async () => {
    if (cards.length === 0) return;

    setIsRegistering(true);
    try {
      const uniqueIds = cards.map(c => c.uniqueId);
      const importedCount = await addCards.mutateAsync(uniqueIds);

      toast({
        title: 'Cards registered',
        description: `${importedCount} cards registered in the system`,
      });
    } catch (error) {
      toast({
        title: 'Registration failed',
        description: error instanceof Error ? error.message : 'Failed to register cards',
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  }, [cards, addCards, toast]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Hidden in print */}
      <header className="bg-card border-b border-border sticky top-0 z-10 print:hidden">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">QR Code Generator</h1>
                <p className="text-xs md:text-sm text-muted-foreground">Create & import beneficiary cards</p>
              </div>
            </div>
            <div className="flex gap-2 ml-9 sm:ml-0">
              <Button size="sm" onClick={handleDownloadAllZip} disabled={!hasActiveCards || isDownloadingZip} className="text-xs">
                {isDownloadingZip ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Download className="w-3 h-3 md:w-4 md:h-4" />}
                <span className="hidden sm:inline">{isDownloadingZip ? `${zipProgress}%` : `Download${activeTab === 'registered' && selectedCards.size > 0 ? ` (${selectedCards.size})` : ' All'}`}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!hasActiveCards} className="text-xs">
                <FileText className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
              {activeTab !== 'registered' && (
                <Button variant="outline" size="sm" onClick={handleRegisterGeneratedCards} disabled={cards.length === 0 || isRegistering} className="text-xs">
                  {isRegistering ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <CreditCard className="w-3 h-3 md:w-4 md:h-4" />}
                  <span className="hidden sm:inline">{isRegistering ? 'Registering...' : 'Register'}</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!hasActiveCards} className="text-xs">
                <Printer className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4 print:py-0 print:max-w-none">
        {/* Generator/Import Controls - Hidden in print */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card mb-4 md:mb-6 print:hidden"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-6">
              <TabsTrigger value="generate" className="gap-1 md:gap-2 text-xs md:text-sm">
                <QrCode className="w-3 h-3 md:w-4 md:h-4" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-1 md:gap-2 text-xs md:text-sm">
                <Upload className="w-3 h-3 md:w-4 md:h-4" />
                Import
              </TabsTrigger>
              <TabsTrigger value="registered" className="gap-1 md:gap-2 text-xs md:text-sm">
                <Database className="w-3 h-3 md:w-4 md:h-4" />
                Registered
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-xs md:text-sm">ID Prefix</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                    placeholder="QR"
                    maxLength={4}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-xs md:text-sm">Quantity</Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min={1}
                    max={1000}
                    placeholder="10"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-xs md:text-sm">Card Size</Label>
                  <Select value={cardSize} onValueChange={(v: 'small' | 'medium' | 'large') => setCardSize(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleGenerate} className="flex-1 text-xs md:text-sm" size="sm">
                    <Plus className="w-3 h-3 md:w-4 md:h-4" />
                    Generate
                  </Button>
                  {cards.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleClearAll}>
                      <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="import">
              <div className="space-y-4">
                <div className="flex items-start gap-2 md:gap-3 p-3 md:p-4 bg-muted rounded-lg">
                  <FileSpreadsheet className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-xs md:text-sm">
                    <p className="font-medium">Import Pre-Printed Cards</p>
                    <p className="text-muted-foreground">
                      Upload a CSV file with QR card IDs to register them in the system.
                    </p>
                  </div>
                </div>
                <CSVImport 
                  onImport={handleCSVImport}
                  existingCardIds={existingCardIds}
                />
              </div>
            </TabsContent>

            <TabsContent value="registered">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 md:gap-3 p-3 md:p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-2 md:gap-3">
                    <Database className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-xs md:text-sm">
                      <p className="font-medium">Registered Cards ({qrCards.length})</p>
                      <p className="text-muted-foreground">
                        Cards grouped by registration batch. Select entire batches for bulk actions.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {selectedCards.size > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviewSelected}
                          className="text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Preview ({selectedCards.size})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportSelectedCSV}
                          className="text-xs"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          CSV
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowBulkConfirm(true)}
                          className="text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Unregister ({selectedCards.size})
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {qrCards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <QrCode className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No registered cards in system</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {batchGroups.map(([batchId, batchCards]) => {
                      const isExpanded = expandedBatches.has(batchId);
                      const batchIds = batchCards.map(c => c.uniqueId);
                      const allSelected = batchIds.every(id => selectedCards.has(id));
                      const someSelected = batchIds.some(id => selectedCards.has(id));
                      const isUngrouped = batchId === '__ungrouped__';
                      const batchDate = batchCards[0]?.createdAt 
                        ? format(new Date(batchCards[0].createdAt), 'MMM d, yyyy HH:mm')
                        : 'Unknown date';

                      return (
                        <Collapsible key={batchId} open={isExpanded} onOpenChange={() => toggleBatchExpand(batchId)}>
                          <div className="border border-border rounded-lg overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-2 p-2 md:p-3 bg-muted/50 hover:bg-muted cursor-pointer">
                                {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs md:text-sm font-medium">
                                    {isUngrouped ? 'Ungrouped (legacy)' : `Batch: ${batchDate}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({batchCards.length} card{batchCards.length !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={allSelected}
                                    // Use indeterminate-like styling via data attribute
                                    className={someSelected && !allSelected ? 'opacity-70' : ''}
                                    onCheckedChange={() => toggleBatchSelectAll(batchCards)}
                                    aria-label={`Select all in batch`}
                                  />
                                  <span className="text-xs text-muted-foreground hidden sm:inline">Select All</span>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <table className="w-full text-xs md:text-sm">
                                <thead className="bg-muted/30">
                                  <tr>
                                    <th className="p-2 w-10"></th>
                                    <th className="text-left p-2 font-medium">Card ID</th>
                                    <th className="text-left p-2 font-medium">Status</th>
                                    <th className="text-left p-2 font-medium">Credits</th>
                                    <th className="text-right p-2 font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batchCards.map((card) => (
                                    <tr key={card.id} className={cn(
                                      "border-t border-border hover:bg-muted/50",
                                      selectedCards.has(card.uniqueId) && "bg-primary/5"
                                    )}>
                                      <td className="p-2">
                                        <Checkbox
                                          checked={selectedCards.has(card.uniqueId)}
                                          onCheckedChange={() => toggleCardSelection(card.uniqueId)}
                                          aria-label={`Select ${card.uniqueId}`}
                                        />
                                      </td>
                                      <td className="p-2 font-mono">{card.uniqueId}</td>
                                      <td className="p-2">
                                        <span className={cn(
                                          'px-2 py-0.5 rounded-full text-xs',
                                          card.status === 'active' ? 'bg-success/20 text-success' :
                                          card.status === 'checked_out' ? 'bg-warning/20 text-warning' :
                                          'bg-muted text-muted-foreground'
                                        )}>
                                          {card.status}
                                        </span>
                                      </td>
                                      <td className="p-2">{card.creditBalance}/15</td>
                                      <td className="p-2 text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handlePreviewCard(card.uniqueId)}
                                            className="text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setCardToUnregister(card.uniqueId)}
                                            disabled={isUnregistering}
                                            className="text-danger hover:text-danger hover:bg-danger/10 h-7 px-2"
                                          >
                                            <XCircle className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview info */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
            {isDownloadingZip && (
              <div className="w-full mb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Generating ZIP... {zipProgress}%</span>
                </div>
                <Progress value={zipProgress} className="h-2" />
              </div>
            )}
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 md:w-4 md:h-4" />
              {cards.length} cards in queue
            </span>
            <span className="flex items-center gap-1">
              <Grid3X3 className="w-3 h-3 md:w-4 md:h-4" />
              {sizeConfig[cardSize].cols.includes('4') ? '4' : '3'} per row
            </span>
            <span className="flex items-center gap-1 text-primary">
              <QrCode className="w-3 h-3 md:w-4 md:h-4" />
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
              className="bg-card rounded-xl md:rounded-2xl border border-border p-8 md:p-12 text-center print:hidden"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-muted rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                <QrCode className="w-8 h-8 md:w-10 md:h-10 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-base md:text-lg mb-1.5 md:mb-2">No Cards in Queue</h3>
              <p className="text-xs md:text-sm text-muted-foreground mb-4">
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
                  {/* Action buttons - Hidden in print */}
                  <div className="absolute -top-2 right-4 flex gap-1 print:hidden">
                    <button
                      onClick={() => handleDownloadSinglePng(card.uniqueId)}
                      className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90"
                      title="Download PNG"
                    >
                      <FileDown className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleRemoveCard(card.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-danger text-danger-foreground rounded-full flex items-center justify-center hover:bg-danger/90 print:hidden"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Card Content */}
                  <div className="flex flex-col items-center">
                    {/* QR Code */}
                    <div className="bg-white p-2 rounded-lg mb-2" data-qr-id={card.uniqueId}>
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
                        GIF (GIFT IT FORWARD)
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

      {/* Single Card Unregister Confirmation */}
      <AlertDialog open={!!cardToUnregister} onOpenChange={(open) => !open && setCardToUnregister(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unregister Card?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove card <span className="font-mono font-semibold">{cardToUnregister}</span> and all its transaction history from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnregistering}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnregister}
              disabled={isUnregistering}
              className="bg-danger hover:bg-danger/90"
            >
              {isUnregistering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unregistering...
                </>
              ) : (
                'Unregister'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>QR Code Preview ({cardsToPreview.length} card{cardsToPreview.length !== 1 ? 's' : ''})</span>
              <Button size="sm" onClick={handlePrintPreview}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div ref={previewPrintRef} className={cn('grid gap-4 py-4', sizeConfig[cardSize].cols)}>
            {cardsToPreview.map((uniqueId) => (
              <div
                key={uniqueId}
                className={cn(
                  'relative bg-card rounded-xl border-2 border-border p-4',
                  sizeConfig[cardSize].card
                )}
              >
                <div className="flex flex-col items-center">
                  <div className="bg-white p-2 rounded-lg mb-2">
                    <QRCodeSVG
                      value={uniqueId}
                      size={sizeConfig[cardSize].qr}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <p className="font-mono text-xs font-semibold text-center break-all">
                    {uniqueId}
                  </p>
                  <div className="mt-2 pt-2 border-t border-border w-full text-center">
                    <p className="text-[10px] text-muted-foreground font-medium">
                      GIF (GIFT IT FORWARD)
                    </p>
                    <p className="text-[8px] text-muted-foreground">
                      15 Item Credits
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Unregister Confirmation */}
      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unregister {selectedCards.size} Cards?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedCards.size} selected cards and all their transaction history from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnregistering}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkUnregister}
              disabled={isUnregistering}
              className="bg-danger hover:bg-danger/90"
            >
              {isUnregistering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unregistering...
                </>
              ) : (
                `Unregister ${selectedCards.size} Cards`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
