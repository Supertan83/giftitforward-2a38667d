-- Drop the existing check constraint and recreate with 'duplicate' status added
ALTER TABLE pending_volunteers DROP CONSTRAINT IF EXISTS pending_volunteers_status_check;

ALTER TABLE pending_volunteers ADD CONSTRAINT pending_volunteers_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate'));