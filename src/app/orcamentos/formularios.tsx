'use client';

import { useState } from 'react';
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

const TIPOS_PESSOA = [
  { value: 'PF', label: 'Pessoa física' },
  { value: 'PJ', label: 'Pessoa jurídica' },
];

export function FormOrcamento({
  acao,
  registro,
  listas,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Orcamento;
  listas: ListasOrcamento;
}) {
  const [clienteNovo, setClienteNovo] = useState(false);
  const validade = registro ? undefined : addDays(hoje(), 15);
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar orçamento' : 'Criar orçamento'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="field-label">Cliente</span>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="_modoCliente"
                checked={!clienteNovo}
                onChange={() => setClienteNovo(false)}
                className="size-4"
              />
              Já cadastrado
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="_modoCliente"
                checked={clienteNovo}
                onChange={() => setClienteNovo(true)}
                className="size-4"
              />
              Cadastrar cliente agora
            </label>
          </div>
          <input type="hidden" name="clienteNovo" value={clienteNovo ? '1' : '0'} />
        </div>

        {!clienteNovo ? (
          <Campo nome="clienteId" rotulo="Cliente" obrigatorio>
            <Escolha
              nome="clienteId"
              valor={registro?.clienteId}
              opcoes={[{ value: '', label: '— escolher —' }, ...listas.clientes]}
              obrigatorio
            />
          </Campo>
        ) : (
          <>
            <Campo nome="novoClienteTipo" rotulo="Tipo de pessoa" obrigatorio>
              <Escolha nome="novoClienteTipo" valor="PF" opcoes={TIPOS_PESSOA} obrigatorio />
            </Campo>
            <Campo nome="novoClienteNome" rotulo="Nome / razão social" obrigatorio>
              <Texto nome="novoClienteNome" obrigatorio placeholder="Nome de quem está pedindo o orçamento" />
            </Campo>
            <Campo
              nome="novoClienteDocumento"
              rotulo="CPF / CNPJ"
              dica="Opcional agora; completa depois em Cadastros > Clientes."
            >
              <Texto nome="novoClienteDocumento" placeholder="000.000.000-00" />
            </Campo>
            <Campo nome="novoClienteEmail" rotulo="E-mail">
              <Texto nome="novoClienteEmail" tipo="email" />
            </Campo>
            <Campo nome="novoClienteTelefone" rotulo="Telefone">
              <Texto nome="novoClienteTelefone" />
            </Campo>
            <p className="self-end text-xs text-slate-500 sm:col-span-2">
              Cria o cadastro completo em Clientes, só com menos campos agora — e já fica vinculado a este orçamento.
            </p>
          </>
        )}

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

export function FormEnviarEmail({
  acao,
  emailPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  emailPadrao?: string | null;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Enviar por e-mail">
      <Campo
        nome="destinatario"
        rotulo="E-mail do destinatário"
        obrigatorio
        dica={emailPadrao ? undefined : 'O cliente não tem e-mail cadastrado — preencha aqui.'}
      >
        <Texto nome="destinatario" tipo="email" valor={emailPadrao ?? undefined} obrigatorio />
      </Campo>
      <Campo nome="mensagem" rotulo="Mensagem (opcional)" dica="Entra no corpo do e-mail, antes do total.">
        <Area nome="mensagem" linhas={3} />
      </Campo>
    </Formulario>
  );
}
