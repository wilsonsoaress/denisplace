import { salvarIndice } from '@/server/acoes/indices';
import { exigirPagina } from '@/auth/guard';
import { Cabecalho } from '@/ui/pagina';
import { Campo, Formulario, Texto, type EstadoForm } from '@/ui/form';

export const metadata = { title: 'Novo índice' };

function FormIndice({
  acao,
  registro,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: { sigla: string; nome: string };
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar índice' : 'Criar índice'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="sigla" rotulo="Sigla" obrigatorio dica="IPCA, IGP-M, INPC…">
          <Texto nome="sigla" valor={registro?.sigla} obrigatorio />
        </Campo>
        <Campo nome="nome" rotulo="Nome" obrigatorio>
          <Texto nome="nome" valor={registro?.nome} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}

export default async function NovoIndicePage() {
  await exigirPagina('/cadastros/indices/novo');
  return (
    <>
      <Cabecalho
        titulo="Novo índice de reajuste"
        descricao="Depois de criar, informe a variação mensal de cada competência na tela do índice."
        voltar={{ href: '/cadastros/indices', label: 'Voltar para índices' }}
      />
      <div className="card max-w-2xl">
        <FormIndice acao={salvarIndice.bind(null, null)} />
      </div>
    </>
  );
}
