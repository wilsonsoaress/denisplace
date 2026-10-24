import type { StatusOrcamento } from '@prisma/client';

/**
 * Chip de status do funil. Fica aqui porque página do Next não pode exportar
 * nada além do default e do metadata.
 */
export const CHIP_ORCAMENTO: Record<StatusOrcamento, string> = {
  ABERTO: 'chip chip-free',
  ENVIADO: 'chip chip-warn',
  APROVADO: 'chip chip-ok',
  RECUSADO: 'chip chip-bad',
  CONVERTIDO: 'chip chip-ok',
  EXPIRADO: 'chip chip-free',
};
