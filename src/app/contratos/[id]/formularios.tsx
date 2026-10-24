import { PERIODICIDADE_REAJUSTE, opcoes } from '@/lib/rotulos';
import { Area, Campo, Escolha, EscolhaAgrupada, Formulario, Texto, type EstadoForm } from '@/ui/form';
import { SEM_INDICE, SEM_MORADOR, type Opcao } from '../dados';

export function FormItemContrato({
  acao,
  catalogo,
  indices,
  inicioPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  catalogo: Opcao[];
  indices: Opcao[];
  inicioPadrao: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Adicionar item">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="catalogoItemId"
          rotulo="Item do catálogo"
          obrigatorio
          dica="O nome é copiado para o contrato: mudar o catálogo depois não altera a cobrança histórica."
        >
          <Escolha nome="catalogoItemId" opcoes={[{ value: '', label: '— escolher —' }, ...catalogo]} obrigatorio />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo nome="quantidade" rotulo="Quantidade" obrigatorio>
            <Texto nome="quantidade" tipo="number" valor="1" obrigatorio />
          </Campo>
          <Campo nome="precoUnitario" rotulo="Preço unitário" dica="Vazio = preço de tabela.">
            <Texto nome="precoUnitario" placeholder="0,00" />
          </Campo>
        </div>
        <Campo nome="inicio" rotulo="Cobrar a partir de" obrigatorio>
          <Texto nome="inicio" tipo="date" valor={inicioPadrao} obrigatorio />
        </Campo>
        <Campo nome="fim" rotulo="Parar de cobrar em" dica="Vazio = enquanto o contrato durar.">
          <Texto nome="fim" tipo="date" />
        </Campo>
        <Campo nome="indiceReajusteId" rotulo="Índice de reajuste">
          <Escolha nome="indiceReajusteId" opcoes={[SEM_INDICE, ...indices]} />
        </Campo>
        <Campo nome="periodicidade" rotulo="Periodicidade" obrigatorio>
          <Escolha nome="periodicidade" valor="ANUAL" opcoes={opcoes(PERIODICIDADE_REAJUSTE)} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormEncerrarItem({
  acao,
  descricao,
  dataPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  descricao: string;
  dataPadrao: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Encerrar item">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="fim" rotulo={`Última competência cobrada de ${descricao}`} obrigatorio dica="Data dentro do mês em que o item deixa de existir.">
          <Texto nome="fim" tipo="date" valor={dataPadrao} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormReajuste({
  acao,
  descricao,
  compPadrao,
  preview,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  descricao: string;
  compPadrao: string;
  preview: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Aplicar reajuste">
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{preview}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="competencia"
          rotulo={`Competência do reajuste de ${descricao}`}
          obrigatorio
          dica="A projeção acima vale para esta data sugerida; se mudar a competência, a confirmação traz o número aplicado."
        >
          <Texto nome="competencia" tipo="date" valor={compPadrao} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormAderencia({
  acao,
  unidades,
  moradores,
  desdePadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  unidades: { rotulo: string; opcoes: Opcao[] }[];
  moradores: Opcao[];
  desdePadrao: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Aderir unidade">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo nome="unidadeId" rotulo="Unidade" obrigatorio>
          <EscolhaAgrupada nome="unidadeId" grupos={unidades} />
        </Campo>
        <Campo nome="moradorId" rotulo="Morador" dica="Vazio usa o titular cadastrado da unidade.">
          <Escolha nome="moradorId" opcoes={[SEM_MORADOR, ...moradores]} />
        </Campo>
        <Campo nome="desde" rotulo="Desde" obrigatorio dica="Se a unidade já estava aderida, a adesão anterior é encerrada no dia anterior.">
          <Texto nome="desde" tipo="date" valor={desdePadrao} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormEncerrarAderencia({
  acao,
  codigo,
  atePadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  codigo: string;
  atePadrao: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Encerrar adesão">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="ate" rotulo={`Saída de ${codigo}`} obrigatorio dica="Até esta data o boleto daquela unidade continua sendo gerado.">
          <Texto nome="ate" tipo="date" valor={atePadrao} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormDistrato({
  acao,
  dataPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  dataPadrao: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Registrar distrato">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="data" rotulo="Data do distrato" obrigatorio>
          <Texto nome="data" tipo="date" valor={dataPadrao} obrigatorio />
        </Campo>
        <Campo nome="motivo" rotulo="Motivo" obrigatorio dica="Fica no aditivo e no contrato, para a auditoria.">
          <Area nome="motivo" linhas={2} />
        </Campo>
      </div>
    </Formulario>
  );
}

export function FormGerarCobranca({
  acao,
  compPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  compPadrao: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit="Gerar cobrança">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="competencia"
          rotulo="Competência"
          obrigatorio
          dica="Idempotente: se a fatura do mês já existe, nada é duplicado."
        >
          <Texto nome="competencia" tipo="date" valor={compPadrao} obrigatorio />
        </Campo>
      </div>
    </Formulario>
  );
}
