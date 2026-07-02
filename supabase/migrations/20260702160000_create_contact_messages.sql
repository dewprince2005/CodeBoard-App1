-- ═══════════════════════════════════════════════════════════════
-- Email Automation & Contact Messages Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. Create contact_messages table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  subject     TEXT,
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow anyone to submit contact messages (required for public contact form)
CREATE POLICY "Anyone can submit contact messages" 
ON public.contact_messages FOR INSERT 
WITH CHECK (true);

-- Allow admins and moderators to view contact messages
CREATE POLICY "Admins and moderators can view contact messages" 
ON public.contact_messages FOR SELECT 
USING (
  public.get_user_role() IN ('admin', 'moderator')
);

-- 4. Create supabase_functions schema and http_request wrapper function if not exists
CREATE SCHEMA IF NOT EXISTS supabase_functions;

CREATE OR REPLACE FUNCTION supabase_functions.http_request(
  url TEXT,
  method TEXT,
  headers TEXT,
  body TEXT
) RETURNS void AS $$
DECLARE
  headers_jsonb JSONB;
  body_jsonb JSONB;
BEGIN
  -- Parse headers and body to jsonb
  headers_jsonb := headers::jsonb;
  body_jsonb := body::jsonb;

  -- If pg_net is available, invoke it
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF upper(method) = 'POST' THEN
      PERFORM net.http_post(
        url := url,
        headers := headers_jsonb,
        body := body_jsonb
      );
    ELSE
      RAISE WARNING 'Only POST method is supported by supabase_functions.http_request wrapper in this environment.';
    END IF;
  ELSE
    RAISE WARNING 'pg_net extension is not installed. Cannot perform HTTP request to: %', url;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create Trigger function to call Edge Function on INSERT
CREATE OR REPLACE FUNCTION public.on_contact_message_inserted()
RETURNS trigger AS $$
DECLARE
  project_ref TEXT := 'syjlssrxnrhjiszpxuoj';
  function_url TEXT;
BEGIN
  -- Standard production URL or local Kong routing
  -- For local testing, Kong is exposed on port 8000 (accessible from inside the container via host.docker.internal or kong:8000)
  -- By default we target the production edge function URL based on project_id in config.toml
  function_url := 'https://' || project_ref || '.supabase.co/functions/v1/send-email';

  PERFORM supabase_functions.http_request(
    function_url,
    'POST',
    '{"Content-Type": "application/json"}',
    jsonb_build_object('record', row_to_json(NEW))::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Trigger to contact_messages table
DROP TRIGGER IF EXISTS on_new_contact ON public.contact_messages;
CREATE TRIGGER on_new_contact
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contact_message_inserted();
