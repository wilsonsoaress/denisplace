import { criarOrcamento } from '@/server/acoes/orcamentos';
import { exigirPagina, podeEditar } from '@/auth/guard';
import { Cabecalho } from '@/ui/pagina';
import { listasParaContrato } from '@/app/contratos/dados';
import { FormOrcamento } from '../formularios';

export const metadata = { title: 'Novo orçamento' };

export default async function NovoOrcamentoPage() {
  await exigirPagina('/orcamentos/novo');
  const editar = await podeEditar('orcamentos');
  const listas = await listasParaContrato();

  return (
    <>
      <Cabecalho
        titulo="Novo orçamento"
        descricao="Depois de criado, inclua os itens marcando cada um como pontual ou recorrente: é isso que decide o que vira OS e o que vira contrato."
        voltar={{ href: '/orcamentos', label: 'Voltar para orçamentos' }}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card">
          {editar ? (
            <FormOrcamento acao={criarOrcamento} listas={listas} />
          ) : (
            <p className="text-sm text-slate-600">
              Seu perfil só lê orçamentos: quem monta e converte é o comercial.
            </p>
          )}
        </section>
        <section className="card text-sm text-slate-600">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Fluxo</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Monte os itens com preço praticado (em branco usa a tabela do catálogo).</li>
            <li>Marque como enviado e, quando o cliente aceitar, aprove.</li>
            <li>Converta: recorrente vira contrato em rascunho e pontual vira ordem de serviço.</li>
          </ol>
          <p className="mt-3">
            A conversão não ativa o contrato nem gera cobrança: quem ativa é o financeiro, depois de conferir adesões e
            condições.
          </p>
        </section>
      </div>
    </>
  );
}
