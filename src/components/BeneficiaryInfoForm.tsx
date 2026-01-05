import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Globe, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface BeneficiaryInfo {
  gender: string;
  nationality: string;
}

interface BeneficiaryInfoFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (info: BeneficiaryInfo) => void;
  cardId: string;
}

const NATIONALITIES = [
  'Afghan',
  'Syrian',
  'Iraqi',
  'Yemeni',
  'Palestinian',
  'Sudanese',
  'Somali',
  'Eritrean',
  'Ethiopian',
  'Pakistani',
  'Bangladeshi',
  'Other'
];

export const BeneficiaryInfoForm = ({
  isOpen,
  onClose,
  onSubmit,
  cardId
}: BeneficiaryInfoFormProps) => {
  const [gender, setGender] = useState<string>('');
  const [nationality, setNationality] = useState<string>('');

  const handleSubmit = () => {
    onSubmit({
      gender,
      nationality
    });
    // Reset form
    setGender('');
    setNationality('');
  };

  const isValid = gender && nationality;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Beneficiary Information
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground mb-4 bg-muted/50 p-2 rounded">
          Card: <span className="font-mono font-medium">{cardId}</span>
        </div>

        <div className="space-y-4">
          {/* Gender */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Gender *
            </Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Nationality *
            </Label>
            <Select value={nationality} onValueChange={setNationality}>
              <SelectTrigger>
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map((nat) => (
                  <SelectItem key={nat} value={nat.toLowerCase()}>
                    {nat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            <Check className="w-4 h-4 mr-2" />
            Activate Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
