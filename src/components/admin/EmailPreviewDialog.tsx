import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

interface EmailPreviewDialogProps {
  volunteerName: string;
  volunteerEmail: string;
  tempPassword?: string;
  qrCardId?: string;
  customSubject?: string;
  customGreeting?: string;
  customMessage?: string;
}

export const EmailPreviewDialog = ({ 
  volunteerName, 
  volunteerEmail, 
  tempPassword = 'Abc123!@#xyz',
  qrCardId = 'VOL-PREVIEW-1234',
  customSubject,
  customGreeting,
  customMessage
}: EmailPreviewDialogProps) => {
  const appUrl = 'https://gif.thesurpluss.com';
  const loginUrl = `${appUrl}/auth`;
  const trainingUrl = `${appUrl}/training`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCardId)}`;
  
  const firstName = volunteerName.split(' ')[0] || 'Volunteer';
  
  const emailSubject = customSubject || "Thank you for Registering as a Gift It Forward Volunteer!";

  // Hero image hosted publicly
  const heroImageUrl = 'https://zrzlzggixuogpxberdxt.supabase.co/storage/v1/object/public/email-assets/gif-hero-banner.jpg';
  const trainingImageUrl = 'https://zrzlzggixuogpxberdxt.supabase.co/storage/v1/object/public/email-assets/training-module-banner.jpg';
  const dubaiHoldingLogoUrl = 'https://zrzlzggixuogpxberdxt.supabase.co/storage/v1/object/public/email-assets/dubai-holding-logo.png';

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
          <p className="text-sm text-muted-foreground">Subject: {emailSubject}</p>
        </DialogHeader>
        
        {/* Email Preview Container */}
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Hero Image with Logo */}
          <div className="relative">
            <img 
              src={heroImageUrl}
              alt="Gift It Forward volunteers"
              className="w-full h-auto"
              style={{ display: 'block', maxHeight: '200px', objectFit: 'cover', objectPosition: 'center' }}
            />
          </div>
          
          {/* Execution Partner Label */}
          <div className="text-center py-4 bg-white">
            <p className="text-xs tracking-widest text-[#B8860B] font-semibold m-0">EXECUTION PARTNER</p>
          </div>
          
          {/* Main Title */}
          <div className="text-center px-6 pb-4 bg-white">
            <h1 className="text-2xl font-bold text-gray-900 m-0">
              Thank you for Registering as a<br />Gift It Forward Volunteer!
            </h1>
          </div>
          
          {/* Email Body */}
          <div className="px-6 py-4 bg-white space-y-5">
            <p className="text-gray-800 m-0">Dear {`{{custom.first_name}}`},</p>
            
            <p className="text-gray-700">
              Thank you for registering as a Gift It Forward Volunteer. We're delighted to have you join us. 
              Your volunteer registration has been successfully confirmed.
            </p>
            
            <p className="text-gray-700">
              Below are the key details you'll need to prepare for your volunteering experience:
            </p>
            
            {/* QR Code Section */}
            <div className="mt-6">
              <h3 className="text-base font-bold text-gray-900 m-0 mb-2">Your Volunteer QR Code</h3>
              <p className="text-gray-700 text-sm mb-1">
                Please keep this QR code handy. It will be scanned at both check-in and check-out at each marketplace you attend.
              </p>
              <p className="text-gray-700 text-sm mb-4">
                This allows us to record your attendance and issue your volunteer certificate.
              </p>
              <div className="inline-block">
                <img 
                  src={qrCodeUrl} 
                  alt="Volunteer QR Code" 
                  className="w-[150px] h-[150px] block"
                />
              </div>
              <p className="text-gray-500 text-sm mt-2 m-0">
                QR Card ID: {`{{custom.qr_card_id}}`}
              </p>
            </div>
            
            {/* Training Section */}
            <div className="flex flex-col md:flex-row gap-4 mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="md:w-1/2">
                <img 
                  src={trainingImageUrl}
                  alt="Your Role in the Circular Economy"
                  className="w-full h-auto"
                />
              </div>
              <div className="md:w-1/2 p-4 flex flex-col justify-center">
                <h3 className="text-base font-bold text-gray-900 m-0 mb-2">Mandatory Sustainability Training</h3>
                <p className="text-gray-700 text-sm mb-4">
                  Before attending your first marketplace, all volunteers are required to complete a short sustainability training. 
                  It introduces the campaign's sustainability goals and highlights how your actions contribute to reducing waste and creating impact.
                </p>
                <div>
                  <a 
                    href={trainingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-[#0D4A6F] text-white px-5 py-2.5 rounded font-semibold text-sm no-underline hover:bg-[#0a3d5c] transition-colors"
                  >
                    Start Training
                  </a>
                </div>
              </div>
            </div>
            
            {/* On-site Marketplace App Access */}
            <div className="mt-6">
              <h3 className="text-base font-bold text-gray-900 m-0 mb-2">On-site Marketplace App Access</h3>
              <p className="text-gray-700 text-sm mb-3">
                During the marketplace, you may be asked to use the Gift It Forward marketplace management app, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.
              </p>
              <p className="text-gray-700 text-sm mb-2">Your login credentials are as follows:</p>
              <p className="text-gray-800 text-sm m-0">Email: {`{{custom.email}}`}</p>
              <p className="text-gray-800 text-sm m-0 mb-4">Temporary Password: {`{{custom.temp_password}}`}</p>
              <div>
                <a 
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#B8860B] text-white px-5 py-2.5 rounded font-semibold text-sm no-underline hover:opacity-90 transition-opacity"
                >
                  Login to the App
                </a>
              </div>
            </div>
            
            {/* What's Next Section */}
            <div className="mt-6">
              <h3 className="text-base font-bold text-gray-900 m-0 mb-2">What's Next?</h3>
              <ul className="text-gray-700 text-sm pl-5 m-0 space-y-1">
                <li>Mark your calendar</li>
                <li>Look out for reminder emails and WhatsApp notifications closer to each event</li>
                <li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" className="text-[#0D4A6F]">giftitforward@dubaiholding.com</a></li>
              </ul>
            </div>
            
            {/* Closing */}
            <div className="mt-6">
              <p className="text-gray-700 text-sm">
                Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.
              </p>
              <p className="text-gray-800 text-sm mt-4 m-0">Best Regards,</p>
              <p className="text-gray-900 font-semibold text-sm m-0">Gift It Forward Team</p>
            </div>
            
            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center">
              <div>
                <img 
                  src={dubaiHoldingLogoUrl}
                  alt="Dubai Holding"
                  className="h-8"
                />
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs italic m-0">For the Good of Tomorrow</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
