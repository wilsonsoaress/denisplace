import type { Pagamento } from '@prisma/client';
import { brl, money, type Money } from '@/domain/money';
import { hoje, type DateISO } from '@/domain/dates';
import { FORMA_PAGAMENTO, TIPO_EMISSAO } from '@/lib/rotulos';
import { paraCampo } from '@/lib/form';
import { Campo, Escolha, Formulario, Texto } from '@/ui/form';
import { desmarcarEmitido, estornarPagamento, marcarEmitido, marcarIsento, registrarPagamento } from '@/server/acoes/contas';

const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'BOLETO', 'OUTRO'] as const;
const TIPOS = ['BOLETO', 'NF', 'SEGUNDA_VIA'] as const;

export function FormPagamento({
  tituloId,
  saldo,
  vencimento,
}: {
  tituloId: string;
  saldo: Money;
  vencimento: DateISO;
}) {
  const hojeStr = hoje();
  const emAtraso = vencimento < hojeStr;
  return (
    <Formulario acao={registrarPagamento.bind(null, tituloId)} textoSubmit="Registrar pagamento">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nome="data"
          rotulo="Data do pagamento"
          obrigatorio
          dica="Os juros param de correr nesta data, não na de hoje."
        >
          <Texto nome="data" tipo="date" valor={hojeStr} obrigatorio />
        </Campo>
        <Campo nome="forma" rotulo="Forma" obrigatorio>
          <Escolha nome="forma" opcoes={FORMAS.map((f) => ({ value: f, label: FORMA_PAGAMENTO[f] }))} obrigatorio />
        </Campo>
        <Campo
          nome="valor"
          rotulo="Valor recebido"
          dica={`Em branco, quita tudo (${brl(saldo)} devidos hoje). Menos que isso registra pagamento parcial.`}
        >
          <Texto nome="valor" placeholder={paraCampo(saldo)} />
        </Campo>
        <Campo nome="comprovanteUrl" rotulo="Comprovante (link)" dica="URL do comprovante, se estiver no Drive/OneDrive.">
          <Texto nome="comprovanteUrl" placeholder="https://…" />
        </Campo>
      </div>
      <Campo nome="observacao" rotulo="Observação" dica={emAtraso ? 'Título vencido: multa de 2% e juros de 1% ao mês já estão no saldo.' : undefined}>
        <Texto nome="observacao" />
      </Campo>
    </Formulario>
  );
}

export function FormEstorno({ tituloId, pagamento }: { tituloId: string; pagamento: Pagamento }) {
  return (
    <Formulario acao={estornarPagamento.bind(null, tituloId, pagamento.id)} textoSubmit="Confirmar estorno">
      <Campo
        nome="motivo"
        rotulo="Motivo do estorno"
        obrigatorio
        dica="O pagamento deixa de valer, mas a linha fica no histórico com a data e o motivo."
      >
        <Texto nome="motivo" placeholder="Ex.: recebimento lançado em título errado." />
      </Campo>
    </Formulario>
  );
}

export function FormIsencao({ tituloId, valorOriginal }: { tituloId: string; valorOriginal: Money }) {
  return (
    <Formulario acao={marcarIsento.bind(null, tituloId)} textoSubmit="Marcar como isento">
      <Campo
        nome="motivo"
        rotulo="Motivo da isenção"
        obrigatorio
        dica={`Convênio ou cortesia. O título de ${brl(money(valorOriginal))} sai da adimplência e da receita recorrente.`}
      >
        <Texto nome="motivo" placeholder="Ex.: cortesia de 1 mês no fechamento do contrato." />
      </Campo>
    </Formulario>
  );
}

/** Emissao de um titulo so: aqui o numero (NF ou nosso numero) faz sentido. */
export function FormEmissaoTitulo({ tituloId }: { tituloId: string }) {
  return (
    <Formulario acao={marcarEmitido} textoSubmit="Registrar emissão">
      <input type="hidden" name="ids" value={tituloId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="tipo" rotulo="O que foi emitido" obrigatorio>
          <Escolha nome="tipo" opcoes={TIPOS.map((t) => ({ value: t, label: TIPO_EMISSAO[t] }))} obrigatorio />
        </Campo>
        <Campo
          nome="numero"
          rotulo="Número"
          dica="Nº da nota fiscal ou nosso número do boleto. Vazio se você ainda não tem o número."
        >
          <Texto nome="numero" />
        </Campo>
      </div>
    </Formulario>
  );
}

export function BotaoDesmarcar({ tituloId, campo, rotulo }: { tituloId: string; campo: 'boleto' | 'nf'; rotulo: string }) {
  return (
    <form action={desmarcarEmitido.bind(null, tituloId, campo)}>
      <button type="submit" className="text-xs text-slate-500 hover:text-red-700">
        {rotulo}
      </button>
    </form>
  );
}
