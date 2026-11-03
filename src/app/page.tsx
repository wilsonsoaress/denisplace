import { prisma } from '@/server/db';
import { MODULOS } from '@/lib/modulos';
import { exigirPagina } from '@/auth/guard';
import { PAPEIS_LABEL, pode } from '@/auth/perfis';
import { buscarMatrizCompleta } from '@/server/permissoes';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const usuario = await exigirPagina('/');
  let contagem: { clientes: number; condominios: number; contratos: number; titulos: number; emAberto: number } | null =
    null;
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

  const matriz = await buscarMatrizCompleta();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Fase 1 — núcleo comercial e cobrança</h1>
        <p className="mt-1 text-sm text-slate-600">
          Objetivo da F1: rodar o mês inteiro no sistema e desligar a planilha. Sem integração bancária —
          boleto, NF e pagamento são fatos registrados por quem atende.
        </p>
      </div>

      {contagem ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <CartaoNumero rotulo="Clientes" valor={contagem.clientes} />
          <CartaoNumero rotulo="Condomínios" valor={contagem.condominios} />
          <CartaoNumero rotulo="Contratos" valor={contagem.contratos} />
          <CartaoNumero rotulo="Títulos" valor={contagem.titulos} />
          <CartaoNumero rotulo="Em aberto" valor={contagem.emAberto} destaque={Number(contagem.emAberto) > 0} />
        </section>
      ) : (
        <p className="card text-sm text-amber-800">
          Banco indisponível ({erro}). Suba com <code className="rounded bg-slate-100 px-1">docker compose up -d db redis</code>{' '}
          e rode <code className="rounded bg-slate-100 px-1">npm run db:seed</code>.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.filter((m) => pode(usuario.permissoes, m.modulo)).map((m) => (
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
          {pode(usuario.permissoes, 'usuarios', 'editar') ? (
            <>
              Editável em{' '}
              <a href="/usuarios/perfis" className="text-blue-800 hover:underline">
                Usuários → Gerenciar perfis
              </a>
              . Esconder o botão é cortesia, a recusa no servidor é a segurança.
            </>
          ) : (
            'Só o administrador edita esta matriz; a recusa no servidor é a segurança, esconder o botão é cortesia.'
          )}
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
                      {pode(matriz[p], m.modulo, 'editar')
                        ? 'altera'
                        : pode(matriz[p], m.modulo)
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

/** Cartão numérico simples: rótulo pequeno em cima, número grande embaixo. */
function CartaoNumero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number | string;
  /** "Em aberto" > 0 chama mais atenção do que uma contagem neutra. */
  destaque?: boolean;
}) {
  return (
    <div className="card">
      <p className="field-label mb-0">{rotulo}</p>
      <p className={`num mt-1 text-2xl font-semibold ${destaque ? 'text-amber-700' : 'text-slate-900'}`}>{valor}</p>
    </div>
  );
}
