-- Shift session auto-close.
-- Closes any session still open at 04:00 JST: ended_at is null and started_at is
-- before today's 04:00 JST boundary. pg_cron runs in UTC, so 04:00 JST == 19:00 UTC.

create or replace function public.close_stale_shift_sessions()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.shift_session
     set ended_at = now()
   where ended_at is null
     and started_at <
       ((date_trunc('day', now() at time zone 'Asia/Tokyo') + interval '4 hours')
        at time zone 'Asia/Tokyo');
$$;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'close-stale-shift-sessions';

select cron.schedule(
  'close-stale-shift-sessions',
  '0 19 * * *',
  $$select public.close_stale_shift_sessions();$$
);
