import type {
  EscopoCobranca,
  EscopoItem,
  FormaPagamento,
  PeriodicidadeReajuste,
  StatusContrato,
  StatusEquipamento,
  StatusFatura,
  StatusOS,
  StatusOrcamento,
  TipoAditivo,
  TipoCatalogo,
  TipoEmissao,
  TipoOS,
  TipoPessoa,
  UnidadeCobranca,
} from '@prisma/client';

/**
 * Rotulos pt-BR dos enums. A tela mostra texto, nunca a constante interna:
 * o usuario do sistema e financeiro, nao dev.
 */
export const TIPO_PESSOA: Record<TipoPessoa, string> = { PF: 'Pessoa física', PJ: 'Pessoa jurídica' };
export const ESCOPO_COBRANCA: Record<EscopoCobranca, string> = {
  CONDOMINIO: 'Boleto único do condomínio',
  UNIDADE: 'Um boleto por unidade',
};
export const STATUS_CONTRATO: Record<StatusContrato, string> = {
  RASCUNHO: 'Rascunho',
  VIGENTE: 'Vigente',
  SUSPENSO: 'Suspenso',
  DISTRATADO: 'Distratado',
  VENCIDO: 'Vencido',
};
export const PERIODICIDADE_REAJUSTE: Record<PeriodicidadeReajuste, string> = {
  ANUAL: 'Anual',
  SEMESTRAL: 'Semestral',
  NENHUM: 'Sem reajuste',
};
export const TIPO_ADITIVO: Record<TipoAditivo, string> = {
  REAJUSTE: 'Reajuste',
  ACRESCIMO: 'Acréscimo',
  REMOCAO: 'Remoção',
  ALTERACAO: 'Alteração',
  SUSPENSAO: 'Suspensão',
  RETOMADA: 'Retomada',
  DISTRACTO: 'Distrato',
};
export const TIPO_CATALOGO: Record<TipoCatalogo, string> = {
  SERVICO: 'Serviço',
  EQUIPAMENTO: 'Equipamento',
};
export const UNIDADE_COBRANCA: Record<UnidadeCobranca, string> = {
  MENSALIDADE: 'Mensalidade',
  PONTO: 'Por ponto',
  HORA: 'Por hora',
  PECA: 'Por peça',
  DIARIA: 'Por diária',
};
export const STATUS_EQUIPAMENTO: Record<StatusEquipamento, string> = {
  ESTOQUE: 'Em estoque',
  INSTALADO: 'Instalado',
  MANUTENCAO: 'Em manutenção',
  BAIXADO: 'Baixado',
};
export const FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  TRANSFERENCIA: 'Transferência',
  CHEQUE: 'Cheque',
  CARTAO: 'Cartão',
  BOLETO: 'Boleto',
  OUTRO: 'Outro',
};
export const STATUS_FATURA: Record<StatusFatura, string> = { ABERTA: 'Aberta', CANCELADA: 'Cancelada' };
export const STATUS_ORCAMENTO: Record<StatusOrcamento, string> = {
  ABERTO: 'Aberto',
  ENVIADO: 'Enviado',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  CONVERTIDO: 'Convertido',
  EXPIRADO: 'Expirado',
};
export const ESCOPO_ITEM: Record<EscopoItem, string> = { PONTUAL: 'Pontual', RECORRENTE: 'Recorrente' };
export const STATUS_OS: Record<StatusOS, string> = {
  ABERTA: 'Aberta',
  AGENDADA: 'Agendada',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};
export const TIPO_OS: Record<TipoOS, string> = {
  INSTALACAO: 'Instalação',
  MANUTENCAO: 'Manutenção',
  VISTORIA: 'Vistoria',
  RETIRADA: 'Retirada',
};
export const TIPO_EMISSAO: Record<TipoEmissao, string> = {
  BOLETO: 'Boleto',
  NF: 'Nota fiscal',
  SEGUNDA_VIA: 'Segunda via',
};

export function opcoes<T extends string>(map: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));
}
