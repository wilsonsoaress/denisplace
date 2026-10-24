import { criarContrato } from '@/server/acoes/contratos';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { hoje } from '@/domain/dates';
import { Cabecalho } from '@/ui/pagina';
import { FormContrato } from '../form';
import { listasParaContrato } from '../dados';

export const metadata = { title: 'Novo contrato' };

export default async function NovoContratoPage() {
  await exigirPagina('/contratos/novo');
  const editar = await podeEditar('contratos');
  const listas = await listasParaContrato();

  return (
    <>
      <Cabecalho
        titulo="Novo contrato"
        descricao="O contrato nasce em rascunho. Ele só passa a cobrar depois de receber um item e do status virar vigente."
        voltar={{ href: '/contratos', label: 'Voltar para contratos' }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card">
          {editar ? (
            <FormContrato acao={criarContrato} listas={listas} inicioPadrao={hoje()} />
          ) : (
            <p className="text-sm text-slate-600">Seu perfil só lê contratos: quem monta o contrato é o financeiro.</p>
          )}
        </section>
        <section className="card text-sm text-slate-600">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Depois de criar</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Adicione os itens do catálogo com quantidade e preço praticado.</li>
            <li>Se a cobrança for por unidade, faça a adesão das unidades.</li>
            <li>Ative o contrato: a geração mensal só percorre contratos vigentes.</li>
          </ol>
          <p className="mt-3">
            O dia de vencimento vale para todas as competências; em fevereiro um vencimento dia 31 cai no último dia
            do mês.
          </p>
        </section>
      </div>
    </>
  );
}
