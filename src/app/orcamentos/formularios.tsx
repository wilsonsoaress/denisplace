'use client';

import type { Orcamento } from '@prisma/client';
import { addDays, hoje, toISO } from '@/domain/dates';
import { ESCOPO_COBRANCA, ESCOPO_ITEM, PERIODICIDADE_REAJUSTE, STATUS_CONTRATO, opcoes } from '@/lib/rotulos';
import { Area, Campo, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';
import { SEM_CONDOMINIO, type Opcao } from '@/app/contratos/dados';

export type ListasOrcamento = {
  clientes: Opcao[];
  condominios: Opcao[];
  catalogo: Opcao[];
};

export function FormOrcamento({
  acao,
  registro,
  listas,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Orcamento;
  listas: ListasOrcamento;
}) {
  const validade = registro ? undefined : addDays(hoje(), 15);
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar orçamento' : 'Criar orçamento'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="clienteId" rotulo="Cliente" obrigatorio>
          <Escolha
            nome="clienteId"
            valor={registro?.clienteId}
            opcoes={[{ value: '', label: '— escolher —' }, ...listas.clientes]}
            obrigatorio
          />
        </Campo>
        <Campo nome="condominioId" rotulo="Condomínio" dica="Obrigatório na prática: é ele que aparece na matriz.">
          <Escolha
            nome="condominioId"
            valor={registro?.condominioId ?? undefined}
            opcoes={[SEM_CONDOMINIO, ...listas.condominios]}
          />
        </Campo>
        <Campo nome="titulo" rotulo="Título do orçamento" obrigatorio>
          <Texto nome="titulo" valor={registro?.titulo} obrigatorio placeholder="Portaria eletrônica — 12 câmeras" />
        </Campo>
        <Campo nome="validade" rotulo="Validade" obrigatorio dica="Depois dessa data o orçamento deixa de contar como oportunidade.">
          <Texto nome="validade" tipo="date" valor={(registro ? toISO(registro.validade) : validade) ?? undefined} obrigatorio />
        </Campo>
      </div>
      <Campo nome="descricao" rotulo="Descrição comercial">
        <Area nome="descricao" valor={registro?.descricao ?? undefined} linhas={4} />
      </Campo>
    </Formulario>
  );
}

export function FormItemOrcamento({
  acao,
  listas,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  listas: ListasOrcamento;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Adicionar ao orçamento">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="catalogoItemId" rotulo="Item do catálogo" obrigatorio>
          <Escolha
            nome="catalogoItemId"
            opcoes={[{ value: '', label: '— escolher —' }, ...listas.catalogo]}
            obrigatorio
          />
        </Campo>
        <Campo
          nome="escopo"
          rotulo="Escopo do item"
          obrigatorio
          dica="Pontual vira ordem de serviço; recorrente vira item de contrato."
        >
          <Escolha nome="escopo" valor="RECORRENTE" opcoes={opcoes(ESCOPO_ITEM)} obrigatorio />
        </Campo>
        <Campo nome="quantidade" rotulo="Quantidade" dica="Em branco: 1.">
          <Texto nome="quantidade" placeholder="1" />
        </Campo>
        <Campo nome="precoUnitario" rotulo="Preço unitário (R$)" dica="Em branco: usa o preço público do catálogo.">
          <Texto nome="precoUnitario" placeholder="0,00" />
        </Campo>
        <Campo nome="inicioVigencia" rotulo="Início da cobrança" dica="Só para item recorrente; vazio usa o início do contrato.">
          <Texto nome="inicioVigencia" tipo="month" />
        </Campo>
        <Campo nome="periodicidade" rotulo="Reajuste" dica="Só para item recorrente.">
          <Escolha nome="periodicidade" valor="ANUAL" opcoes={opcoes(PERIODICIDADE_REAJUSTE)} />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormConversao({
  acao,
  inicioPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  inicioPadrao?: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Converter em contrato e OS">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="escopo"
          rotulo="Escopo de cobrança do contrato"
          obrigatorio
          dica="Por unidade exige adesões antes de ativar o contrato."
        >
          <Escolha nome="escopo" valor="CONDOMINIO" opcoes={opcoes(ESCOPO_COBRANCA)} obrigatorio />
        </Campo>
        <Campo nome="vencimentoDia" rotulo="Vencimento (dia)" obrigatorio>
          <Texto nome="vencimentoDia" tipo="number" valor="5" obrigatorio />
        </Campo>
        <Campo nome="inicio" rotulo="Início da vigência" obrigatorio>
          <Texto nome="inicio" tipo="date" valor={inicioPadrao ?? hoje()} obrigatorio />
        </Campo>
        <Campo nome="fim" rotulo="Fim da vigência" dica="Vazio = por tempo indeterminado.">
          <Texto nome="fim" tipo="date" />
        </Campo>
      </div>
      <p className="text-xs text-slate-500">
        O contrato nasce em <b>{STATUS_CONTRATO.RASCUNHO.toLowerCase()}</b>: ative depois de conferir as adesões, porque a
        geração mensal só percorre contratos vigentes.
      </p>
    </Formulario>
  );
}
