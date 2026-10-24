import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

const MODULOS_F1 = [
  { href: '/cadastros', nome: 'Cadastros', desc: 'Clientes, condomínios e unidades, catálogo, equipamentos, índices' },
  { href: '/contratos', nome: 'Contratos', desc: 'Vigência, itens, reajuste versionado, aderências e aditivos' },
  { href: '/orcamentos', nome: 'Orçamentos', desc: 'Aprovação converte em OS (pontual) e contrato (recorrente)' },
  { href: '/financeiro/contas-a-receber', nome: 'Contas a receber', desc: 'NF, boleto, pago + data, multa/juros e ações em lote' },
  { href: '/financeiro/matriz', nome: 'Matriz de inadimplência', desc: 'Devedor × competência, projetada dos títulos' },
  { href: '/financeiro/dashboard', nome: 'Dashboard financeiro', desc: 'KPIs, adimplência por competência e controle de emissão' },
];

export default async function HomePage() {
  let contagem: Record<string, number | string> | null = null;
  let erro: string | null = null;

  try {
    const [clientes, condominios, contratos, titulos, emAberto] = await Promise.all([
      prisma.cliente.count(),
      prisma.condominio.count(),
      prisma.contrato.count(),
      prisma.titulo.count(),
      prisma.titulo.count({ where: { pago: false, isento: false } }),
    ]);
    contagem = { clientes, condominios, contratos, titulos, emAberto };
  } catch (e) {
    erro = e instanceof Error ? e.message.split('\n')[0] ?? 'falha desconhecida' : 'falha desconhecida';
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <h1 className="text-lg font-semibold">Fase 1 — núcleo comercial e cobrança</h1>
        <p className="mt-1 text-sm text-slate-600">
          Objetivo da F1: rodar o mês inteiro no sistema e desligar a planilha. Sem integração bancária —
          boleto, NF e pagamento são fatos registrados por quem atende.
        </p>
        <div className="mt-3 text-sm">
          {contagem ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1 num">
              <li>Clientes: <b>{contagem.clientes}</b></li>
              <li>Condomínios: <b>{contagem.condominios}</b></li>
              <li>Contratos: <b>{contagem.contratos}</b></li>
              <li>Títulos: <b>{contagem.titulos}</b></li>
              <li>Em aberto: <b>{contagem.emAberto}</b></li>
            </ul>
          ) : (
            <p className="text-amber-800">
              Banco indisponível ({erro}). Suba com <code className="rounded bg-slate-100 px-1">docker compose up -d db redis</code>{' '}
              e rode <code className="rounded bg-slate-100 px-1">npm run db:seed</code>.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS_F1.map((m) => (
          <a key={m.href} href={m.href} className="card hover:border-brand hover:bg-blue-50/40">
            <h2 className="text-sm font-semibold">{m.nome}</h2>
            <p className="mt-1 text-xs text-slate-600">{m.desc}</p>
          </a>
        ))}
      </section>
    </div>
  );
}
