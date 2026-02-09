#!/bin/bash
set -e

# Create all databases needed by CodeCircle services
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE fixai;
    CREATE DATABASE metrics_explorer;
    CREATE DATABASE logs_explorer;
    CREATE DATABASE code_parser;
    CREATE DATABASE codecircle;
EOSQL

echo "All CodeCircle databases created successfully."
