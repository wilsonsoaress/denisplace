import type { Equipamento } from '@prisma/client';
import { toISO } from '@/domain/dates';
import { STATUS_EQUIPAMENTO, opcoes } from '@/lib/rotulos';
import { SEM_CONDOMINIO, SEM_UNIDADE } from './dados';
import { Area, Campo, Escolha, EscolhaAgrupada, Formulario, Texto, type EstadoForm } from '@/ui/form';

export function FormEquipamento({
  acao,
  registro,
  condominios,
  grupos,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  registro?: Equipamento;
  condominios: { value: string; label: string }[];
  grupos: { rotulo: string; opcoes: { value: string; label: string }[] }[];
}) {
  return (
    <Formulario acao={acao} textoSubmit={registro ? 'Salvar alterações' : 'Cadastrar equipamento'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="modelo" rotulo="Modelo" obrigatorio dica="Ex. interfonia Pináculo modelo X.">
          <Texto nome="modelo" valor={registro?.modelo} obrigatorio />
        </Campo>
        <Campo nome="numeroSerie" rotulo="Número de série" obrigatorio dica="Identifica o bem: é a chave da garantia e da cobrança por equipamento.">
          <Texto nome="numeroSerie" valor={registro?.numeroSerie} obrigatorio />
        </Campo>
        <Campo nome="status" rotulo="Situação" obrigatorio>
          <Escolha nome="status" valor={registro?.status} opcoes={opcoes(STATUS_EQUIPAMENTO)} obrigatorio />
        </Campo>
        <Campo nome="garantiaAte" rotulo="Garantia até">
          <Texto nome="garantiaAte" tipo="date" valor={toISO(registro?.garantiaAte) ?? undefined} />
        </Campo>
        <Campo nome="condominioId" rotulo="Condomínio">
          <Escolha nome="condominioId" valor={registro?.condominioId ?? undefined} opcoes={[SEM_CONDOMINIO, ...condominios]} />
        </Campo>
        <Campo nome="unidadeId" rotulo="Unidade" dica="Opcional; use quando o bem está dentro de uma casa/apartamento.">
          <EscolhaAgrupada
            nome="unidadeId"
            valor={registro?.unidadeId ?? undefined}
            grupos={grupos}
            vazio={SEM_UNIDADE}
          />
        </Campo>
      </div>
      <Campo nome="observacoes" rotulo="Observações">
        <Area nome="observacoes" valor={registro?.observacoes ?? undefined} />
      </Campo>
    </Formulario>
  );
}
