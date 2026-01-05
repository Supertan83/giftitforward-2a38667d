import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

interface EmailPreviewDialogProps {
  volunteerName: string;
  volunteerEmail: string;
  tempPassword?: string;
  qrCardId?: string;
}

export const EmailPreviewDialog = ({ 
  volunteerName, 
  volunteerEmail, 
  tempPassword = 'Abc123!@#xyz',
  qrCardId = 'VOL-PREVIEW-1234'
}: EmailPreviewDialogProps) => {
  const appUrl = 'https://gif.thesurpluss.com';
  const loginUrl = `${appUrl}/auth`;
  const trainingUrl = `${appUrl}/training`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCardId)}`;
  
  const firstName = volunteerName.split(' ')[0] || 'Volunteer';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-1" />
          Preview Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Welcome Email Preview</DialogTitle>
        </DialogHeader>
        
        {/* Email Preview Container */}
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Email Header */}
          <div 
            className="p-6 text-center"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            <h1 className="text-white text-2xl font-bold m-0">Welcome to Gift It Forward!</h1>
          </div>
          
          {/* Email Body */}
          <div className="p-6 bg-gray-50 space-y-6">
            <p className="text-lg m-0">Hi {firstName},</p>
            
            <p className="text-gray-700">
              Great news! Your volunteer registration has been confirmed. Here's everything you need to get started:
            </p>
            
            {/* QR Code Section */}
            <div className="bg-white border-2 border-emerald-500 rounded-xl p-5 text-center">
              <h3 className="text-emerald-600 font-semibold mb-1">🎫 Your Volunteer QR Card</h3>
              <p className="text-gray-500 text-sm mb-4">
                Present this QR code when checking in at marketplace events
              </p>
              <img 
                src={qrCodeUrl} 
                alt="Volunteer QR Code" 
                className="w-[180px] h-[180px] mx-auto block"
              />
              <p className="font-mono text-sm mt-3 bg-gray-100 py-2 px-3 rounded-md text-gray-700 inline-block">
                {qrCardId}
              </p>
            </div>
            
            {/* Training Module Section */}
            <div className="bg-amber-50 border border-amber-400 rounded-lg p-5">
              <h3 className="text-amber-700 font-semibold mb-2">📚 Required: Complete Training Module</h3>
              <p className="text-amber-800 text-sm mb-4">
                Before your first volunteer session, please complete our training module to earn your Training Certificate.
              </p>
              <div className="text-center">
                <a 
                  href={trainingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold no-underline hover:bg-amber-600 transition-colors"
                >
                  Start Training
                </a>
              </div>
            </div>
            
            {/* Login Credentials */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-emerald-600 font-semibold mb-3">🔐 Your Login Credentials</h3>
              <p className="my-2"><strong>Email:</strong> {volunteerEmail}</p>
              <p className="my-2">
                <strong>Temporary Password:</strong>{' '}
                <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                  {tempPassword}
                </code>
              </p>
            </div>
            
            {/* Login Button */}
            <div className="text-center py-4">
              <a 
                href={loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-emerald-500 text-white px-7 py-3.5 rounded-lg font-semibold text-base no-underline hover:bg-emerald-600 transition-colors"
              >
                Log In Now
              </a>
            </div>
            
            <p className="text-gray-500 text-sm">
              For security, please change your password after your first login.
            </p>
            
            <hr className="border-gray-200 my-6" />
            
            <p className="text-gray-500 text-sm">
              Thank you for joining our volunteer community!<br />
              <strong>The GIF (Gift It Forward) Team</strong>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
