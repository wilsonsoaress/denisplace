import type { PagamentoContaPagar } from '@prisma/client';
import { brl, money, type Money } from '@/domain/money';
import { hoje, type DateISO } from '@/domain/dates';
import { FORMA_PAGAMENTO, CATEGORIA_CONTA_PAGAR } from '@/lib/rotulos';
import { paraCampo } from '@/lib/form';
import { Campo, Check, Escolha, Formulario, Texto } from '@/ui/form';
import {
  desmarcarNfRecebida,
  estornarPagamentoContaPagar,
  marcarNfRecebida,
  registrarContaPagar,
  registrarPagamentoContaPagar,
} from '@/server/acoes/contasPagar';

const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARTAO', 'BOLETO', 'OUTRO'] as const;
const CATEGORIAS = ['EQUIPAMENTO', 'INSTALACAO', 'MANUTENCAO', 'COMISSAO', 'FRETE', 'TAXA', 'OUTRO'] as const;

export function FormLancamento({ contratos }: { contratos: { id: string; label: string }[] }) {
  const hojeStr = hoje();
  return (
    <Formulario acao={registrarContaPagar} textoSubmit="Registrar lançamento">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo nome="fornecedorNome" rotulo="Fornecedor" obrigatorio>
          <Texto nome="fornecedorNome" placeholder="Nome do fornecedor/prestador" obrigatorio />
        </Campo>
        <Campo nome="categoria" rotulo="Categoria" obrigatorio>
          <Escolha
            nome="categoria"
            opcoes={CATEGORIAS.map((c) => ({ value: c, label: CATEGORIA_CONTA_PAGAR[c] }))}
            obrigatorio
          />
        </Campo>
        <Campo nome="descricao" rotulo="Descrição" obrigatorio>
          <Texto nome="descricao" placeholder="Ex.: aluguel do link dedicado" obrigatorio />
        </Campo>
        <Campo nome="competencia" rotulo="Competência" obrigatorio dica="Use qualquer dia do mês de referência.">
          <Texto nome="competencia" tipo="date" valor={hojeStr} obrigatorio />
        </Campo>
        <Campo nome="vencimento" rotulo="Vencimento" obrigatorio>
          <Texto nome="vencimento" tipo="date" valor={hojeStr} obrigatorio />
        </Campo>
        <Campo nome="valorOriginal" rotulo="Valor" obrigatorio>
          <Texto nome="valorOriginal" placeholder="0,00" obrigatorio />
        </Campo>
        <Campo
          nome="contratoId"
          rotulo="Contrato (opcional)"
          dica="Vincula o custo ao contrato para alimentar o resultado por contrato (F2)."
        >
          <select name="contratoId" className="input" defaultValue="">
            <option value="">sem vínculo</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="flex flex-wrap gap-4">
        <Check nome="encargoPorAtraso" rotulo="Fornecedor cobra multa e juros em atraso (2% + 1% a.m.)" />
        <Check nome="recorrente" rotulo="Lançamento recorrente (repete todo mês)" />
      </div>
      <Campo nome="observacoes" rotulo="Observações" dica="Opcional.">
        <Texto nome="observacoes" />
      </Campo>
    </Formulario>
  );
}

export function FormPagamentoContaPagar({
  contaPagarId,
  saldo,
}: {
  contaPagarId: string;
  saldo: Money;
}) {
  const hojeStr = hoje();
  return (
    <Formulario acao={registrarPagamentoContaPagar.bind(null, contaPagarId)} textoSubmit="Registrar pagamento">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="data" rotulo="Data do pagamento" obrigatorio>
          <Texto nome="data" tipo="date" valor={hojeStr} obrigatorio />
        </Campo>
        <Campo nome="forma" rotulo="Forma" obrigatorio>
          <Escolha nome="forma" opcoes={FORMAS.map((f) => ({ value: f, label: FORMA_PAGAMENTO[f] }))} obrigatorio />
        </Campo>
        <Campo nome="valor" rotulo="Valor pago" dica={`Em branco, quita os ${brl(saldo)} devidos hoje.`}>
          <Texto nome="valor" placeholder={paraCampo(saldo)} />
        </Campo>
        <Campo nome="comprovanteUrl" rotulo="Comprovante (link)" dica="URL do comprovante, se estiver no Drive/OneDrive.">
          <Texto nome="comprovanteUrl" placeholder="https://…" />
        </Campo>
      </div>
      <Campo nome="observacao" rotulo="Observação">
        <Texto nome="observacao" />
      </Campo>
    </Formulario>
  );
}

export function FormEstornoContaPagar({
  contaPagarId,
  pagamento,
}: {
  contaPagarId: string;
  pagamento: PagamentoContaPagar;
}) {
  return (
    <Formulario acao={estornarPagamentoContaPagar.bind(null, contaPagarId, pagamento.id)} textoSubmit="Confirmar estorno">
      <Campo nome="motivo" rotulo="Motivo do estorno" obrigatorio>
        <Texto nome="motivo" placeholder="Ex.: pagamento lançado no fornecedor errado." />
      </Campo>
    </Formulario>
  );
}

export function FormNfContaPagar({ contaPagarId }: { contaPagarId: string }) {
  return (
    <Formulario acao={marcarNfRecebida} textoSubmit="Registrar NF de entrada">
      <input type="hidden" name="ids" value={contaPagarId} />
      <Campo nome="numero" rotulo="Número da NF" dica="Vazio se você ainda não tem o número.">
        <Texto nome="numero" />
      </Campo>
    </Formulario>
  );
}

export function BotaoDesmarcarNf({ contaPagarId }: { contaPagarId: string }) {
  return (
    <form action={desmarcarNfRecebida.bind(null, contaPagarId)}>
      <button type="submit" className="text-xs text-slate-500 hover:text-red-700">
        desmarcar NF de entrada
      </button>
    </form>
  );
}
