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
  marketplaceDate?: string;
  marketplaceTime?: string;
  marketplaceLocation?: string;
}

export const EmailPreviewDialog = ({ 
  volunteerName, 
  volunteerEmail, 
  tempPassword = 'Abc123!@#xyz',
  qrCardId = 'VOL-PREVIEW-1234',
  customSubject,
  customGreeting,
  customMessage,
  marketplaceDate = 'February 19, 2026',
  marketplaceTime = '07.00 am - 01.30 pm',
  marketplaceLocation = 'Ajman, Al Hamidiya and Boys\' Community School Marketplace'
}: EmailPreviewDialogProps) => {
  const appUrl = 'https://gif.thesurpluss.com';
  const loginUrl = `${appUrl}/auth`;
  const trainingUrl = `${appUrl}/training`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCardId)}`;
  
  const firstName = volunteerName.split(' ')[0] || 'Volunteer';
  
  const emailSubject = customSubject || "Thank you for registering as a Gift It Forward volunteer";

  // Use public folder images for preview
  const heroImageUrl = '/images/email/gif-hero-banner.jpg';
  const trainingImageUrl = '/images/email/training-module-banner.jpg';
  const dubaiHoldingLogoUrl = '/images/email/dubai-holding-logo.png';
  const surplussLogoUrl = '/images/email/surpluss-logo.png';

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
          {/* Hero Image */}
          <div className="relative">
            <img 
              src={heroImageUrl}
              alt="Gift It Forward volunteers"
              className="w-full h-auto"
              style={{ display: 'block', maxHeight: '200px', objectFit: 'cover', objectPosition: 'center' }}
            />
          </div>
          
          {/* The Surpluss Logo */}
          <div className="flex justify-center pt-5">
            <img src={surplussLogoUrl} alt="The Surpluss" className="h-[45px]" />
          </div>
          
          {/* Red Vertical Line */}
          <div className="flex justify-center py-3">
            <div className="w-[2px] h-[50px] bg-[#DA291C]"></div>
          </div>
          
          {/* Main Title */}
          <div className="text-center px-6 py-6 bg-white">
            <h1 className="text-2xl font-normal text-gray-900 m-0">
              Thank you for registering<br />as a Gift It Forward volunteer
            </h1>
          </div>
          
          {/* Email Body */}
          <div className="px-6 py-4 bg-white space-y-5">
            <p className="text-gray-800 m-0"><strong>Dear {firstName},</strong></p>
            
            <p className="text-gray-700">
              Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>Gift It Forward marketplace</strong> taking place on:
            </p>
            
            {/* Event Details */}
            <ul className="text-gray-700 text-sm pl-5 m-0 space-y-1">
              <li><strong>Date:</strong> {marketplaceDate}</li>
              <li><strong>Location:</strong> {marketplaceLocation}</li>
              <li><strong>Timings:</strong> {marketplaceTime}</li>
            </ul>
            
            {/* Helpful Reminders */}
            <div>
              <p className="text-gray-700 text-sm mb-2">Here are a few helpful reminders before the event:</p>
              <div className="space-y-2 text-sm text-gray-700">
                <p><strong>a. Arrival:</strong> Gates open 15 minutes before the marketplace begins. We recommend arriving a bit early to allow time for a smooth check-in.</p>
                <p><strong>b. Your QR code:</strong> Please have your QR code ready on your phone – it helps us clock you in and out quickly.</p>
                <p><strong>c. Bring this email:</strong> Having this confirmation handy will help us welcome you at the venue without any delays.</p>
                <p><strong>d. Your registration:</strong> This registration is linked to your name, so please make sure you're the one attending.</p>
              </div>
            </div>
            
            {/* QR Code Section */}
            <div className="bg-gray-100 p-4 -mx-6 px-6">
              <h3 className="text-base font-bold text-gray-900 m-0 mb-2">Your volunteer QR code</h3>
              <p className="text-gray-700 text-sm mb-4">
                We recommend saving it on your phone and keeping a screenshot available offline.
              </p>
              <div className="inline-block">
                <img 
                  src={qrCodeUrl} 
                  alt="Volunteer QR Code" 
                  className="w-[150px] h-[150px] block"
                />
              </div>
              <p className="text-gray-500 text-sm mt-2 m-0">
                QR Card ID: {qrCardId}
              </p>
              
              <p className="text-gray-800 text-sm font-bold mt-4 mb-2">Your QR code allows you to:</p>
              <ul className="text-gray-700 text-sm pl-5 m-0 space-y-1">
                <li>Record your attendance.</li>
                <li>Track volunteer hours.</li>
                <li>Receive your official <strong>Gift It Forward 2026 volunteer certificate</strong>.</li>
              </ul>
            </div>
            
            {/* Login Credentials Section */}
            <div className="border-t-2 border-gray-200 pt-5 -mx-6 px-6">
              <p className="text-gray-800 text-sm font-bold underline mb-3">Your login credentials for the training & marketplace platform</p>
              <p className="text-gray-700 text-sm mb-3">
                You'll need these details to complete the <strong>Circular Economy Training Module</strong> and access the <strong>marketplace platform</strong> on event day:
              </p>
              <p className="text-gray-800 text-sm m-0"><strong>Email:</strong> {volunteerEmail}</p>
              <p className="text-gray-800 text-sm m-0 mb-4"><strong>Temporary Password:</strong> {tempPassword}</p>
              <p className="text-[#DA291C] text-sm font-bold">Please save these credentials – you'll need them to start the training below.</p>
            </div>
            
            {/* Training Section */}
            <div className="flex flex-col md:flex-row gap-0 mt-6 bg-white border border-gray-200 overflow-hidden">
              <div className="md:w-1/2">
                <img 
                  src={trainingImageUrl}
                  alt="Your Role in the Circular Economy"
                  className="w-full h-auto"
                />
              </div>
              <div className="md:w-1/2 p-4 flex flex-col justify-center">
                <h3 className="text-base font-bold text-gray-900 m-0 mb-2">Circular Economy Training Module</h3>
                <p className="text-gray-700 text-sm mb-4">
                  Before attending your first marketplace, we encourage volunteers to complete this short module. It introduces the campaign's sustainability goals and highlights how actions contribute to reducing waste. Volunteers who complete the training receive a certificate of completion.
                </p>
                <div>
                  <a 
                    href={trainingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-[#DA291C] text-white px-5 py-2.5 rounded font-semibold text-sm no-underline hover:bg-[#b8231a] transition-colors"
                  >
                    Start Training
                  </a>
                </div>
              </div>
            </div>
            
            {/* On-site Marketplace Access */}
            <div className="mt-6">
              <h3 className="text-base font-bold text-gray-900 m-0 mb-2">On-site marketplace access</h3>
              <p className="text-gray-700 text-sm mb-4">
                During the marketplace, you may be asked to use the Gift It Forward marketplace management platform via your web browser, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.
              </p>
              <div>
                <a 
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#DA291C] text-white px-5 py-2.5 rounded font-semibold text-sm no-underline hover:opacity-90 transition-opacity"
                >
                  Login to the platform
                </a>
              </div>
            </div>
            
            {/* What's Next Section */}
            <div className="mt-6">
              <h3 className="text-base font-bold text-gray-900 m-0 mb-2">What's next?</h3>
              <ul className="text-gray-700 text-sm pl-5 m-0 space-y-1">
                <li>Save this event to your calendar.</li>
                <li>Look out for reminder emails and WhatsApp notifications closer to each event.</li>
                <li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" className="text-[#0D4A6F]">giftitforward@dubaiholding.com</a>.</li>
                <li>If you or a family member have any specific medical conditions, please contact The Surpluss team ahead of the event so we can ensure a safe and supportive volunteering experience. You can reach the team at <a href="mailto:giftitforward@dubaiholding.com" className="text-[#0D4A6F]">giftitforward@dubaiholding.com</a>.</li>
              </ul>
            </div>
            
            {/* Closing */}
            <div className="mt-6">
              <p className="text-gray-700 text-sm">
                Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.
              </p>
              <p className="text-gray-800 text-sm mt-4 m-0">Best regards,</p>
              <p className="text-gray-900 font-semibold text-sm m-0">Gift It Forward team</p>
            </div>
            
            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center">
              <div>
                <img 
                  src={dubaiHoldingLogoUrl}
                  alt="Dubai Holding"
                  className="h-10"
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