-- Initial database initialization script
-- This runs as part of MySQL container first-start via docker-entrypoint-initdb.d
-- Ensures the xinhuo user has proper permissions on the xinhuo database.

GRANT ALL PRIVILEGES ON xinhuo.* TO 'xinhuo'@'%';
FLUSH PRIVILEGES;
