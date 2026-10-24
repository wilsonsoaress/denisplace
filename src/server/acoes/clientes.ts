'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { booleano, documento, email, enumDe, obrigatorio, opcional, validar } from '@/lib/form';
import type { EstadoForm } from '@/ui/form';
import { prisma } from '../db';
import { colunaDuplicada } from '../erros';

const schema = z.object({
  tipo: enumDe('Tipo de pessoa', ['PF', 'PJ'] as const),
  nome: obrigatorio('Nome', 160),
  documento: documento(),
  email: email(),
  telefone: opcional(40),
  endereco: opcional(200),
  cidade: opcional(80),
  uf: opcional(2),
  cep: opcional(10),
  ehCondominio: booleano(),
  observacoes: opcional(2000),
  ativo: booleano(),
});


async function gravar(id: string | null, dados: z.infer<typeof schema>) {
  const registro = {
    tipo: dados.tipo,
    nome: dados.nome,
    documento: dados.documento || null,
    email: dados.email || null,
    telefone: dados.telefone || null,
    endereco: dados.endereco || null,
    cidade: dados.cidade || null,
    uf: dados.uf || null,
    cep: dados.cep || null,
    ehCondominio: dados.ehCondominio,
    observacoes: dados.observacoes || null,
    ativo: dados.ativo,
  };
  if (id === null) return prisma.cliente.create({ data: registro });
  return prisma.cliente.update({ where: { id }, data: registro });
}

/** id null = criacao. Bind parcial pela pagina; useActionState chama (prev, formData). */
export async function salvarCliente(id: string | null, _prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const resultado = validar(schema, fd);
  if (!resultado.ok) return { erros: resultado.erros };

  try {
    const cliente = await gravar(id, resultado.dados);
    revalidatePath('/cadastros/clientes');
    redirect(`/cadastros/clientes/${cliente.id}?salvo=1`);
  } catch (erro) {
    const coluna = colunaDuplicada(erro);
    if (coluna) {
      return {
        erros: {
          [coluna === 'documento' ? 'documento' : 'nome']:
            coluna === 'documento'
              ? 'Já existe cliente com este CPF/CNPJ.'
              : 'Este nome já está cadastrado.',
        },
      };
    }
    throw erro;
  }
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<void> {
  await prisma.cliente.update({ where: { id }, data: { ativo } });
  revalidatePath('/cadastros/clientes');
}
