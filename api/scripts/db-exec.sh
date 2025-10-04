#!/usr/bin/env bash
set -euo pipefail

# Resolve project root (api directory is parent of scripts)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="${SCRIPT_DIR%/scripts}"

# Load .env if present
if [ -f "$API_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$API_DIR/.env"
  set +a
fi

# Default params (can be overridden by environment)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-mux}"

STMT="${1:-SHOW TABLES;}"

if command -v mysql >/dev/null 2>&1; then
  if [ -S "/var/run/mysqld/mysqld.sock" ]; then
    MYSQL_PWD="$DB_PASSWORD" mysql --protocol=SOCKET -S /var/run/mysqld/mysqld.sock -u "$DB_USER" "$DB_NAME" -e "$STMT"
  else
    MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" -e "$STMT"
  fi
else
  echo "mysql client not found. Please install mysql-client." >&2
  exit 127
fi

