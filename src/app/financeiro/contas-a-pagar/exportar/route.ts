import { hoje } from '@/domain/dates';
import { csvDeContasPagar, lerFiltros, linhasDeContasPagar } from '../dados';

/** Mesma ideia do export de contas a receber: o CSV espelha exatamente a grade. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filtros = lerFiltros(Object.fromEntries(url.searchParams.entries()));
  const linhas = await linhasDeContasPagar(filtros);
  const nome = `contas-a-pagar-${hoje()}.csv`;

  return new Response(csvDeContasPagar(linhas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
