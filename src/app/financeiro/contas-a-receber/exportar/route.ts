import { hoje } from '@/domain/dates';
import { csvDasLinhas, lerFiltros, linhasDosTitulos } from '../dados';

/**
 * CSV com os filtros da URL: o arquivo precisa conter as mesmas linhas da tela,
 * inclusive o saldo já com multa e juros, para servir de cobrança anexa.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filtros = lerFiltros(Object.fromEntries(url.searchParams.entries()));
  const linhas = await linhasDosTitulos(filtros);
  const nome = `contas-a-receber-${hoje()}.csv`;

  return new Response(csvDasLinhas(linhas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
