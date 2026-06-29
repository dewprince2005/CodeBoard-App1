-- Schedule a cron job to permanently purge audit logs older than 1 day
-- Runs every hour to maintain a strict 24-hour log retention window
SELECT cron.schedule(
  'purge-audit-logs-1-day',
  '0 * * * *',
  $$DELETE FROM public.audit_logs WHERE created_at < now() - INTERVAL '1 day'$$
);
