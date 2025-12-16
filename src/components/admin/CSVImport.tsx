import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X,
  FileText,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ParsedCard {
  uniqueId: string;
  valid: boolean;
  error?: string;
}

interface CSVImportProps {
  onImport: (cardIds: string[]) => void;
  existingCardIds: string[];
}

export const CSVImport = ({ onImport, existingCardIds }: CSVImportProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateCardId = useCallback((id: string): { valid: boolean; error?: string } => {
    const trimmedId = id.trim();
    
    if (!trimmedId) {
      return { valid: false, error: 'Empty ID' };
    }
    
    if (trimmedId.length < 3) {
      return { valid: false, error: 'ID too short' };
    }
    
    if (trimmedId.length > 50) {
      return { valid: false, error: 'ID too long' };
    }
    
    if (existingCardIds.some(existing => existing.toLowerCase() === trimmedId.toLowerCase())) {
      return { valid: false, error: 'Already exists' };
    }
    
    // Check for duplicates in the current import
    return { valid: true };
  }, [existingCardIds]);

  const parseCSV = useCallback((content: string): ParsedCard[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const cards: ParsedCard[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header row if it looks like a header
      if (i === 0 && (
        line.toLowerCase().includes('id') || 
        line.toLowerCase().includes('unique') ||
        line.toLowerCase().includes('card')
      )) {
        continue;
      }

      // Handle both comma-separated and single column formats
      const parts = line.split(',');
      const uniqueId = parts[0].trim().replace(/^["']|["']$/g, ''); // Remove quotes

      if (!uniqueId) continue;

      // Check for duplicates within the file
      if (seenIds.has(uniqueId.toLowerCase())) {
        cards.push({
          uniqueId,
          valid: false,
          error: 'Duplicate in file',
        });
        continue;
      }

      seenIds.add(uniqueId.toLowerCase());

      const validation = validateCardId(uniqueId);
      cards.push({
        uniqueId,
        valid: validation.valid,
        error: validation.error,
      });
    }

    return cards;
  }, [validateCardId]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV or TXT file',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseCSV(content);
      setParsedCards(parsed);
      setFileName(file.name);

      const validCount = parsed.filter(c => c.valid).length;
      const invalidCount = parsed.filter(c => !c.valid).length;

      toast({
        title: 'File parsed',
        description: `${validCount} valid, ${invalidCount} invalid cards found`,
      });
    };
    reader.readAsText(file);
  }, [parseCSV, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleImport = useCallback(() => {
    const validCards = parsedCards.filter(c => c.valid);
    if (validCards.length === 0) {
      toast({
        title: 'No valid cards',
        description: 'Please fix errors or upload a different file',
        variant: 'destructive',
      });
      return;
    }

    onImport(validCards.map(c => c.uniqueId));
    setParsedCards([]);
    setFileName(null);
    
    toast({
      title: 'Import successful',
      description: `${validCards.length} cards imported`,
    });
  }, [parsedCards, onImport, toast]);

  const handleClear = useCallback(() => {
    setParsedCards([]);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const validCount = parsedCards.filter(c => c.valid).length;
  const invalidCount = parsedCards.filter(c => !c.valid).length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragging 
            ? 'border-primary bg-primary-soft' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'w-14 h-14 rounded-xl flex items-center justify-center transition-colors',
            isDragging ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {isDragging ? 'Drop file here' : 'Drop CSV file or click to browse'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Single column with card IDs, one per line
            </p>
          </div>
        </div>
      </div>

      {/* File Info & Results */}
      <AnimatePresence>
        {fileName && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* File Header */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span className="font-medium text-sm">{fileName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-success-soft rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-success">{validCount} Valid</p>
                  <p className="text-xs text-muted-foreground">Ready to import</p>
                </div>
              </div>
              <div className={cn(
                'p-3 rounded-lg flex items-center gap-2',
                invalidCount > 0 ? 'bg-danger-soft' : 'bg-muted'
              )}>
                <AlertCircle className={cn('w-5 h-5', invalidCount > 0 ? 'text-danger' : 'text-muted-foreground')} />
                <div>
                  <p className={cn('text-sm font-medium', invalidCount > 0 ? 'text-danger' : 'text-muted-foreground')}>
                    {invalidCount} Invalid
                  </p>
                  <p className="text-xs text-muted-foreground">Will be skipped</p>
                </div>
              </div>
            </div>

            {/* Card List Preview */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 border-b border-border">
                <p className="text-sm font-medium">Preview ({parsedCards.length} cards)</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {parsedCards.slice(0, 50).map((card, index) => (
                  <div
                    key={index}
                    className={cn(
                      'px-3 py-2 flex items-center justify-between text-sm border-b border-border last:border-0',
                      card.valid ? 'bg-background' : 'bg-danger-soft/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {card.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                      )}
                      <span className="font-mono truncate">{card.uniqueId}</span>
                    </div>
                    {card.error && (
                      <span className="text-xs text-danger shrink-0 ml-2">{card.error}</span>
                    )}
                  </div>
                ))}
                {parsedCards.length > 50 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                    ... and {parsedCards.length - 50} more
                  </div>
                )}
              </div>
            </div>

            {/* Import Button */}
            <Button 
              onClick={handleImport} 
              className="w-full"
              disabled={validCount === 0}
            >
              <FileText className="w-4 h-4" />
              Import {validCount} Cards
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Text */}
      {!fileName && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">CSV Format:</p>
          <pre className="bg-muted rounded p-2 font-mono">
{`unique_id
QR-001-ABC
QR-002-DEF
CARD-123-XYZ`}
          </pre>
        </div>
      )}
    </div>
  );
};
