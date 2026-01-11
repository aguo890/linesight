-- Fix the production_events foreign key constraint
-- The constraint currently points to production_lines but should point to data_sources

USE linesight;

-- Drop the incorrect constraint
ALTER TABLE production_events DROP FOREIGN KEY production_events_ibfk_1;

-- Add the correct constraint
ALTER TABLE production_events 
ADD CONSTRAINT production_events_ibfk_1 
FOREIGN KEY (data_source_id) 
REFERENCES data_sources(id) 
ON DELETE CASCADE;

-- Verify the fix
SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA='linesight' 
  AND TABLE_NAME='production_events' 
  AND CONSTRAINT_NAME='production_events_ibfk_1';
