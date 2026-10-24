import type { Cliente, Condominio } from '@prisma/client';
import { Campo, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';

export function FormCondominio({
  acao,
  registro,
  clientes,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Condominio;
  clientes: Pick<Cliente, 'id' | 'nome'>[];
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar alterações' : 'Cadastrar condomínio'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" rotulo="Nome do condomínio" obrigatorio>
          <Texto nome="nome" valor={registro?.nome} obrigatorio />
        </Campo>
        <Campo nome="cidade" rotulo="Cidade" obrigatorio dica="Nome + cidade identificam o condomínio.">
          <Texto nome="cidade" valor={registro?.cidade ?? undefined} />
        </Campo>
        <Campo nome="cnpj" rotulo="CNPJ">
          <Texto nome="cnpj" valor={registro?.cnpj ?? undefined} placeholder="00.000.000/0000-00" />
        </Campo>
        <Campo nome="endereco" rotulo="Endereço">
          <Texto nome="endereco" valor={registro?.endereco ?? undefined} />
        </Campo>
        <Campo nome="uf" rotulo="UF">
          <Texto nome="uf" valor={registro?.uf ?? undefined} />
        </Campo>
        <Campo nome="cep" rotulo="CEP">
          <Texto nome="cep" valor={registro?.cep ?? undefined} />
        </Campo>
      </div>

      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Contatos</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo nome="sindicoNome" rotulo="Síndico">
          <Texto nome="sindicoNome" valor={registro?.sindicoNome ?? undefined} />
        </Campo>
        <Campo nome="sindicoEmail" rotulo="E-mail do síndico">
          <Texto nome="sindicoEmail" tipo="email" valor={registro?.sindicoEmail ?? undefined} />
        </Campo>
        <Campo nome="sindicoTelefone" rotulo="Telefone do síndico">
          <Texto nome="sindicoTelefone" valor={registro?.sindicoTelefone ?? undefined} />
        </Campo>
      </div>
      <Campo nome="administradora" rotulo="Administradora">
        <Texto nome="administradora" valor={registro?.administradora ?? undefined} />
      </Campo>

      <Campo
        nome="clienteId"
        rotulo="Cliente que assina e paga"
        dica="Deixe vazio quando cada morador assina o próprio contrato (cobrança por unidade)."
      >
        <Escolha
          nome="clienteId"
          valor={registro?.clienteId ?? undefined}
          opcoes={[{ value: '', label: '— nenhum (contrato por morador) —' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
        />
      </Campo>
    </Formulario>
  );
}
