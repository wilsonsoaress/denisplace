#!/usr/bin/env bash
# Backup diario do Postgres da F1. Sem servidor de backup, o que protege e a
# regularidade: agende no cron da maquina e leve o arquivo para fora dela.
#   30 3 * * * cd /caminho/do/denisplace && npm run db:backup >> backups/backup.log 2>&1
set -euo pipefail

CONTAINER="${BACKUP_CONTAINER:-denisplace-db}"
USUARIO="${POSTGRES_USER:-denisplace}"
BANCO="${POSTGRES_DB:-denisplace}"
DIAS="${BACKUP_RETENCAO_DIAS:-14}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"

mkdir -p "$DIR"
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "backup: container $CONTAINER nao esta rodando (docker compose up -d db)" >&2
  exit 1
fi

agora="$(date +%Y-%m-%d_%H%M%S)"
arquivo="$DIR/denisplace-$agora.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$USUARIO" -d "$BANCO" --no-owner --no-privileges | gzip -9 > "$arquivo"

# Um dump truncado por erro no meio ainda gera arquivo: o piso de tamanho pega isso.
tamanho="$(stat -c%s "$arquivo")"
if [ "$tamanho" -lt 1024 ]; then
  echo "backup: saida suspeita ($tamanho bytes) em $arquivo" >&2
  exit 1
fi
echo "denisplace-$agora.sql.gz" > "$DIR/.latest"

# Retencao por idade: 14 dias cobrem o "descobri na sexta que segunda estava errada".
find "$DIR" -name 'denisplace-*.sql.gz' -mtime +"$DIAS" -delete

echo "backup: $arquivo ($tamanho bytes, retencao ${DIAS} dias)"
