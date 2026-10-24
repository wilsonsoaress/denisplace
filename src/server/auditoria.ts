import { prisma } from './db';
import type { Prisma } from '@prisma/client';
import type { UsuarioSessao } from '@/auth/guard';

/**
 * Trilha de auditoria da F1, sobre o AuditLog que o schema já tinha: quem, quando,
 * em quê e o que mudou (o texto legível vai em `motivo`, os estados em antes/depois).
 * Falhar a gravação não pode impedir a operação — o título pago é o fato, a trilha é
 * a prova — então registramos em best-effort e o desvio aparece no log do servidor.
 */
export async function registrarAuditoria(
  usuario: UsuarioSessao,
  entrada: {
    acao: string;
    entidade: string;
    entidadeId: string;
    resumo: string;
    antes?: Prisma.InputJsonObject;
    depois?: Prisma.InputJsonObject;
  },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: usuario.id,
        entidade: entrada.entidade,
        entidadeId: entrada.entidadeId,
        acao: entrada.acao,
        antes: entrada.antes,
        depois: entrada.depois,
        motivo: entrada.resumo,
      },
    });
  } catch (erro) {
    console.error('auditoria nao gravada', entrada, erro);
  }
}
