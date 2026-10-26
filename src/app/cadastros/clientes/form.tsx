import type { Cliente } from '@prisma/client';
import { TIPO_PESSOA, opcoes } from '@/lib/rotulos';
import { Area, Campo, Check, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';

export function FormCliente({
  acao,
  registro,
  condominios = [],
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Cliente;
  /** Condomínios que o cliente pode ter como vínculo de morador. */
  condominios?: { id: string; nome: string; cidade: string | null }[];
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar alterações' : 'Cadastrar cliente'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="tipo" rotulo="Tipo de pessoa" obrigatorio>
          <Escolha
            nome="tipo"
            valor={registro?.tipo}
            opcoes={opcoes(TIPO_PESSOA)}
            obrigatorio
          />
        </Campo>
        <Campo
          nome="documento"
          rotulo="CPF / CNPJ"
          dica="Somente os dígitos; máscaras são ignoradas. 11 para CPF, 14 para CNPJ."
        >
          <Texto nome="documento" valor={registro?.documento ?? undefined} placeholder="000.000.000-00" />
        </Campo>
        <Campo nome="nome" rotulo="Nome / razão social" obrigatorio>
          <Texto nome="nome" valor={registro?.nome} obrigatorio />
        </Campo>
        <Campo
          nome="condominioId"
          rotulo="Pertence ao condomínio"
          dica="Morador cliente: o condomínio a que ele pertence, mesmo quando quem contrata é o síndico."
        >
          <Escolha
            nome="condominioId"
            valor={registro?.condominioId ?? undefined}
            opcoes={[
              { value: '', label: '— nenhum vínculo —' },
              ...condominios.map((c) => ({ value: c.id, label: c.cidade ? `${c.nome} · ${c.cidade}` : c.nome })),
            ]}
          />
        </Campo>
        <Campo nome="cidade" rotulo="Cidade">
          <Texto nome="cidade" valor={registro?.cidade ?? undefined} />
        </Campo>
        <Campo nome="email" rotulo="E-mail">
          <Texto nome="email" tipo="email" valor={registro?.email ?? undefined} />
        </Campo>
        <Campo nome="telefone" rotulo="Telefone">
          <Texto nome="telefone" valor={registro?.telefone ?? undefined} />
        </Campo>
        <Campo nome="endereco" rotulo="Endereço">
          <Texto nome="endereco" valor={registro?.endereco ?? undefined} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo nome="uf" rotulo="UF">
            <Texto nome="uf" valor={registro?.uf ?? undefined} />
          </Campo>
          <Campo nome="cep" rotulo="CEP">
            <Texto nome="cep" valor={registro?.cep ?? undefined} />
          </Campo>
        </div>
      </div>
      <Campo nome="observacoes" rotulo="Observações">
        <Area nome="observacoes" valor={registro?.observacoes ?? undefined} />
      </Campo>
      <div className="flex flex-wrap gap-6">
        <Campo nome="ehCondominio" rotulo="Perfil">
          <Check nome="ehCondominio" rotulo="Este cliente é o próprio condomínio" valor={registro?.ehCondominio} />
        </Campo>
        <Campo nome="ativo" rotulo="Situação">
          <Check nome="ativo" rotulo="Ativo (aparece em novos contratos)" valor={registro?.ativo ?? true} />
        </Campo>
      </div>
    </Formulario>
  );
}

/**
 * Atendimento de pedido de titular. A confirmação digitada (SIM) existe porque a
 * anonimização é irreversível: o nome volta como apelido e o documento se perde.
 */
export function FormLgpd({ acao }: { acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm> }) {
  return (
    <Formulario acao={acao} textoSubmit="Anonimizar dados">
      <Campo
        nome="motivo"
        rotulo="Motivo do pedido"
        obrigatorio
        dica="Pedido do titular, fim da relação de consumo ou prazo de guarda vencido. Fica na trilha de auditoria."
      >
        <Texto nome="motivo" placeholder="Titular pediu a remoção dos dados dele" />
      </Campo>
      <Campo
        nome="confirmar"
        rotulo="Digite SIM para confirmar"
        obrigatorio
        dica="Não há volta: o nome vira apelido e documento, contato e endereço são apagados."
      >
        <Texto nome="confirmar" placeholder="SIM" />
      </Campo>
    </Formulario>
  );
}
