import { exigirPagina, soAdmin } from '@/auth/guard';
import { Cabecalho } from '@/ui/pagina';
import { Campo, Formulario, Texto, type EstadoForm } from '@/ui/form';
import { SecaoEndereco } from '@/ui/endereco';
import { obterDadosEmpresa, salvarDadosEmpresa } from '@/server/acoes/empresa';

export const metadata = { title: 'Dados da empresa' };

function FormEmpresa({
  acao,
  registro,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro: Awaited<ReturnType<typeof obterDadosEmpresa>>;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Salvar dados da empresa">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" rotulo="Razão social" obrigatorio>
          <Texto nome="nome" valor={registro?.nome} obrigatorio placeholder="Denis Place Ltda" />
        </Campo>
        <Campo nome="nomeFantasia" rotulo="Nome fantasia" dica="Se vazio, o PDF usa a razão social.">
          <Texto nome="nomeFantasia" valor={registro?.nomeFantasia ?? undefined} placeholder="Denis Place" />
        </Campo>
        <Campo nome="cnpj" rotulo="CNPJ">
          <Texto nome="cnpj" valor={registro?.cnpj ?? undefined} placeholder="00.000.000/0000-00" />
        </Campo>
        <Campo nome="email" rotulo="E-mail">
          <Texto nome="email" tipo="email" valor={registro?.email ?? undefined} placeholder="contato@denisplace.com.br" />
        </Campo>
        <Campo nome="telefone" rotulo="Telefone">
          <Texto nome="telefone" valor={registro?.telefone ?? undefined} />
        </Campo>
        <Campo nome="site" rotulo="Site">
          <Texto nome="site" valor={registro?.site ?? undefined} placeholder="https://denisplace.com.br" />
        </Campo>
      </div>

      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Endereço</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SecaoEndereco
          cep={registro?.cep ?? undefined}
          endereco={registro?.endereco ?? undefined}
          cidade={registro?.cidade ?? undefined}
          uf={registro?.uf ?? undefined}
        />
      </div>

      <Campo
        nome="logoUrl"
        rotulo="Logo (URL pública)"
        dica="Link de uma imagem já hospedada (PNG/JPG). Vazio: o PDF sai só com o nome."
      >
        <Texto nome="logoUrl" valor={registro?.logoUrl ?? undefined} placeholder="https://…/logo.png" />
      </Campo>
      <Campo
        nome="observacoesRodape"
        rotulo="Observações no rodapé do PDF"
        dica="Ex.: condições gerais, dados bancários, validade padrão."
      >
        <Texto nome="observacoesRodape" valor={registro?.observacoesRodape ?? undefined} />
      </Campo>
    </Formulario>
  );
}

export default async function EmpresaPage() {
  await exigirPagina('/cadastros/empresa');
  const admin = 'usuario' in (await soAdmin());
  const registro = await obterDadosEmpresa();

  return (
    <>
      <Cabecalho
        titulo="Dados da empresa"
        descricao="Aparece no cabeçalho do PDF do orçamento e como remetente do e-mail de envio. Só o administrador edita."
        voltar={{ href: '/cadastros', label: 'Voltar para cadastros' }}
      />
      <div className="card max-w-3xl">
        {admin ? (
          <FormEmpresa acao={salvarDadosEmpresa} registro={registro} />
        ) : registro ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Razão social</dt>
              <dd>{registro.nome}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">CNPJ</dt>
              <dd>{registro.cnpj ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">E-mail</dt>
              <dd>{registro.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Telefone</dt>
              <dd>{registro.telefone ?? '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">
            Nada cadastrado ainda. Peça ao administrador para preencher — sem isso, o PDF do orçamento sai sem
            cabeçalho da empresa.
          </p>
        )}
      </div>
    </>
  );
}
