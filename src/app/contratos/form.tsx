import type { Contrato } from '@prisma/client';
import { ESCOPO_COBRANCA, opcoes } from '@/lib/rotulos';
import { paraCampo } from '@/lib/form';
import { toISO } from '@/domain/dates';
import { Area, Campo, Escolha, Formulario, Texto, type EstadoForm } from '@/ui/form';
import { SEM_CONDOMINIO, SEM_MAE, type Opcao } from './dados';

export type ListasContrato = {
  clientes: Opcao[];
  condominios: Opcao[];
  maes: Opcao[];
};

export function FormContrato({
  acao,
  registro,
  listas,
  inicioPadrao,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Contrato;
  listas: ListasContrato;
  inicioPadrao?: string;
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar contrato' : 'Criar contrato'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="clienteId" rotulo="Cliente que assina" obrigatorio>
          <Escolha
            nome="clienteId"
            valor={registro?.clienteId}
            opcoes={[{ value: '', label: '— escolher —' }, ...listas.clientes]}
            obrigatorio
          />
        </Campo>
        <Campo nome="condominioId" rotulo="Condomínio" dica="Obrigatório na prática: é ele que aparece na matriz de inadimplência.">
          <Escolha nome="condominioId" valor={registro?.condominioId ?? undefined} opcoes={[SEM_CONDOMINIO, ...listas.condominios]} />
        </Campo>
        <Campo
          nome="escopo"
          rotulo="Escopo de cobrança"
          obrigatorio
          dica="Por unidade gera um título por adesão; do condomínio gera um título único."
        >
          <Escolha nome="escopo" valor={registro?.escopo} opcoes={opcoes(ESCOPO_COBRANCA)} obrigatorio />
        </Campo>
        <Campo
          nome="parentContractId"
          rotulo="Contrato-mãe"
          dica="Só para contrato por unidade: herda as condições do contrato do condomínio."
        >
          <Escolha
            nome="parentContractId"
            valor={registro?.parentContractId ?? undefined}
            opcoes={[SEM_MAE, ...listas.maes]}
          />
        </Campo>
        <Campo nome="inicio" rotulo="Início da vigência" obrigatorio>
          <Texto nome="inicio" tipo="date" valor={registro ? toISO(registro.inicio) ?? undefined : inicioPadrao} obrigatorio />
        </Campo>
        <Campo nome="fim" rotulo="Fim da vigência" dica="Vazio = por tempo indeterminado.">
          <Texto nome="fim" tipo="date" valor={registro ? toISO(registro.fim) ?? undefined : undefined} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo nome="vencimentoDia" rotulo="Vencimento (dia)" obrigatorio>
            <Texto nome="vencimentoDia" tipo="number" valor={String(registro?.vencimentoDia ?? 5)} obrigatorio />
          </Campo>
          <Campo nome="descontoPct" rotulo="Desconto (%)" dica="Percentual sobre o bruto da fatura.">
            <Texto nome="descontoPct" valor={paraCampo(registro?.descontoPct) ?? '0'} />
          </Campo>
        </div>
      </div>
      <Campo nome="observacoes" rotulo="Observações do contrato">
        <Area nome="observacoes" valor={registro?.observacoes ?? undefined} />
      </Campo>
    </Formulario>
  );
}
