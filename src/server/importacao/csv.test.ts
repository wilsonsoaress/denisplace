import { describe, expect, it } from 'vitest';
import {
  booleano,
  competencia,
  data,
  decodificar,
  decimal,
  escreverCsv,
  enumBr,
  inteiro,
  lerCsv,
  normalizarChave,
  type Linha,
} from './csv';
import { inconsistenciaDoGrupo, lerLinhaCobranca, lerLinhaContrato } from './planilha';

function linhaDe(cabecalho: string, linha: string): Linha {
  const csv = lerCsv(`${cabecalho}\n${linha}`);
  const primeira = csv.linhas[0];
  if (primeira) return primeira;
  // Linha toda em branco não entra no csv: o teste quer a coluna vazia, não um erro do helper.
  const valores: Record<string, string> = {};
  for (const coluna of csv.colunas) valores[coluna] = '';
  return { numero: 2, valores };
}

describe('lerCsv', () => {
  it('lê CSV brasileiro com ; e converte o cabeçalho em chaves canônicas', () => {
    const csv = lerCsv(
      'Nº do Contrato;Cliente;CPF/CNPJ;Valor Cobrado\r\n9001;"Silva, Costa";123.456.789-01;"1.234,56"\r\n',
    );
    expect(csv.colunas).toEqual(['numero', 'cliente_nome', 'cliente_documento', 'valor_cobrado']);
    expect(csv.linhas[0]?.valores).toEqual({
      numero: '9001',
      cliente_nome: 'Silva, Costa',
      cliente_documento: '123.456.789-01',
      valor_cobrado: '1.234,56',
    });
  });

  it('prefere vírgula quando o cabeçalho não tem ponto e vírgula', () => {
    const csv = lerCsv('numero,valor\n1,"10,00"\n');
    expect(csv.colunas).toEqual(['numero', 'valor_cobrado']);
    expect(csv.linhas[0]?.valores['valor_cobrado']).toBe('10,00');
  });

  it('preserva aspas duplas escapadas e rejeita linha com colunas a menos', () => {
    const csv = lerCsv('numero;observacoes\n1;"bloco ""A"""\n2\n');
    expect(csv.linhas[0]?.valores['observacoes']).toBe('bloco "A"');
    expect(csv.erros[0]).toEqual({ campo: '_', motivo: 'Tem 1 colunas, o cabeçalho tem 2.', linha: 3 });
  });

  it('tolera BOM e cai para ISO-8859-1 quando o arquivo não é UTF-8', () => {
    expect(lerCsv('\uFEFFnumero;condominio_nome\n1;Vila\n').colunas).toEqual(['numero', 'condominio_nome']);
    const latin1 = Buffer.from('condominio_nome;cidade\r\nItália;São Paulo\r\n', 'latin1');
    const texto = decodificar(latin1);
    expect(texto).toContain('Itália');
    expect(texto).toContain('São Paulo');
  });

  it('normaliza o cabeçalho sem acento, caixa e separadores', () => {
    expect(normalizarChave(' Data de Emissão ')).toBe('data_de_emissao');
  });
});

describe('coerção dos valores da planilha', () => {
  const linha = linhaDe('valor;data;mes;flag;tipo;dia', 'R$ 1.234,56;05/11/2025;11/2025;Não;pessoa física;10');

  it('lê dinheiro com ponto de milhar e vírgula decimal', () => {
    expect(decimal(linha, 'valor_cobrado', 'Valor')).toEqual({ ok: true, valor: '1234.56' });
    expect(decimal(linhaDe('v', ''), 'v', 'Valor').ok).toBe(false);
    expect(decimal(linhaDe('v', '-10,00'), 'v', 'Valor').ok).toBe(false);
  });

  it('aceita data brasileira e ISO, e recusa o resto', () => {
    expect(data(linha, 'data', 'Data')).toEqual({ ok: true, valor: '2025-11-05' });
    expect(data(linhaDe('d', '2025-11-05'), 'd', 'Data')).toEqual({ ok: true, valor: '2025-11-05' });
    expect(data(linhaDe('d', '11/05'), 'd', 'Data').ok).toBe(false);
  });

  it('recusa data que não existe no calendário', () => {
    expect(data(linhaDe('d', '31/02/2025'), 'd', 'Data').ok).toBe(false);
    expect(data(linhaDe('d', '13/13/2025'), 'd', 'Data').ok).toBe(false);
    expect(data(linhaDe('d', '2025-02-30'), 'd', 'Data').ok).toBe(false);
    expect(data(linhaDe('d', '29/02/2024'), 'd', 'Data')).toEqual({ ok: true, valor: '2024-02-29' });
  });

  it('transforma qualquer escrita do mês em competência', () => {
    expect(competencia(linha, 'competencia', 'Competência')).toEqual({ ok: true, valor: '2025-11-01' });
    expect(competencia(linhaDe('c', '2025-11-15'), 'c', 'Competência')).toEqual({ ok: true, valor: '2025-11-01' });
    expect(competencia(linhaDe('c', '2025'), 'c', 'Competência').ok).toBe(false);
  });

  it('recusa competência fora de 1-12 em vez de gravar mês inexistente', () => {
    expect(competencia(linhaDe('c', '13/2025'), 'c', 'Competência').ok).toBe(false);
    expect(competencia(linhaDe('c', '0/2025'), 'c', 'Competência').ok).toBe(false);
    expect(competencia(linhaDe('c', '2025-13-01'), 'c', 'Competência').ok).toBe(false);
  });

  it('entende sim/não e reclama de valor que não é opção', () => {
    expect(booleano(linha, 'flag')).toEqual({ ok: true, valor: false });
    expect(booleano(linhaDe('f', 'SIM'), 'f')).toEqual({ ok: true, valor: true });
    expect(booleano(linhaDe('f', 'talvez'), 'f').ok).toBe(false);
  });

  it('casa enum sem acento, sem caixa e pelo nome por extenso', () => {
    const sinonimos = { pessoa_fisica: 'PF', pessoa_juridica: 'PJ' };
    expect(enumBr(linha, 'tipo', 'Tipo', ['PF', 'PJ'] as const, sinonimos)).toEqual({ ok: true, valor: 'PF' });
    expect(enumBr(linhaDe('t', 'PJ'), 't', 'Tipo', ['PF', 'PJ'] as const)).toEqual({ ok: true, valor: 'PJ' });
  });

  it('limita o dia de vencimento ao calendário', () => {
    expect(inteiro(linha, 'dia', 'Dia de vencimento', 1, 31)).toEqual({ ok: true, valor: 10 });
    expect(inteiro(linhaDe('x', '40'), 'x', 'Dia', 1, 31).ok).toBe(false);
  });
});

describe('validação das linhas da planilha', () => {
  it('aceita um contrato por unidade completo', () => {
    const lido = lerLinhaContrato(
      linhaDe(
        'numero;cliente_nome;condominio_nome;condominio_cidade;unidade_codigo;escopo;item_nome;preco;inicio',
        '9002;Maria;Exemplo;São Paulo;Apto 101;unidade;Manutenção mensal;120,00;01/11/2025',
      ),
    );
    expect(lido.erros).toEqual([]);
    expect(lido.dados?.vencimentoDia).toBe(5);
    expect(lido.dados?.quantidade).toBe('1');
    expect(lido.dados?.status).toBe('VIGENTE');
  });

  it('exige cidade junto do condomínio e documento com tamanho certo', () => {
    const lido = lerLinhaContrato(
      linhaDe(
        'numero;cliente_nome;cliente_documento;condominio_nome;condominio_cidade;escopo;item_nome;preco;inicio',
        '1;Ana;123;Aurora;;CONDOMINIO;Aluguel;100,00;01/11/2025',
      ),
    );
    expect(lido.erros.map((e) => e.campo).sort()).toEqual(['cliente_documento', 'condominio_cidade']);
  });

  it('bloqueia pago sem data e isento pago na mesma linha', () => {
    const semData = lerLinhaCobranca(
      linhaDe('numero;competencia;valor_cobrado;esta_pago', '1;11/2025;100,00;sim'),
    );
    expect(semData.erros).toEqual([
      { campo: 'pago_em', motivo: 'Pagamento sem data é bloqueado: informe quando foi pago.' },
    ]);

    const doisEstados = lerLinhaCobranca(
      linhaDe('numero;competencia;valor_cobrado;esta_pago;pago_em;isento', '1;11/2025;100,00;sim;05/11/2025;sim'),
    );
    expect(doisEstados.erros.map((e) => e.campo)).toEqual(['isento']);
  });

  it('aponta divergência entre linhas do mesmo contrato', () => {
    const base = lerLinhaContrato(
      linhaDe('numero;cliente_nome;escopo;inicio;item_nome;preco;condominio_nome;condominio_cidade', '1;Ana;CONDOMINIO;01/11/2025;Aluguel;100,00;Aurora;São Paulo'),
    ).dados;
    const outra = lerLinhaContrato(
      linhaDe('numero;cliente_nome;escopo;inicio;item_nome;preco;condominio_nome;condominio_cidade', '1;Ana;UNIDADE;01/11/2025;Manutenção;50,00;Aurora;São Paulo'),
    ).dados;
    expect(base).not.toBeNull();
    expect(outra).not.toBeNull();
    expect(inconsistenciaDoGrupo(base as never, outra as never)).toContain('divergem em escopo');
  });
});

describe('escreverCsv', () => {
  it('grava no formato que o Excel abre sem importar coluna quebrada', () => {
    const saida = escreverCsv(['campo', 'motivo'], [['data', 'não é "válido"; revise']]);
    expect(saida).toBe('campo;motivo\r\ndata;"não é ""válido""; revise"\r\n');
  });
});
