#!/usr/bin/env bash
# Restaura um dump feito por backup.sh. Isso substitui TODO o conteudo do banco
# alvo, entao a confirmacao pede o nome do banco digitado, nao um "s".
set -euo pipefail

CONTAINER="${RESTORE_CONTAINER:-denisplace-db}"
USUARIO="${POSTGRES_USER:-denisplace}"
BANCO="${POSTGRES_DB:-denisplace}"
ARQUIVO="${1:?uso: npm run db:restore -- backups/denisplace-2026-10-24_033000.sql.gz}"

[ -f "$ARQUIVO" ] || { echo "arquivo nao encontrado: $ARQUIVO" >&2; exit 1; }

echo "Vai dropar e recriar o banco '$BANCO' em $CONTAINER a partir de $ARQUIVO."
read -r -p "Digite o nome do banco para continuar: " confirma
[ "$confirma" = "$BANCO" ] || { echo "cancelado: nada foi tocado."; exit 1; }

docker exec -i "$CONTAINER" psql -U "$USUARIO" -d postgres -q \
  -c "DROP DATABASE IF EXISTS \"$BANCO\" WITH (FORCE);" \
  -c "CREATE DATABASE \"$BANCO\" OWNER \"$USUARIO\";"

gunzip -c "$ARQUIVO" | docker exec -i "$CONTAINER" psql -U "$USUARIO" -d "$BANCO" -q -v ON_ERROR_STOP=1
echo "restaurado: $ARQUIVO -> $BANCO"
