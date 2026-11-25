-- =====================================================================
-- Noesia Family — tâches planifiées (rappels, photos éphémères, capsules…)
-- Appelle /api/cron de l'app toutes les 5 minutes, depuis Supabase.
-- Prérequis : Database → Extensions → activer "pg_cron" et "pg_net".
-- Remplacez <URL-DE-L-APP> (ex. https://noesia-family.vercel.app) et <CRON_SECRET>.
-- =====================================================================

select cron.unschedule('noesia-cron') where exists (select 1 from cron.job where jobname = 'noesia-cron');

select cron.schedule(
  'noesia-cron',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := '<URL-DE-L-APP>/api/cron',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 25000
  );
  $$
);

-- Nettoyage du journal des notifications (garde 60 jours)
select cron.unschedule('noesia-cron-log') where exists (select 1 from cron.job where jobname = 'noesia-cron-log');
select cron.schedule('noesia-cron-log', '17 3 * * *', $$ delete from public.notification_log where sent_at < now() - interval '60 days' $$);

-- Vérifier : select * from cron.job_run_details order by start_time desc limit 10;
