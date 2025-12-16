import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export const QRScanner = ({ isOpen, onClose, onScan, title = 'Scan QR Code' }: QRScannerProps) => {
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleManualSubmit = useCallback(() => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  }, [manualCode, onScan]);

  const simulateScan = useCallback(() => {
    setIsScanning(true);
    // Simulate scanning delay
    setTimeout(() => {
      setIsScanning(false);
      onScan('DEMO-CARD');
    }, 1500);
  }, [onScan]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Camera Preview Area */}
          <div className="relative aspect-square bg-foreground/5 rounded-xl overflow-hidden border-2 border-dashed border-border">
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatePresence>
                {isScanning ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-24 h-24 border-4 border-primary rounded-2xl mx-auto mb-4"
                    />
                    <p className="text-sm text-muted-foreground">Scanning...</p>
                    {/* Scan line animation */}
                    <motion.div
                      className="absolute left-4 right-4 h-0.5 bg-primary"
                      animate={{ y: [-100, 100, -100] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center p-6"
                  >
                    <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Camera preview would appear here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      (In production, this uses device camera)
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Simulate Scan Button */}
          <Button 
            onClick={simulateScan} 
            variant="scan" 
            className="w-full"
            disabled={isScanning}
          >
            <QrCode className="w-5 h-5" />
            {isScanning ? 'Scanning...' : 'Simulate QR Scan'}
          </Button>

          {/* Manual Entry */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or enter manually
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter QR code ID..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              className="flex-1"
            />
            <Button onClick={handleManualSubmit} disabled={!manualCode.trim()}>
              Submit
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Try: <span className="font-mono bg-muted px-2 py-0.5 rounded">DEMO-CARD</span> or{' '}
            <span className="font-mono bg-muted px-2 py-0.5 rounded">QR-002-DEF</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
