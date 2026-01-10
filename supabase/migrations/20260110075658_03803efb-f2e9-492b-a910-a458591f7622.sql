-- Drop permissive RLS policies on volunteer_surveys table
DROP POLICY IF EXISTS "Anyone can update survey by token" ON volunteer_surveys;
DROP POLICY IF EXISTS "Anyone can view survey by token" ON volunteer_surveys;

-- The "Staff can manage volunteer surveys" policy already exists and provides proper access control