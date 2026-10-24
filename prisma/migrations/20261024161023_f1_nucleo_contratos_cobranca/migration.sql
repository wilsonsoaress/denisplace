-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'COMERCIAL', 'FINANCEIRO', 'TECNICO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "TipoCatalogo" AS ENUM ('SERVICO', 'EQUIPAMENTO');

-- CreateEnum
CREATE TYPE "UnidadeCobranca" AS ENUM ('MENSALIDADE', 'PONTO', 'HORA', 'PECA', 'DIARIA');

-- CreateEnum
CREATE TYPE "StatusEquipamento" AS ENUM ('ESTOQUE', 'INSTALADO', 'MANUTENCAO', 'BAIXADO');

-- CreateEnum
CREATE TYPE "EscopoCobranca" AS ENUM ('CONDOMINIO', 'UNIDADE');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('RASCUNHO', 'VIGENTE', 'SUSPENSO', 'DISTRATADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "PeriodicidadeReajuste" AS ENUM ('ANUAL', 'SEMESTRAL', 'NENHUM');

-- CreateEnum
CREATE TYPE "TipoAditivo" AS ENUM ('REAJUSTE', 'ACRESCIMO', 'REMOCAO', 'ALTERACAO', 'SUSPENSAO', 'RETOMADA', 'DISTRACTO');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('ABERTA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoEmissao" AS ENUM ('BOLETO', 'NF', 'SEGUNDA_VIA');

-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('ABERTO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'CONVERTIDO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "EscopoItem" AS ENUM ('PONTUAL', 'RECORRENTE');

-- CreateEnum
CREATE TYPE "TipoOS" AS ENUM ('INSTALACAO', 'MANUTENCAO', 'VISTORIA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('ABERTA', 'AGENDADA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'FINANCEIRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "usuarioId" TEXT,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPessoa" NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "is_condominium" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condominios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "sindicoNome" TEXT,
    "sindicoEmail" TEXT,
    "sindicoTelefone" TEXT,
    "administradora" TEXT,
    "clienteId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condominios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "bloco" TEXT,
    "numero" TEXT,
    "titularId" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_itens" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCatalogo" NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "list_price" DECIMAL(12,2) NOT NULL,
    "reference_cost" DECIMAL(12,2) NOT NULL,
    "unidadeCobranca" "UnidadeCobranca" NOT NULL DEFAULT 'MENSALIDADE',
    "indiceReajusteId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogo_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indices_reajuste" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "indices_reajuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indices_valores" (
    "id" TEXT NOT NULL,
    "indiceId" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "monthly_variation" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "indices_valores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipamentos" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "status" "StatusEquipamento" NOT NULL DEFAULT 'ESTOQUE',
    "condominioId" TEXT,
    "unidadeId" TEXT,
    "garantiaAte" DATE,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "condominioId" TEXT,
    "parentContractId" TEXT,
    "escopo" "EscopoCobranca" NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "status" "StatusContrato" NOT NULL DEFAULT 'RASCUNHO',
    "due_day" INTEGER NOT NULL DEFAULT 5,
    "discount_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "distratoMotivo" TEXT,
    "distratoEm" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_itens" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "catalogoItemId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "precoInicial" DECIMAL(12,2) NOT NULL,
    "precoAtual" DECIMAL(12,2) NOT NULL,
    "price_valid_from" DATE NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "indiceReajusteId" TEXT,
    "periodicidade" "PeriodicidadeReajuste" NOT NULL DEFAULT 'ANUAL',
    "proximoReajusteEm" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_aditivos" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoAditivo" NOT NULL,
    "competencia" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorAnterior" DECIMAL(12,2),
    "valorNovo" DECIMAL(12,2),
    "detalhe" TEXT,
    "usuarioId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_aditivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_unidades" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "moradorId" TEXT,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "situacao" TEXT NOT NULL DEFAULT 'ATIVA',

    CONSTRAINT "contrato_unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'ABERTA',
    "valorBruto" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "acrescimos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(12,2) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generation_reason" TEXT,

    CONSTRAINT "faturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fatura_itens" (
    "id" TEXT NOT NULL,
    "faturaId" TEXT NOT NULL,
    "contratoItemId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "precoUnitario" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "precoVigencia" DATE NOT NULL,

    CONSTRAINT "fatura_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titulos" (
    "id" TEXT NOT NULL,
    "faturaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "numero" TEXT NOT NULL,
    "debtor_name" TEXT NOT NULL,
    "condominium_name" TEXT,
    "escopo" "EscopoCobranca" NOT NULL,
    "valorOriginal" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "boleto_issued" BOOLEAN NOT NULL DEFAULT false,
    "boletoEmitidoEm" DATE,
    "nossoNumero" TEXT,
    "invoice_issued" BOOLEAN NOT NULL DEFAULT false,
    "nfNumero" TEXT,
    "nfEmissaoEm" DATE,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" DATE,
    "forma" "FormaPagamento",
    "isento" BOOLEAN NOT NULL DEFAULT false,
    "isentoMotivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" DATE NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "comprovanteUrl" TEXT,
    "observacao" TEXT,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversed_at" TIMESTAMP(3),
    "anuladoMotivo" TEXT,
    "usuarioId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emissao_lotes" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEmissao" NOT NULL,
    "competencia" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "arquivoUrl" TEXT,
    "usuarioId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emissao_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emissao_lote_titulos" (
    "loteId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emissao_lote_titulos_pkey" PRIMARY KEY ("loteId","tituloId")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "condominioId" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "validade" DATE NOT NULL,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'ABERTO',
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "aprovadoEm" DATE,
    "convertidoEm" TIMESTAMP(3),
    "contratoId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento_itens" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "catalogoItemId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "precoUnitario" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "escopo" "EscopoItem" NOT NULL,
    "inicioVigencia" DATE,
    "periodicidade" "PeriodicidadeReajuste",

    CONSTRAINT "orcamento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoOS" NOT NULL,
    "status" "StatusOS" NOT NULL DEFAULT 'ABERTA',
    "orcamentoId" TEXT,
    "contratoId" TEXT,
    "condominioId" TEXT,
    "unidadeId" TEXT,
    "descricao" TEXT NOT NULL,
    "agendadaPara" DATE,
    "concluidaEm" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContratoItemToEquipamento" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContratoItemToEquipamento_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidadeId_idx" ON "audit_log"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "condominios_cnpj_key" ON "condominios"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "condominios_nome_cidade_key" ON "condominios"("nome", "cidade");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_condominioId_codigo_key" ON "unidades"("condominioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_itens_nome_key" ON "catalogo_itens"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "indices_reajuste_sigla_key" ON "indices_reajuste"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "indices_valores_indiceId_competencia_key" ON "indices_valores"("indiceId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "equipamentos_serial_key" ON "equipamentos"("serial");

-- CreateIndex
CREATE INDEX "equipamentos_modelo_idx" ON "equipamentos"("modelo");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE INDEX "contratos_status_idx" ON "contratos"("status");

-- CreateIndex
CREATE INDEX "contratos_condominioId_idx" ON "contratos"("condominioId");

-- CreateIndex
CREATE INDEX "contratos_parentContractId_idx" ON "contratos"("parentContractId");

-- CreateIndex
CREATE INDEX "contrato_itens_contratoId_idx" ON "contrato_itens"("contratoId");

-- CreateIndex
CREATE INDEX "contrato_itens_proximoReajusteEm_idx" ON "contrato_itens"("proximoReajusteEm");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_aditivos_contratoId_numero_key" ON "contrato_aditivos"("contratoId", "numero");

-- CreateIndex
CREATE INDEX "contrato_unidades_unidadeId_idx" ON "contrato_unidades"("unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_unidades_contratoId_unidadeId_desde_key" ON "contrato_unidades"("contratoId", "unidadeId", "desde");

-- CreateIndex
CREATE INDEX "faturas_competencia_idx" ON "faturas"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "faturas_contratoId_competencia_key" ON "faturas"("contratoId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "fatura_itens_faturaId_contratoItemId_key" ON "fatura_itens"("faturaId", "contratoItemId");

-- CreateIndex
CREATE UNIQUE INDEX "titulos_numero_key" ON "titulos"("numero");

-- CreateIndex
CREATE INDEX "titulos_competencia_idx" ON "titulos"("competencia");

-- CreateIndex
CREATE INDEX "titulos_vencimento_idx" ON "titulos"("vencimento");

-- CreateIndex
CREATE INDEX "titulos_pago_vencimento_idx" ON "titulos"("pago", "vencimento");

-- CreateIndex
CREATE INDEX "titulos_contratoId_competencia_idx" ON "titulos"("contratoId", "competencia");

-- CreateIndex
CREATE INDEX "pagamentos_tituloId_idx" ON "pagamentos"("tituloId");

-- CreateIndex
CREATE INDEX "pagamentos_data_idx" ON "pagamentos"("data");

-- CreateIndex
CREATE INDEX "emissao_lotes_competencia_tipo_idx" ON "emissao_lotes"("competencia", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_numero_key" ON "orcamentos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_contratoId_key" ON "orcamentos"("contratoId");

-- CreateIndex
CREATE INDEX "orcamentos_status_idx" ON "orcamentos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "ordens_servico"("numero");

-- CreateIndex
CREATE INDEX "ordens_servico_status_idx" ON "ordens_servico"("status");

-- CreateIndex
CREATE INDEX "_ContratoItemToEquipamento_B_index" ON "_ContratoItemToEquipamento"("B");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condominios" ADD CONSTRAINT "condominios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_titularId_fkey" FOREIGN KEY ("titularId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogo_itens" ADD CONSTRAINT "catalogo_itens_indiceReajusteId_fkey" FOREIGN KEY ("indiceReajusteId") REFERENCES "indices_reajuste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indices_valores" ADD CONSTRAINT "indices_valores_indiceId_fkey" FOREIGN KEY ("indiceId") REFERENCES "indices_reajuste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_parentContractId_fkey" FOREIGN KEY ("parentContractId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_itens" ADD CONSTRAINT "contrato_itens_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_itens" ADD CONSTRAINT "contrato_itens_catalogoItemId_fkey" FOREIGN KEY ("catalogoItemId") REFERENCES "catalogo_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_itens" ADD CONSTRAINT "contrato_itens_indiceReajusteId_fkey" FOREIGN KEY ("indiceReajusteId") REFERENCES "indices_reajuste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_unidades" ADD CONSTRAINT "contrato_unidades_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_unidades" ADD CONSTRAINT "contrato_unidades_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_unidades" ADD CONSTRAINT "contrato_unidades_moradorId_fkey" FOREIGN KEY ("moradorId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "faturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatura_itens" ADD CONSTRAINT "fatura_itens_contratoItemId_fkey" FOREIGN KEY ("contratoItemId") REFERENCES "contrato_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "faturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "titulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissao_lotes" ADD CONSTRAINT "emissao_lotes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissao_lote_titulos" ADD CONSTRAINT "emissao_lote_titulos_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "emissao_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissao_lote_titulos" ADD CONSTRAINT "emissao_lote_titulos_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "titulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_catalogoItemId_fkey" FOREIGN KEY ("catalogoItemId") REFERENCES "catalogo_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContratoItemToEquipamento" ADD CONSTRAINT "_ContratoItemToEquipamento_A_fkey" FOREIGN KEY ("A") REFERENCES "contrato_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContratoItemToEquipamento" ADD CONSTRAINT "_ContratoItemToEquipamento_B_fkey" FOREIGN KEY ("B") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
