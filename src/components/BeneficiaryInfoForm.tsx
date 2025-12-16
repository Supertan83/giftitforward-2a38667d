import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Heart, Baby, Globe, Check, X } from 'lucide-react';
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
  maritalStatus: string;
  childrenCount: number;
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
  const [maritalStatus, setMaritalStatus] = useState<string>('');
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [nationality, setNationality] = useState<string>('');

  const handleSubmit = () => {
    onSubmit({
      gender,
      maritalStatus,
      childrenCount,
      nationality
    });
    // Reset form
    setGender('');
    setMaritalStatus('');
    setChildrenCount(0);
    setNationality('');
  };

  const isValid = gender && maritalStatus && nationality;

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

          {/* Marital Status */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Marital Status *
            </Label>
            <Select value={maritalStatus} onValueChange={setMaritalStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select marital status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Number of Children */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Baby className="w-4 h-4" />
              Number of Children
            </Label>
            <Input
              type="number"
              min={0}
              max={20}
              value={childrenCount}
              onChange={(e) => setChildrenCount(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
            />
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
