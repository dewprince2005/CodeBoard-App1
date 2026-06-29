-- Add deleted_at column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Enable pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a cron job to permanently purge soft-deleted tasks older than 30 days
-- Runs every day at midnight (UTC)
SELECT cron.schedule(
  'purge-deleted-tasks-30-days',
  '0 0 * * *',
  $$DELETE FROM public.tasks WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days'$$
);
