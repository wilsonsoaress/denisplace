-- A F1 ja nasceu com User (papel ADMIN/COMERCIAL/FINANCEIRO/TECNICO) e AuditLog no schema.
-- Esta migracao desfaz as tabelas duplicadas criadas a pouco e da ao User o ultimo acesso.

DROP TABLE IF EXISTS "auditoria_eventos";
DROP TABLE IF EXISTS "usuarios";
DROP TYPE IF EXISTS "Perfil";

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_access_at" TIMESTAMP(3);
