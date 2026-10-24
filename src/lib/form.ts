import { z } from 'zod';

/** Converte FormData em Record<string,string>. Campos de texto vazios viram ausentes. */
export function valores(fd: FormData): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of fd.entries()) {
    if (typeof valor === 'string' && valor.trim() !== '') saida[chave] = valor.trim();
  }
  return saida;
}

export type Erros = Record<string, string>;

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erros: Erros };

/**
 * Parseia com zod e devolve erros por campo em pt-BR. O rotulo do campo vem do
 * proprio schema (mensagem customizeada) para a tela nao precisar mapear chaves.
 */
export function validar<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, fd: FormData): Resultado<T> {
  const bruto = valores(fd);
  const parsed = schema.safeParse(bruto);
  if (parsed.success) return { ok: true, dados: parsed.data };
  const erros: Erros = {};
  for (const issue of parsed.error.issues) {
    const chave = issue.path.join('.') || '_';
    if (!erros[chave]) erros[chave] = issue.message;
  }
  return { ok: false, erros };
}

/**
 * Numero decimal aceitando virgula, porque e assim que se digita em pt-BR.
 * Com virgula: os pontos sao separadores de milhar. Sem virgula: o ponto decimal
 * e o ultimo ponto da string (assim "1.234,56" e "1234.56" dao o mesmo valor).
 */
const decimalBase = (rotulo: string) =>
  z
    .string({ required_error: `${rotulo} é obrigatório.` })
    .transform((v) =>
      v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,(?=[^,]*$)/, '.'),
    )
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), `${rotulo} deve ser um número.`)
    .refine((v) => Number(v) >= 0, `${rotulo} não pode ser negativo.`);

export const decimal = (rotulo: string) => decimalBase(rotulo);

/** Variantes com sinal: usado por variações de índice, que podem ser negativas (deflação). */
export const decimalComSinal = (rotulo: string) =>
  z
    .string({ required_error: `${rotulo} é obrigatório.` })
    .transform((v) =>
      v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,(?=[^,]*$)/, '.'),
    )
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), `${rotulo} deve ser um número.`);

export const decimalOpcional = (rotulo: string) =>
  z.preprocess((v) => (v === undefined || v === '' ? undefined : v), decimalBase(rotulo).optional());

/** Data de input type=date (YYYY-MM-DD). Rejeita formato errado antes de tocar o Prisma. */
export const dataISO = (rotulo: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${rotulo} deve ser uma data válida.`);

export const dataOpcional = (rotulo: string) =>
  z.preprocess((v) => (v === undefined || v === '' ? undefined : v), dataISO(rotulo).optional());

export const obrigatorio = (rotulo: string, max = 200) =>
  z
    .string({ required_error: `${rotulo} é obrigatório.` })
    .min(2, `${rotulo} é obrigatório.`)
    .max(max, `${rotulo} deve ter no máximo ${max} caracteres.`);

export const opcional = (max = 500) =>
  z.preprocess((v) => (v === undefined || v === '' ? undefined : v), z.string().max(max).optional());

export const enumDe = <T extends readonly [string, ...string[]]>(rotulo: string, valores_: T) =>
  z
    .string({ required_error: `${rotulo} é obrigatório.` })
    .refine((v): v is T[number] => (valores_ as readonly string[]).includes(v), `${rotulo} é inválido.`);

/** Máscara é só conveniência de digitação: no banco o documento entra em dígitos. */
export const documento = (rotulo = 'CPF / CNPJ') =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
    .refine(
      (v) => !v || v.length === 11 || v.length === 14,
      `${rotulo} deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).`,
    );

export const email = () =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : v),
    z.string().email('E-mail inválido.').optional(),
  );

/** Checkbox que manda "1"/"0" (ver Check em src/ui/form.tsx). */
export const booleano = () =>
  z
    .union([z.literal('0'), z.literal('1')])
    .default('0')
    .transform((v) => v === '1');

/** Inverso de `decimal`: valor do banco para o value de um input em pt-BR. */
export function paraCampo(valor: { toString(): string } | null | undefined): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  return valor.toString().replace('.', ',');
}

export function paraOptions<T>(items: T[], rotulo: (item: T) => string, valor: (item: T) => string) {
  return items.map((item) => ({ value: valor(item), label: rotulo(item) }));
}
