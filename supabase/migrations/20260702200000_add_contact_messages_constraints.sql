-- ═══════════════════════════════════════════════════════════════
-- Add Proper Database Validations (Check Constraints)
-- ═══════════════════════════════════════════════════════════════

-- 1. Clean up or normalize any test submissions that don't match the new constraints
UPDATE public.contact_messages 
SET subject = 'feedback' 
WHERE subject NOT IN ('feedback', 'bug', 'feature', 'business') OR subject IS NULL;

UPDATE public.contact_messages 
SET name = 'Anonymous User' 
WHERE length(trim(name)) < 2 OR name IS NULL;

UPDATE public.contact_messages 
SET message = 'Message content was adjusted during migration cleanup.' 
WHERE length(trim(message)) < 10 OR message IS NULL;

-- 2. Add validation check constraints to contact_messages table
ALTER TABLE public.contact_messages
  -- Ensure Name is between 2 and 100 characters and not blank
  ADD CONSTRAINT chk_name_length CHECK (length(trim(name)) >= 2 AND length(name) <= 100),
  
  -- Ensure Email is standard format and fits RFC limit
  ADD CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+!-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND length(email) <= 254),
  
  -- Ensure Subject is one of our allowed options
  ADD CONSTRAINT chk_subject_value CHECK (subject IN ('feedback', 'bug', 'feature', 'business')),
  
  -- Ensure Message is between 10 and 5000 characters and not blank
  ADD CONSTRAINT chk_message_length CHECK (length(trim(message)) >= 10 AND length(message) <= 5000);
