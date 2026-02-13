import React from 'react';
import { ArrowLeft, Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface VolunteerSchemaExportProps {
  onBack: () => void;
}

const SCHEMA_TEXT = `========================================
VOLUNTEER SCHEMA FOR SURPLUSS IT
========================================

1. PENDING VOLUNTEERS TABLE (pending_volunteers)
-------------------------------------------------
id                          UUID (PK, auto-generated)
first_name                  TEXT (required)
last_name                   TEXT (required)
email                       TEXT (required)
phone_number                TEXT (nullable)
gender                      TEXT (nullable) — e.g. "Male", "Female"
status                      TEXT (default: "pending") — pending | approved | rejected
is_employee                 BOOLEAN (default: false)
employee_vertical           TEXT (nullable) — department/vertical
employee_join_date          TEXT (nullable)
employee_number             TEXT (nullable)
external_company            TEXT (nullable) — company name if not employee
events_list                 TEXT (nullable) — comma-separated event slugs
events_json                 JSONB (nullable) — structured event data
has_medical_condition        BOOLEAN (default: false)
medical_condition_details   TEXT (nullable)
is_fasting                  BOOLEAN (default: false)
emergency_contact_name      TEXT (nullable)
emergency_contact_relationship TEXT (nullable)
emergency_contact_number    TEXT (nullable)
source                      TEXT (default: "webhook") — webhook | manual | bulk_upload
source_data                 JSONB (nullable) — raw source payload
training_completed          BOOLEAN (default: false)
training_completed_at       TIMESTAMP WITH TIME ZONE (nullable)
email_sent                  BOOLEAN (default: false)
email_sent_at               TIMESTAMP WITH TIME ZONE (nullable)
email_send_count            INTEGER (default: 0)
email_opened                BOOLEAN (default: false)
email_opened_at             TIMESTAMP WITH TIME ZONE (nullable)
certificate_sent_at         TIMESTAMP WITH TIME ZONE (nullable)
approved_by                 UUID (nullable)
approved_at                 TIMESTAMP WITH TIME ZONE (nullable)
created_user_id             UUID (nullable)
temp_password               TEXT (nullable)
rejection_reason            TEXT (nullable)
webhook_event_id            UUID (nullable)
created_at                  TIMESTAMP WITH TIME ZONE (auto)
updated_at                  TIMESTAMP WITH TIME ZONE (auto)

2. VOLUNTEER QR CARDS TABLE (volunteer_qr_cards)
-------------------------------------------------
id                UUID (PK, auto-generated)
unique_id         TEXT (required) — QR code identifier
volunteer_id      UUID (nullable, FK → pending_volunteers.id)
marketplace_id    UUID (nullable, FK → marketplace_events.id)
status            TEXT (default: "inactive") — inactive | checked_in | checked_out
assigned_zone     ENUM (nullable) — volunteer_zone type
checked_in_at     TIMESTAMP WITH TIME ZONE (nullable)
checked_out_at    TIMESTAMP WITH TIME ZONE (nullable)
total_hours_worked NUMERIC (default: 0)
survey_sent_at    TIMESTAMP WITH TIME ZONE (nullable)
survey_completed_at TIMESTAMP WITH TIME ZONE (nullable)
created_at        TIMESTAMP WITH TIME ZONE (auto)
updated_at        TIMESTAMP WITH TIME ZONE (auto)

3. VOLUNTEER ATTENDANCE TABLE (volunteer_attendance)
----------------------------------------------------
id                UUID (PK, auto-generated)
volunteer_card_id UUID (required, FK → volunteer_qr_cards.id)
marketplace_id    UUID (nullable, FK → marketplace_events.id)
check_in_time     TIMESTAMP WITH TIME ZONE (default: now())
check_out_time    TIMESTAMP WITH TIME ZONE (nullable)
hours_worked      NUMERIC (nullable)
created_at        TIMESTAMP WITH TIME ZONE (auto)

4. VOLUNTEER SURVEYS TABLE (volunteer_surveys)
----------------------------------------------
id                     UUID (PK, auto-generated)
volunteer_id           UUID (nullable, FK → pending_volunteers.id)
volunteer_card_id      UUID (nullable, FK → volunteer_qr_cards.id)
marketplace_id         UUID (nullable, FK → marketplace_events.id)
volunteer_name         TEXT (required)
volunteer_email        TEXT (required)
survey_token           TEXT (required, unique)
experience_word        TEXT (nullable)
improvement_suggestions TEXT (nullable)
would_volunteer_again  BOOLEAN (nullable)
certificate_sent_at    TIMESTAMP WITH TIME ZONE (nullable)
completed_at           TIMESTAMP WITH TIME ZONE (nullable)
created_at             TIMESTAMP WITH TIME ZONE (auto)
updated_at             TIMESTAMP WITH TIME ZONE (auto)

5. MARKETPLACE EVENTS TABLE (marketplace_events)
-------------------------------------------------
id                          UUID (PK, auto-generated)
name                        TEXT (required)
location                    TEXT (nullable)
status                      TEXT (default: "upcoming") — upcoming | active | completed
event_date                  DATE (nullable)
start_time                  TIME (nullable)
end_time                    TIME (nullable)
external_id                 INTEGER (nullable) — Surpluss event ID
outreach_partner            TEXT (nullable)
beneficiary_credit_limit    INTEGER (default: 15)
demographics_target         INTEGER (default: 0)
demographics_reach          INTEGER (default: 0)
demographics_total_families INTEGER (default: 0)
demographics_total_adults   INTEGER (default: 0)
demographics_total_children INTEGER (default: 0)
demographics_male_adults    INTEGER (default: 0)
demographics_female_adults  INTEGER (default: 0)
demographics_male_children  INTEGER (default: 0)
demographics_female_children INTEGER (default: 0)
demographics_nationalities  JSONB (default: {})
demographics_notes          TEXT (nullable)
demographics_updated_at     TIMESTAMP WITH TIME ZONE (nullable)
created_at                  TIMESTAMP WITH TIME ZONE (auto)
updated_at                  TIMESTAMP WITH TIME ZONE (auto)

6. CURRENT SYNC PAYLOAD (sent to Surpluss API)
-----------------------------------------------
{
  "name": "First Last",
  "email": "volunteer@example.com",
  "phone": "+971...",
  "source": "API"
}

========================================
END OF SCHEMA
========================================`;

export const VolunteerSchemaExport = ({ onBack }: VolunteerSchemaExportProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_TEXT);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Schema copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Mobile fallback
      const textArea = document.createElement('textarea');
      textArea.value = SCHEMA_TEXT;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast({ title: 'Copied!', description: 'Schema copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ title: 'Copy failed', description: 'Please use the Download button instead', variant: 'destructive' });
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([SCHEMA_TEXT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'volunteer-schema.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: 'volunteer-schema.txt saved' });
  };

  return (
    <div className="py-4 md:py-6 px-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl md:text-2xl font-display font-bold">Volunteer Schema Export</h1>
      </div>

      <div className="flex gap-3 mb-4">
        <Button onClick={handleCopy} size="lg" className="flex-1">
          {copied ? <Check className="h-5 w-5 mr-2" /> : <Copy className="h-5 w-5 mr-2" />}
          {copied ? 'Copied!' : 'Copy All'}
        </Button>
        <Button onClick={handleDownload} variant="secondary" size="lg" className="flex-1">
          <Download className="h-5 w-5 mr-2" />
          Download .txt
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Schema Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg overflow-auto max-h-[60vh]">
            {SCHEMA_TEXT}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
