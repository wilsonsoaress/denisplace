import Link from 'next/link';
import { prisma } from '@/server/db';
import { brl, D, type Money } from '@/domain/money';
import { SITUACAO_LABEL } from '@/domain/cobranca';
import { FORMA_PAGAMENTO } from '@/lib/rotulos';
import { hoje } from '@/domain/dates';
import { marcarEmitido } from '@/server/acoes/contas';
import { Cabecalho, Filtro, Vazio } from '@/ui/pagina';
import { Formulario } from '@/ui/form';
import { CHIP_SITUACAO, type Linha } from '@/server/relatorios/titulos';
import { lerFiltros, linhasDosTitulos, LIMITE_LINHAS, SITUACAO_FILTRO } from './dados';

export const metadata = { title: 'Contas a receber' };

const TIPOS_LOTE = [
  { value: 'BOLETO', label: 'Emitir boleto' },
  { value: 'NF', label: 'Emitir NF' },
  { value: 'SEGUNDA_VIA', label: 'Dar 2ª via' },
] as const;

function Sim() {
  return <span className="chip chip-ok">sim</span>;
}

function Nao() {
  return <span className="chip chip-bad">não</span>;
}

export default async function ContasReceberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bruto = await searchParams;
  const filtros = lerFiltros(bruto);

  const linhas = await linhasDosTitulos(filtros);
  const condominios = await prisma.condominio.findMany({
    select: { id: true, nome: true, cidade: true },
    orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
  });

  const soma = (sel: (l: Linha) => boolean, campo: (l: Linha) => Money) =>
    linhas.filter(sel).reduce<Money>((acc, l) => acc.plus(campo(l)), D(0));

  const emAberto = soma((l) => l.saldo !== null && !l.saldo.isZero(), (l) => l.saldo ?? D(0));
  const vencidas = soma(
    (l) => l.situacao === 'vencido' && l.saldo !== null && !l.saldo.isZero(),
    (l) => l.saldo ?? D(0),
  );
  const acrVencidas = soma((l) => l.situacao === 'vencido', (l) => l.acr);
  const recebido = soma((l) => l.situacao === 'pago', (l) => l.recebido);
  // Emissão e pagamento são controles independentes: mês pago ainda pode precisar de NF.
  const semBoleto = linhas.filter((l) => !l.boletoGerado && l.situacao !== 'isento').length;
  const semNf = linhas.filter((l) => !l.nfEmitida && l.situacao !== 'isento').length;

  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    if (typeof valor === 'string' && valor !== '') query.set(chave, valor);
  }

  return (
    <>
      <Cabecalho
        titulo="Contas a receber"
        descricao={`Boleto, nota fiscal e pagamento são controles manuais: você marca o que emitiu e o que recebeu, e o sistema calcula multa, juros e saldo. Data de hoje: ${hoje()}.`}
        acoes={
          <Link
            href={`/financeiro/contas-a-receber/exportar?${query.toString()}`}
            className="btn"
            prefetch={false}
          >
            Exportar CSV
          </Link>
        }
      />

      <Filtro
        acao="/financeiro/contas-a-receber"
        q={filtros.q}
        placeholder="Devedor, condomínio, nº do título, NF ou contrato"
      >
        <input type="month" name="competencia" defaultValue={filtros.comp.slice(0, 7)} className="input max-w-44" />
        <select name="situacao" defaultValue={filtros.situacao} className="input max-w-52">
          <option value="">todas as situações</option>
          {Object.entries(SITUACAO_FILTRO).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="controle" defaultValue={filtros.controle} className="input max-w-48">
          <option value="">emissão: qualquer</option>
          <option value="sem_boleto">sem boleto emitido</option>
          <option value="sem_nf">sem NF emitida</option>
        </select>
        <select name="condominio" defaultValue={filtros.condominioId} className="input max-w-52">
          <option value="">todos os condomínios</option>
          {condominios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Filtro>

      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <p className="card !py-2">
          Em aberto: <b className="num">{brl(emAberto)}</b>
          <span className="block text-xs text-slate-500">{linhas.length} título(s) na tela</span>
        </p>
        <p className="card !py-2">
          Vencido: <b className="num text-red-700">{brl(vencidas)}</b>
          <span className="block text-xs text-slate-500">multa e juros somam {brl(acrVencidas)}</span>
        </p>
        <p className="card !py-2">
          Recebido: <b className="num text-green-800">{brl(recebido)}</b>
          <span className="block text-xs text-slate-500">nas linhas pagas desta tela</span>
        </p>
        <p className="card !py-2">
          A emitir: <b className="num">{semBoleto} boleto(s)</b>
          <span className="block text-xs text-slate-500">{semNf} sem NF</span>
        </p>
      </div>

      {linhas.length === 0 ? (
        <Vazio>
          Nenhum título com esses filtros. A cobrança mensal é gerada na tela do contrato (ou pelo job) — veja
          <Link href="/contratos" className="ml-1 text-blue-800 underline">
            Contratos
          </Link>
          .
        </Vazio>
      ) : (
        <Formulario
          acao={marcarEmitido}
          submit={
            <>
              <span className="text-xs text-slate-500">
                Selecione as linhas e registre a emissão. Cada registro vira um lote auditável.
              </span>
              {TIPOS_LOTE.map((t) => (
                <button key={t.value} type="submit" name="tipo" value={t.value} className="btn">
                  {t.label}
                </button>
              ))}
            </>
          }
        >
          <div className="card overflow-x-auto p-0">
            <table className="grid">
              <thead>
                <tr>
                  <th></th>
                  <th>Título</th>
                  <th>Devedor</th>
                  <th>Condomínio</th>
                  <th>Comp.</th>
                  <th className="num">Vencimento</th>
                  <th className="num">Original</th>
                  <th className="num">Multa/juros</th>
                  <th className="num">Saldo</th>
                  <th>Boleto</th>
                  <th>NF</th>
                  <th>Pago</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {/* Título pago também precisa de registro de boleto/NF: emissão e pagamento são controles independentes. */}
                      {l.situacao === 'isento' ? null : (
                        <input type="checkbox" name="ids" value={l.id} className="size-4" />
                      )}
                    </td>
                    <td className="num">
                      <Link href={`/financeiro/contas-a-receber/${l.id}`} className="font-medium text-blue-800 hover:underline">
                        {l.numero}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/contratos/${l.contratoId}`} className="hover:underline">
                        {l.devedor}
                      </Link>
                      <span className="ml-1 text-xs text-slate-400">#{l.contratoNumero}</span>
                    </td>
                    <td className="text-xs">{l.condominio ?? '—'}</td>
                    <td className="num text-xs">{l.comp.slice(0, 7)}</td>
                    <td className="num">
                      {l.vencimento}
                      {l.dias > 0 ? <span className="ml-1 text-xs text-red-700">+{l.dias}d</span> : null}
                    </td>
                    <td className="num">{brl(l.valorOriginal)}</td>
                    <td className="num text-red-700">{l.acr.isZero() ? '—' : brl(l.acr)}</td>
                    <td className="num font-medium">
                      {l.saldo === null ? <span className="text-slate-400">isento</span> : brl(l.saldo)}
                    </td>
                    <td>{l.boletoGerado ? <Sim /> : <Nao />}</td>
                    <td>{l.nfEmitida ? <Sim /> : <Nao />}</td>
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
              A tela mostra os {LIMITE_LINHAS} primeiros títulos do filtro. Refine por competência para ver o restante
              — o CSV segue o mesmo limite.
            </p>
          ) : null}
        </Formulario>
      )}
    </>
  );
}
