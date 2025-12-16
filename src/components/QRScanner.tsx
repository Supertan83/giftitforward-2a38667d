import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { QrCode, X, Camera, AlertCircle, SwitchCamera, Flashlight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'error' | 'success';

export const QRScanner = ({ isOpen, onClose, onScan, title = 'Scan QR Code' }: QRScannerProps) => {
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.log('Scanner stop error:', err);
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    setStatus('requesting');
    setErrorMessage('');

    try {
      // Stop existing scanner if running
      await stopScanner();

      // Create new scanner instance
      scannerRef.current = new Html5Qrcode('qr-reader');

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const cameraConfig = useFrontCamera 
        ? { facingMode: 'user' } 
        : { facingMode: 'environment' };

      await scannerRef.current.start(
        cameraConfig,
        config,
        (decodedText) => {
          // Successfully scanned
          setScannedCode(decodedText);
          setStatus('success');
          
          // Vibrate on success if supported
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          // Auto-submit after brief delay
          setTimeout(() => {
            stopScanner();
            onScan(decodedText);
            setStatus('idle');
            setScannedCode(null);
          }, 500);
        },
        () => {
          // QR code not found in frame - this is normal, don't show error
        }
      );

      setStatus('scanning');
    } catch (err: any) {
      console.error('Scanner error:', err);
      setStatus('error');
      
      if (err.message?.includes('Permission') || err.name === 'NotAllowedError') {
        setErrorMessage('Camera permission denied. Please allow camera access and try again.');
      } else if (err.message?.includes('NotFoundError') || err.name === 'NotFoundError') {
        setErrorMessage('No camera found on this device.');
      } else {
        setErrorMessage(err.message || 'Failed to start camera. Please try again.');
      }
    }
  }, [useFrontCamera, onScan, stopScanner]);

  // Start scanner when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      setStatus('idle');
      setScannedCode(null);
      setErrorMessage('');
    }
  }, [isOpen, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleSwitchCamera = useCallback(async () => {
    setUseFrontCamera(!useFrontCamera);
    await stopScanner();
    setTimeout(startScanner, 100);
  }, [useFrontCamera, stopScanner, startScanner]);

  const handleManualSubmit = useCallback(() => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  }, [manualCode, onScan]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-4">
          {/* Camera Preview Area */}
          <div 
            ref={containerRef}
            className="relative aspect-square bg-foreground/5 rounded-xl overflow-hidden border-2 border-border"
          >
            {/* QR Scanner Container */}
            <div 
              id="qr-reader" 
              className={cn(
                "w-full h-full",
                status !== 'scanning' && "hidden"
              )}
            />

            {/* Scanning Overlay */}
            {status === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner markers */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
                
                {/* Scan line animation */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 w-56 h-0.5 bg-primary shadow-[0_0_10px_2px_hsl(var(--primary))]"
                  animate={{ 
                    top: ['calc(50% - 100px)', 'calc(50% + 100px)', 'calc(50% - 100px)']
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2, 
                    ease: 'easeInOut' 
                  }}
                />
              </div>
            )}

            {/* Success Flash */}
            <AnimatePresence>
              {status === 'success' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-success/90 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center text-success-foreground"
                  >
                    <div className="w-16 h-16 bg-success-foreground/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <p className="font-semibold">Scanned!</p>
                    <p className="text-sm opacity-80 font-mono">{scannedCode}</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading State */}
            {status === 'requesting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3"
                  />
                  <p className="text-sm text-muted-foreground">Starting camera...</p>
                </div>
              </div>
            )}

            {/* Idle State */}
            {status === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Initializing camera...
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-danger-soft">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-danger" />
                  </div>
                  <p className="text-sm text-danger font-medium mb-3">{errorMessage}</p>
                  <Button onClick={startScanner} size="sm">
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          {status === 'scanning' && (
            <div className="flex justify-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSwitchCamera}
                className="gap-2"
              >
                <SwitchCamera className="w-4 h-4" />
                Switch Camera
              </Button>
            </div>
          )}

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
            Point camera at QR code or enter ID manually
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
