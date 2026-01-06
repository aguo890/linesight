-- LineSight MySQL Initialization Script
-- This runs on first container startup to configure the database

-- Ensure proper character set
ALTER DATABASE linesight CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges to app user
GRANT ALL PRIVILEGES ON linesight.* TO 'linesight'@'%';
FLUSH PRIVILEGES;

-- Log initialization
SELECT 'LineSight database initialized successfully' AS status;
