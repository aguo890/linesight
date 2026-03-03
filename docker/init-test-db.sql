-- Idempotent creation of the test database
SELECT 'CREATE DATABASE linesight_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'linesight_test')\gexec
