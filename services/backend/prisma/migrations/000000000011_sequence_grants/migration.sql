-- Transactional tables use bigint PKs backed by sequences; the app role
-- had table grants but not sequence usage (reservations_id_seq etc.).

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO openplay_app;
