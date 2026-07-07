-- ═══════════════════════════════════════════════════════════════
-- Real-time Task Alerts Database Trigger (n8n Webhook Integration)
-- ═══════════════════════════════════════════════════════════════

-- 1. Create webhook_settings table to store webhook URLs dynamically
CREATE TABLE IF NOT EXISTS public.webhook_settings (
  key         TEXT         PRIMARY KEY,
  value       TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins and moderators to manage webhook settings
CREATE POLICY "Admins and moderators can manage webhook_settings" 
ON public.webhook_settings FOR ALL 
USING (
  public.get_user_role() IN ('admin', 'moderator')
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'moderator')
);

-- Insert a default placeholder for n8n task alert webhook
INSERT INTO public.webhook_settings (key, value)
VALUES ('n8n_task_alert_url', '')
ON CONFLICT (key) DO NOTHING;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.on_task_created_n8n()
RETURNS trigger AS $$
DECLARE
  webhook_url TEXT;
BEGIN
  -- Retrieve the configured webhook URL dynamically from the settings table
  SELECT value INTO webhook_url 
  FROM public.webhook_settings 
  WHERE key = 'n8n_task_alert_url';

  -- Only trigger the webhook call if the URL is configured
  IF webhook_url IS NOT NULL AND webhook_url <> '' THEN
    PERFORM supabase_functions.http_request(
      webhook_url,
      'POST',
      '{"Content-Type": "application/json"}',
      jsonb_build_object(
        'event', 'task_created',
        'id', NEW.id,
        'title', NEW.title,
        'is_completed', NEW.is_completed,
        'user_id', NEW.user_id,
        'created_at', NEW.created_at
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to the public.tasks table
DROP TRIGGER IF EXISTS on_task_created_n8n_trigger ON public.tasks;
CREATE TRIGGER on_task_created_n8n_trigger
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.on_task_created_n8n();
