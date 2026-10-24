import { mkdir, writeFile } from 'node:fs/promises';
import { escreverCsv } from '../importacao/csv';
import { importarPlanilha, type Rejeicao } from '../importacao/importar';

/**
 * Importação da planilha atual do cliente (critério de aceite 1 da F1).
 *
 * Uso:
 *   npm run import:planilha -- --contratos=importacao/contratos.csv --dry-run
 *   npm run import:planilha -- --contratos=importacao/contratos.csv --cobrancas=importacao/cobrancas.csv
 *
 * Só existe relatório quando há rejeição, e o código de saída 2 avisa que a
 * planilha entrou incompleta: importar "mais ou menos" é como ninguém nota.
 */
function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.slice(2).find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

function rejeicoesParaCsv(rejeicoes: Rejeicao[]): string[][] {
  return rejeicoes.map((r) => [r.arquivo, String(r.linha), r.campo, r.motivo]);
}

async function main(): Promise<void> {
  const opcoes = {
    contratos: argumento('contratos'),
    cobrancas: argumento('cobrancas'),
    dryRun: process.argv.includes('--dry-run'),
  };
  if (!opcoes.contratos && !opcoes.cobrancas) {
    console.error('informe --contratos=<csv> e/ou --cobrancas=<csv>. Ex.: npm run import:planilha -- --contratos=importacao/contratos.csv --dry-run');
    process.exit(1);
  }

  const resumo = await importarPlanilha(opcoes);
  const { rejeicoes, ...contagem } = resumo;

  let relatorio: string | null = null;
  if (rejeicoes.length > 0) {
    await mkdir('importacao', { recursive: true });
    const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    relatorio = `importacao/rejeicoes-${carimbo}.csv`;
    await writeFile(relatorio, escreverCsv(['arquivo', 'linha', 'campo', 'motivo'], rejeicoesParaCsv(rejeicoes)));
  }

  console.log(JSON.stringify({ ...contagem, rejeicoes: rejeicoes.length, relatorio }, null, 2));
  for (const r of rejeicoes.slice(0, 20)) {
    console.error(`linha ${r.linha} (${r.arquivo}) ${r.campo}: ${r.motivo}`);
  }
  if (rejeicoes.length > 20) console.error(`... e mais ${rejeicoes.length - 20} rejeições no relatório.`);
  if (rejeicoes.length > 0 && !opcoes.dryRun) process.exitCode = 2;
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
