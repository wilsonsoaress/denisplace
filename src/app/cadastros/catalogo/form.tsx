import type { CatalogoItem, IndiceReajuste } from '@prisma/client';
import { paraCampo } from '@/lib/form';
import { TIPO_CATALOGO, UNIDADE_COBRANCA, opcoes } from '@/lib/rotulos';
import { Area, Campo, Check, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';

export function FormCatalogoItem({
  acao,
  registro,
  indices,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: CatalogoItem;
  indices: Pick<IndiceReajuste, 'id' | 'sigla' | 'nome'>[];
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar alterações' : 'Cadastrar item'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" rotulo="Nome" obrigatorio>
          <Texto nome="nome" valor={registro?.nome} obrigatorio />
        </Campo>
        <Campo nome="tipo" rotulo="Tipo" obrigatorio>
          <Escolha nome="tipo" valor={registro?.tipo} opcoes={opcoes(TIPO_CATALOGO)} obrigatorio />
        </Campo>
        <Campo nome="precoPublico" rotulo="Preço público" obrigatorio dica="Referência de venda; o que é cobrado fica no item do contrato.">
          <Texto nome="precoPublico" valor={paraCampo(registro?.precoPublico)} obrigatorio />
        </Campo>
        <Campo nome="custoReferencia" rotulo="Custo de referência">
          <Texto nome="custoReferencia" valor={paraCampo(registro?.custoReferencia)} />
        </Campo>
        <Campo nome="unidadeCobranca" rotulo="Unidade de cobrança" obrigatorio>
          <Escolha
            nome="unidadeCobranca"
            valor={registro?.unidadeCobranca}
            opcoes={opcoes(UNIDADE_COBRANCA)}
            obrigatorio
          />
        </Campo>
        <Campo nome="indiceReajusteId" rotulo="Índice de reajuste padrão" dica="Herdado pelos itens de contrato criados a partir deste item.">
          <Escolha
            nome="indiceReajusteId"
            valor={registro?.indiceReajusteId ?? undefined}
            opcoes={[
              { value: '', label: '— sem índice (preço fixo) —' },
              ...indices.map((i) => ({ value: i.id, label: `${i.sigla} — ${i.nome}` })),
            ]}
          />
        </Campo>
      </div>
      <Campo nome="descricao" rotulo="Descrição">
        <Area nome="descricao" valor={registro?.descricao ?? undefined} />
      </Campo>
      <Campo nome="ativo" rotulo="Situação">
        <Check nome="ativo" rotulo="Ativo (disponível em novos orçamentos e contratos)" valor={registro?.ativo ?? true} />
      </Campo>
    </Formulario>
  );
}
