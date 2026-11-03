-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('INICIO', 'CADASTROS', 'ORCAMENTOS', 'CONTRATOS', 'FINANCEIRO', 'AUDITORIA', 'USUARIOS');

-- CreateEnum
CREATE TYPE "NivelAcesso" AS ENUM ('NENHUM', 'VER', 'EDITAR');

-- CreateTable
CREATE TABLE "permissoes_perfil" (
    "id" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "nivel" "NivelAcesso" NOT NULL,

    CONSTRAINT "permissoes_perfil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_perfil_papel_modulo_key" ON "permissoes_perfil"("papel", "modulo");

-- SeedData: espelha exatamente a matriz hardcoded que existia em src/auth/perfis.ts,
-- para o comportamento nao mudar em nenhum ambiente ate o administrador editar algo.
INSERT INTO "permissoes_perfil" ("id", "papel", "modulo", "nivel") VALUES
  (gen_random_uuid()::text, 'ADMIN', 'INICIO', 'VER'),
  (gen_random_uuid()::text, 'ADMIN', 'CADASTROS', 'EDITAR'),
  (gen_random_uuid()::text, 'ADMIN', 'ORCAMENTOS', 'EDITAR'),
  (gen_random_uuid()::text, 'ADMIN', 'CONTRATOS', 'EDITAR'),
  (gen_random_uuid()::text, 'ADMIN', 'FINANCEIRO', 'EDITAR'),
  (gen_random_uuid()::text, 'ADMIN', 'AUDITORIA', 'VER'),
  (gen_random_uuid()::text, 'ADMIN', 'USUARIOS', 'EDITAR'),
  (gen_random_uuid()::text, 'COMERCIAL', 'INICIO', 'VER'),
  (gen_random_uuid()::text, 'COMERCIAL', 'CADASTROS', 'EDITAR'),
  (gen_random_uuid()::text, 'COMERCIAL', 'ORCAMENTOS', 'EDITAR'),
  (gen_random_uuid()::text, 'COMERCIAL', 'CONTRATOS', 'VER'),
  (gen_random_uuid()::text, 'COMERCIAL', 'FINANCEIRO', 'VER'),
  (gen_random_uuid()::text, 'COMERCIAL', 'AUDITORIA', 'NENHUM'),
  (gen_random_uuid()::text, 'COMERCIAL', 'USUARIOS', 'NENHUM'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'INICIO', 'VER'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'CADASTROS', 'EDITAR'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'ORCAMENTOS', 'VER'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'CONTRATOS', 'EDITAR'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'FINANCEIRO', 'EDITAR'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'AUDITORIA', 'VER'),
  (gen_random_uuid()::text, 'FINANCEIRO', 'USUARIOS', 'NENHUM'),
  (gen_random_uuid()::text, 'TECNICO', 'INICIO', 'VER'),
  (gen_random_uuid()::text, 'TECNICO', 'CADASTROS', 'VER'),
  (gen_random_uuid()::text, 'TECNICO', 'ORCAMENTOS', 'VER'),
  (gen_random_uuid()::text, 'TECNICO', 'CONTRATOS', 'VER'),
  (gen_random_uuid()::text, 'TECNICO', 'FINANCEIRO', 'NENHUM'),
  (gen_random_uuid()::text, 'TECNICO', 'AUDITORIA', 'NENHUM'),
  (gen_random_uuid()::text, 'TECNICO', 'USUARIOS', 'NENHUM');
