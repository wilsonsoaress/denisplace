import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { exigirPagina } from '@/auth/guard';
import { hoje } from '@/domain/dates';
import { PAPEIS_LABEL } from '@/auth/perfis';
import { Cabecalho, Filtro, param, Vazio } from '@/ui/pagina';

export const metadata = { title: 'Trilha de auditoria' };

const DOCUMENTO: Record<string, { rotulo: string; href?: (id: string) => string }> = {
  titulo: { rotulo: 'título', href: (id) => `/financeiro/contas-a-receber/${id}` },
  contrato: { rotulo: 'contrato', href: (id) => `/contratos/${id}` },
  contrato_item: { rotulo: 'item de contrato' },
  orcamento: { rotulo: 'orçamento', href: (id) => `/orcamentos/${id}` },
  cliente: { rotulo: 'cliente', href: (id) => `/cadastros/clientes/${id}` },
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/auditoria');
  const q = await param(searchParams, 'q');
  const desde = await param(searchParams, 'desde');
  const ate = await param(searchParams, 'ate');

  const onde: Prisma.AuditLogWhereInput = {
    ...(q
      ? {
          OR: [
            { acao: { contains: q, mode: 'insensitive' } },
            { entidadeId: q },
            { motivo: { contains: q, mode: 'insensitive' } },
            { usuario: { nome: { contains: q, mode: 'insensitive' } } },
            { usuario: { email: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(desde || ate
      ? {
          criadoEm: {
            ...(desde ? { gte: new Date(`${desde}T00:00:00.000Z`) } : {}),
            ...(ate ? { lte: new Date(`${ate}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const eventos = await prisma.auditLog.findMany({
    where: onde,
    include: { usuario: { select: { nome: true, email: true, papel: true } } },
    orderBy: { criadoEm: 'desc' },
    take: 400,
  });

  return (
    <>
      <Cabecalho
        titulo="Trilha de auditoria"
        descricao="Todo movimento que mexe em dinheiro ou vigência: quem fez, quando, em quê e o que mudou. A gravação é best-effort — um evento perdido não desfaz o pagamento, mas fica no log do servidor."
      />

      <Filtro acao="/auditoria" q={q} placeholder="ação, documento, pessoa ou resumo">
        <input name="desde" type="date" defaultValue={desde} className="input max-w-52" aria-label="desde" />
        <input name="ate" type="date" defaultValue={ate || hoje()} className="input max-w-52" aria-label="até" />
      </Filtro>

      <p className="mb-3 text-xs text-slate-500">
        {eventos.length === 400 ? 'mostrando os 400 eventos mais recentes; refine com os filtros. ' : ''}
        O link do documento abre a tela onde o fato pode ser conferido.
      </p>

      {eventos.length === 0 ? (
        <Vazio>Nenhum evento com esses filtros.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="grid">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Documento</th>
                <th>Resumo</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const doc = DOCUMENTO[e.entidade];
                return (
                  <tr key={String(e.id)}>
                    <td className="num whitespace-nowrap text-xs">
                      {e.criadoEm.toLocaleDateString('pt-BR')}
                      <span className="block">
                        {e.criadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="text-xs">
                      {e.usuario?.nome ?? '—'}
                      <span className="block text-slate-500">
                        {e.usuario?.email ?? ''}
                        {e.usuario ? ` · ${(PAPEIS_LABEL[e.usuario.papel] ?? e.usuario.papel).toLowerCase()}` : ''}
                      </span>
                    </td>
                    <td className="num text-xs">{e.acao}</td>
                    <td className="text-xs">
                      {doc?.href ? (
                        <Link href={doc.href(e.entidadeId)} className="text-blue-800 hover:underline">
                          {doc.rotulo}
                        </Link>
                      ) : (
                        <span className="text-slate-600">{doc?.rotulo ?? e.entidade}</span>
                      )}
                      <span className="block text-slate-400">{e.entidadeId.slice(0, 12)}</span>
                    </td>
                    <td className="max-w-2xl text-xs">{e.motivo ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
