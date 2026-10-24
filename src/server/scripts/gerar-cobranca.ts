import { gerarCobranca } from '../cobranca/gerar';
import { competencia as toCompetencia } from '@/domain/dates';

/**
 * Uso:
 *   npm run cobranca:gerar -- 2026-12-01
 *   npm run cobranca:gerar -- 2026-12-01 --dry-run
 *
 * Existe porque o financeiro precisa reprocessar uma competencia avulsa sem
 * esperar o agendamento, e porque e assim que se prova a idempotencia do job.
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const alvo = args.find((a) => /^\d{4}-\d{2}(-\d{2})?$/.test(a));

  if (!alvo) {
    console.error('informe a competencia: npm run cobranca:gerar -- 2026-12-01');
    process.exit(1);
  }

  const r = await gerarCobranca(toCompetencia(`${alvo}-01`.slice(0, 10)), { dryRun });
  console.log(
    JSON.stringify(
      {
        competencia: r.competencia,
        dryRun,
        criadas: r.criadas,
        jaExistiam: r.jaExistiam,
        puladas: r.puladas,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
