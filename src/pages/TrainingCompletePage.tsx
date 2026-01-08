import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ExternalLink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import surplussLogo from '@/assets/surpluss-full-logo.svg';

const TrainingCompletePage = () => {
  const navigate = useNavigate();

  const handleRetakeTraining = () => {
    navigate('/training');
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center"
      >
        <Card className="bg-card/95 backdrop-blur border-border/50">
          <CardContent className="pt-8 pb-8">
            <div className="flex justify-center mb-6">
              <img src={surplussLogo} alt="Surpluss" className="h-10" />
            </div>
            
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            
            <h1 className="font-display font-bold text-2xl mb-3">
              Thank You!
            </h1>
            
            <p className="text-muted-foreground mb-6">
              You've successfully completed the Circular Economy Training Module. Your certificate has been generated and emailed to you.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 text-left">
                <h3 className="font-semibold mb-2">What's Next?</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Share your learnings with colleagues</li>
                  <li>• Look for opportunities to apply circular practices</li>
                  <li>• Join us at upcoming Gift It Forward events</li>
                </ul>
              </div>

              <Button
                variant="default"
                className="w-full"
                onClick={handleRetakeTraining}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake Training
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open('https://thesurpluss.com', '_blank')}
              >
                Learn More About Surpluss
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-white/40 text-sm mt-6">
          © {new Date().getFullYear()} Surpluss. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

export default TrainingCompletePage;
