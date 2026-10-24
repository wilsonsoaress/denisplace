import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { gerarCobranca, type ResultadoGeracao } from '@/server/cobranca/gerar';
import { competencia as toCompetencia, hoje } from '@/domain/dates';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6390';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const FILA_COBRANCA = 'cobranca';

export const queue = new Queue<{ competencia: string }>(FILA_COBRANCA, { connection });

/** Competencia cobrada no mes: a do proprio dia 1, quando o job roda. */
export function competenciaDoDia(hojeISO = hoje()): string {
  return toCompetencia(hojeISO);
}

/**
 * Worker do job mensal. O padrao de execucao e repeatable com jobId fixo na
 * competencia, para dois disparos no mesmo mes nao gerarem cobranca dobrada —
 * alem do unique(contratoId, competencia) no banco, que e a garantia real.
 */
export function startWorker(): Worker<{ competencia: string }, ResultadoGeracao> {
  const worker = new Worker<{ competencia: string }, ResultadoGeracao>(
    FILA_COBRANCA,
    async (job) => {
      const resultado = await gerarCobranca(job.data.competencia);
      console.log(
        `[cobranca] ${resultado.competencia}: ${resultado.criadas} criadas, ${resultado.jaExistiam} ja existiam, ${resultado.puladas.length} puladas`,
      );
      return resultado;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    // Falha em silencio no job de cobranca vira inadimplencia invisivel.
    console.error(`[cobranca] FALHA ${job?.data ? JSON.stringify(job.data) : 'desconhecida'}`, err.message);
  });

  return worker;
}

async function main() {
  await queue.add(
    'mensal',
    { competencia: competenciaDoDia() },
    {
      jobId: `cobranca:${competenciaDoDia()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  );
  console.log(`[worker] fila "${FILA_COBRANCA}" pronta, competencia ${competenciaDoDia()}`);
  startWorker();
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
