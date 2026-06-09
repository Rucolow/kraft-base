-- Extensions
-- pgcrypto: gen_random_uuid()
-- pg_cron: scheduled jobs (shift session auto-close)

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
