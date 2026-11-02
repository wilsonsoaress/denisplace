import Link from 'next/link';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { prisma } from '@/server/db';
import { brl, D, type Money } from '@/domain/money';
import { SITUACAO_LABEL } from '@/domain/cobranca';
import { FORMA_PAGAMENTO, CATEGORIA_CONTA_PAGAR, opcoes } from '@/lib/rotulos';
import { competencia, hoje } from '@/domain/dates';
import { aplicarLoteDaGradePagar, gerarContasPagarDaCompetenciaAction } from '@/server/acoes/contasPagar';
import { Cabecalho, Filtro, Vazio } from '@/ui/pagina';
import { Campo, Escolha, Formulario, Texto } from '@/ui/form';
import { SelecionarTudo } from '@/ui/selecionar-tudo';
import { CHIP_SITUACAO } from '@/server/relatorios/titulos';
import { lerFiltros, linhasDeContasPagar, LIMITE_LINHAS, SITUACAO_FILTRO } from './dados';
import { FormLancamento } from './formularios';

export const metadata = { title: 'Contas a pagar' };

const OPCOES_FORMA = Object.entries(FORMA_PAGAMENTO).map(([value, label]) => ({ value, label }));

function Sim() {
  return <span className="chip chip-ok">sim</span>;
}

function Nao() {
  return <span className="chip chip-bad">não</span>;
}

export default async function ContasPagarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPagina('/financeiro/contas-a-pagar');
  const editar = await podeEditar('financeiro');
  const bruto = await searchParams;
  const filtros = lerFiltros(bruto);

  const linhas = await linhasDeContasPagar(filtros);
  const contratos = await prisma.contrato.findMany({
    select: { id: true, numero: true, cliente: { select: { nome: true } } },
    orderBy: { numero: 'asc' },
  });

  const soma = (sel: (l: (typeof linhas)[number]) => boolean, campo: (l: (typeof linhas)[number]) => Money) =>
    linhas.filter(sel).reduce<Money>((acc, l) => acc.plus(campo(l)), D(0));

  const emAberto = soma((l) => !l.saldo.isZero(), (l) => l.saldo);
  const vencido = soma((l) => l.situacao === 'vencido', (l) => l.saldo);
  const pago = soma((l) => l.situacao === 'pago', (l) => l.pago);
  const semNf = linhas.filter((l) => !l.nfRecebida).length;

  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    if (typeof valor === 'string' && valor !== '') query.set(chave, valor);
  }

  return (
    <>
      <Cabecalho
        titulo="Contas a pagar"
        descricao={`Lançamento pontual ou recorrente, NF de entrada e pago + data são controles manuais. Data de hoje: ${hoje()}.`}
        acoes={
          <Link href={`/financeiro/contas-a-pagar/exportar?${query.toString()}`} className="btn" prefetch={false}>
            Exportar CSV
          </Link>
        }
      />

      <Filtro acao="/financeiro/contas-a-pagar" q={filtros.q} placeholder="Fornecedor, nº do lançamento, NF ou descrição">
        <input type="month" name="competencia" defaultValue={filtros.comp.slice(0, 7)} className="input max-w-44" />
        <select name="situacao" defaultValue={filtros.situacao} className="input max-w-52">
          <option value="">todas as situações</option>
          {Object.entries(SITUACAO_FILTRO).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="categoria" defaultValue={filtros.categoria} className="input max-w-48">
          <option value="">todas as categorias</option>
          {opcoes(CATEGORIA_CONTA_PAGAR).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="controle" defaultValue={filtros.controle} className="input max-w-48">
          <option value="">emissão: qualquer</option>
          <option value="sem_nf">sem NF de entrada</option>
        </select>
      </Filtro>

      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <p className="card !py-2">
          Em aberto: <b className="num">{brl(emAberto)}</b>
          <span className="block text-xs text-slate-500">{linhas.length} lançamento(s) na tela</span>
        </p>
        <p className="card !py-2">
          Vencido: <b className="num text-red-700">{brl(vencido)}</b>
        </p>
        <p className="card !py-2">
          Pago: <b className="num text-green-800">{brl(pago)}</b>
          <span className="block text-xs text-slate-500">nas linhas pagas desta tela</span>
        </p>
        <p className="card !py-2">
          Sem NF de entrada: <b className="num">{semNf}</b>
        </p>
      </div>

      {editar ? (
        <div className="card mb-4 space-y-4">
          <FormLancamento
            contratos={contratos.map((c) => ({ id: c.id, label: `#${c.numero} · ${c.cliente.nome}` }))}
          />
          <div className="border-t border-slate-100 pt-4">
            <Formulario
              acao={gerarContasPagarDaCompetenciaAction}
              submit={
                <>
                  <div className="max-w-40">
                    <Campo nome="competencia" rotulo="Competência" obrigatorio dica="Use qualquer dia do mês.">
                      <Texto nome="competencia" tipo="date" valor={filtros.comp || competencia(hoje())} obrigatorio />
                    </Campo>
                  </div>
                  <button type="submit" className="btn self-end">
                    Gerar contas a pagar do mês
                  </button>
                </>
              }
            >
              <p className="text-sm text-slate-600">
                Cria a próxima competência de todo lançamento <b>recorrente</b> cadastrado. Idempotente — reprocessar
                não duplica.
              </p>
            </Formulario>
          </div>
        </div>
      ) : null}

      {linhas.length === 0 ? (
        <Vazio>Nenhum lançamento com esses filtros. Cadastre acima ou ajuste o filtro.</Vazio>
      ) : (
        <Formulario
          acao={aplicarLoteDaGradePagar}
          submit={
            editar ? (
              <>
                <button type="submit" name="tipo" value="NF" className="btn">
                  Marcar NF de entrada recebida
                </button>
                <span className="self-stretch border-l border-slate-200 pl-4 text-xs text-slate-500">
                  A baixa em lote quita cada lançamento pelo que ele deve na data abaixo.
                </span>
                <Campo nome="data" rotulo="Data da baixa" obrigatorio>
                  <Texto nome="data" tipo="date" valor={hoje()} obrigatorio />
                </Campo>
                <Campo nome="forma" rotulo="Forma" obrigatorio>
                  <Escolha nome="forma" opcoes={OPCOES_FORMA} obrigatorio />
                </Campo>
                <button type="submit" name="tipo" value="PAGAMENTO" className="btn btn-primary">
                  Dar baixa em lote
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">Seu perfil só lê as contas a pagar.</span>
            )
          }
        >
          <div className="card overflow-x-auto p-0">
            <table className="data">
              <thead>
                <tr>
                  <th>{editar ? <SelecionarTudo rotulo="Selecionar todos os lançamentos da tela" /> : null}</th>
                  <th>Lançamento</th>
                  <th>Fornecedor</th>
                  <th>Categoria</th>
                  <th>Comp.</th>
                  <th className="num">Vencimento</th>
                  <th className="num">Original</th>
                  <th className="num">Multa/juros</th>
                  <th className="num">Saldo</th>
                  <th>NF entrada</th>
                  <th>Pago</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {!editar ? null : <input type="checkbox" name="ids" value={l.id} className="size-4" />}
                    </td>
                    <td className="num">
                      <Link href={`/financeiro/contas-a-pagar/${l.id}`} className="font-medium text-blue-800 hover:underline">
                        {l.numero}
                      </Link>
                      {l.recorrente ? <span className="ml-1 chip chip-free">recorrente</span> : null}
                    </td>
                    <td>
                      {l.fornecedor}
                      {l.contratoNumero ? <span className="ml-1 text-xs text-slate-400">#{l.contratoNumero}</span> : null}
                    </td>
                    <td className="text-xs">{CATEGORIA_CONTA_PAGAR[l.categoria]}</td>
                    <td className="num text-xs">{l.comp.slice(0, 7)}</td>
                    <td className="num">
                      {l.vencimento}
                      {l.dias > 0 ? <span className="ml-1 text-xs text-red-700">+{l.dias}d</span> : null}
                    </td>
                    <td className="num">{brl(l.valorOriginal)}</td>
                    <td className="num text-red-700">{l.acr.isZero() ? '—' : brl(l.acr)}</td>
                    <td className="num font-medium">{brl(l.saldo)}</td>
                    <td>{l.nfRecebida ? <Sim /> : <Nao />}</td>
                    <td className="num text-xs">
                      {l.pagoEm ? (
                        <>
                          {l.pagoEm}
                          <span className="ml-1 text-slate-400">{l.forma ? FORMA_PAGAMENTO[l.forma] : ''}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={CHIP_SITUACAO[l.situacao]}>{SITUACAO_LABEL[l.situacao]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linhas.length >= LIMITE_LINHAS ? (
            <p className="mt-2 text-xs text-amber-800">
              A tela mostra os {LIMITE_LINHAS} primeiros lançamentos do filtro. Refine por competência para ver o
              restante — o CSV segue o mesmo limite.
            </p>
          ) : null}
        </Formulario>
      )}
    </>
  );
}
