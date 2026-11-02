-- CreateEnum
CREATE TYPE "CategoriaContaPagar" AS ENUM ('EQUIPAMENTO', 'INSTALACAO', 'MANUTENCAO', 'COMISSAO', 'FRETE', 'TAXA', 'OUTRO');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "last_access_at" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "contas_pagar" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "categoria" "CategoriaContaPagar" NOT NULL,
    "descricao" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "valorOriginal" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" DATE,
    "forma" "FormaPagamento",
    "invoice_received" BOOLEAN NOT NULL DEFAULT false,
    "nfNumero" TEXT,
    "nfRecebidaEm" DATE,
    "late_fee_applies" BOOLEAN NOT NULL DEFAULT false,
    "contratoId" TEXT,
    "ordemServicoId" TEXT,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "origemRecorrenteId" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_conta_pagar" (
    "id" TEXT NOT NULL,
    "contaPagarId" TEXT NOT NULL,
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

    CONSTRAINT "pagamentos_conta_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_pagar_numero_key" ON "contas_pagar"("numero");

-- CreateIndex
CREATE INDEX "contas_pagar_competencia_idx" ON "contas_pagar"("competencia");

-- CreateIndex
CREATE INDEX "contas_pagar_vencimento_idx" ON "contas_pagar"("vencimento");

-- CreateIndex
CREATE INDEX "contas_pagar_pago_vencimento_idx" ON "contas_pagar"("pago", "vencimento");

-- CreateIndex
CREATE INDEX "contas_pagar_contratoId_idx" ON "contas_pagar"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "contas_pagar_origemRecorrenteId_competencia_key" ON "contas_pagar"("origemRecorrenteId", "competencia");

-- CreateIndex
CREATE INDEX "pagamentos_conta_pagar_contaPagarId_idx" ON "pagamentos_conta_pagar"("contaPagarId");

-- CreateIndex
CREATE INDEX "pagamentos_conta_pagar_data_idx" ON "pagamentos_conta_pagar"("data");

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_origemRecorrenteId_fkey" FOREIGN KEY ("origemRecorrenteId") REFERENCES "contas_pagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_conta_pagar" ADD CONSTRAINT "pagamentos_conta_pagar_contaPagarId_fkey" FOREIGN KEY ("contaPagarId") REFERENCES "contas_pagar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_conta_pagar" ADD CONSTRAINT "pagamentos_conta_pagar_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
