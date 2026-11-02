import { notFound } from 'next/navigation';
import { exigirPagina } from '@/auth/guard';
import { prisma } from '@/server/db';
import { obterDadosEmpresa } from '@/server/acoes/empresa';
import { gerarPdfOrcamento, type OrcamentoParaPdf } from '@/server/pdf/orcamento';

/** Baixa o orçamento em PDF: mesmos dados da tela, com o cabeçalho da empresa. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  await exigirPagina('/orcamentos/[id]');
  const { id } = await params;

  const orcamento = await prisma.orcamento.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true, documento: true, email: true, telefone: true } },
      condominio: { select: { nome: true } },
      itens: { include: { catalogoItem: { select: { tipo: true } } }, orderBy: { id: 'asc' } },
    },
  });
  if (!orcamento) notFound();

  const empresa = await obterDadosEmpresa();
  const buffer = await gerarPdfOrcamento({ orcamento: orcamento as OrcamentoParaPdf, empresa });

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="orcamento-${orcamento.numero}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
