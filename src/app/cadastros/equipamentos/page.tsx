import Link from 'next/link';
import { exigirPagina } from '@/auth/guard';
import type { Prisma, StatusEquipamento } from '@prisma/client';
import { prisma } from '@/server/db';
import { STATUS_EQUIPAMENTO } from '@/lib/rotulos';
import { toISO } from '@/domain/dates';
import { Cabecalho, Filtro, Vazio } from '@/ui/pagina';

export const metadata = { title: 'Equipamentos' };

const CHIP: Record<StatusEquipamento, string> = {
  ESTOQUE: 'chip-free',
  INSTALADO: 'chip-ok',
  MANUTENCAO: 'chip-warn',
  BAIXADO: 'chip-bad',
};

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/cadastros/equipamentos');
  const bruto = await searchParams;
  const q = typeof bruto.q === 'string' ? bruto.q : '';
  const status = typeof bruto.status === 'string' ? bruto.status : '';

  const where: Prisma.EquipamentoWhereInput = {
    ...(status === 'ESTOQUE' ||
    status === 'INSTALADO' ||
    status === 'MANUTENCAO' ||
    status === 'BAIXADO'
      ? { status }
      : {}),
    ...(q
      ? {
          OR: [
            { modelo: { contains: q, mode: 'insensitive' } },
            { numeroSerie: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const equipamentos = await prisma.equipamento.findMany({
    where,
    include: {
      condominio: { select: { nome: true } },
      unidade: { select: { codigo: true } },
      _count: { select: { contratoItens: true } },
    },
    orderBy: { numeroSerie: 'asc' },
    take: 300,
  });

  return (
    <>
      <Cabecalho
        titulo="Equipamentos"
        descricao="Cada bem é registrado pelo número de série. É isso que permite cobrar por equipamento, saber onde está instalado e controlar a garantia."
        voltar={{ href: '/cadastros', label: 'Voltar para cadastros' }}
        acoes={
          <Link href="/cadastros/equipamentos/novo" className="btn btn-primary">
            Novo equipamento
          </Link>
        }
      />
      <Filtro acao="/cadastros/equipamentos" q={q} placeholder="Modelo ou número de série">
        <select name="status" defaultValue={status} className="input max-w-48">
          <option value="">Todas as situações</option>
          {Object.entries(STATUS_EQUIPAMENTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </Filtro>

      {equipamentos.length === 0 ? (
        <Vazio>
          Nenhum equipamento encontrado{q ? ` para “${q}”` : ''}.
        </Vazio>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="grid">
            <thead>
              <tr>
                <th>Série</th>
                <th>Modelo</th>
                <th>Onde está</th>
                <th className="num">Garantia até</th>
                <th>Situação</th>
                <th className="num">Contratos</th>
              </tr>
            </thead>
            <tbody>
              {equipamentos.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/cadastros/equipamentos/${e.id}`} className="num font-medium text-blue-800 hover:underline">
                      {e.numeroSerie}
                    </Link>
                  </td>
                  <td>{e.modelo}</td>
                  <td className="text-xs text-slate-600">
                    {[e.condominio?.nome, e.unidade?.codigo].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="num text-xs">{toISO(e.garantiaAte) ?? '—'}</td>
                  <td>
                    <span className={`chip ${CHIP[e.status]}`}>{STATUS_EQUIPAMENTO[e.status]}</span>
                  </td>
                  <td className="num">{e._count.contratoItens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
