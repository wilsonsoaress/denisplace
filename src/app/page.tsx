import { prisma } from '@/server/db';
import { MODULOS } from '@/lib/modulos';
import { exigirPagina } from '@/auth/guard';
import { PAPEIS_LABEL, pode } from '@/auth/perfis';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const usuario = await exigirPagina('/');
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
        {MODULOS.filter((m) => pode(usuario.papel, m.modulo)).map((m) => (
          <div key={m.href} className={`card ${m.pronto ? 'hover:border-brand hover:bg-blue-50/40' : 'opacity-70'}`}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {m.pronto ? (
                <a href={m.href} className="hover:underline">
                  {m.nome}
                </a>
              ) : (
                m.nome
              )}
              {!m.pronto ? <span className="chip chip-warn">em construção</span> : null}
            </h2>
            <p className="mt-1 text-xs text-slate-600">{m.desc}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">O que cada perfil altera</h2>
        <p className="mt-1 text-xs text-slate-600">
          A regra mora em <code className="rounded bg-slate-100 px-1">src/auth/perfis.ts</code> e vale para página e
          gravação: esconder o botão é cortesia, a recusa no servidor é a segurança.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="data text-sm">
            <thead>
              <tr>
                <th>Módulo</th>
                {(Object.keys(PAPEIS_LABEL) as (keyof typeof PAPEIS_LABEL)[]).map((p) => (
                  <th key={p}>{PAPEIS_LABEL[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULOS.map((m) => (
                <tr key={m.href}>
                  <td>{m.nome}</td>
                  {(Object.keys(PAPEIS_LABEL) as (keyof typeof PAPEIS_LABEL)[]).map((p) => (
                    <td key={p} className="text-xs text-slate-600">
                      {pode(p, m.modulo, 'editar')
                        ? 'altera'
                        : pode(p, m.modulo)
                          ? 'somente leitura'
                          : 'sem acesso'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
