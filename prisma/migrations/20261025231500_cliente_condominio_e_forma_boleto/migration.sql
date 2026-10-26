-- Cliente do tipo morador referenciado ao condominio a que pertence,
-- e boleto como forma de pagamento registrada no caixa.

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "condominioId" TEXT;

-- CreateIndex
CREATE INDEX "clientes_condominioId_idx" ON "clientes"("condominioId");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "FormaPagamento" ADD VALUE 'BOLETO';
