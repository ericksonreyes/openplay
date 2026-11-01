-- Baseline migration: extensions and the non-superuser RLS role are
-- installed by docker/postgres/initdb on first database creation.
SELECT 1;
