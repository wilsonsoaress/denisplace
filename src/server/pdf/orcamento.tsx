import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type { CatalogoItem, Cliente, Condominio, DadosEmpresa, OrcamentoItem, Orcamento } from '@prisma/client';
import { D, brl, money } from '@/domain/money';
import { toISO } from '@/domain/dates';
import { ESCOPO_ITEM, STATUS_ORCAMENTO } from '@/lib/rotulos';

/**
 * PDF do orçamento comercial. Sem dependência de Chromium (puppeteer): o
 * @react-pdf/renderer desenha o PDF em Node puro, o que funciona tanto no
 * Docker da VPS quanto numa função serverless (Vercel), sem instalar
 * navegador nenhum.
 */

export type OrcamentoParaPdf = Orcamento & {
  cliente: Pick<Cliente, 'nome' | 'documento' | 'email' | 'telefone'>;
  condominio: Pick<Condominio, 'nome'> | null;
  itens: (OrcamentoItem & { catalogoItem: Pick<CatalogoItem, 'tipo'> })[];
};

const estilos = StyleSheet.create({
  pagina: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #cbd5e1' },
  logo: { width: 110, maxHeight: 60, objectFit: 'contain', marginBottom: 6 },
  empresaNome: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  empresaLinha: { fontSize: 8.5, color: '#475569' },
  tituloDoc: { fontSize: 16, fontWeight: 700, textAlign: 'right' },
  numeroDoc: { fontSize: 10, color: '#475569', textAlign: 'right', marginTop: 2 },
  statusChip: { fontSize: 8.5, color: '#1d4ed8', textAlign: 'right', marginTop: 4 },
  secao: { marginBottom: 14 },
  secaoTitulo: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 6, letterSpacing: 0.5 },
  linhaDados: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tabela: { marginTop: 4 },
  linhaTabela: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingVertical: 6 },
  cabecalhoTabela: { flexDirection: 'row', borderBottom: '1.5px solid #334155', paddingBottom: 6, marginBottom: 2 },
  colDescricao: { flex: 3 },
  colEscopo: { flex: 1.2 },
  colQtd: { flex: 0.8, textAlign: 'right' },
  colPreco: { flex: 1.2, textAlign: 'right' },
  colTotal: { flex: 1.2, textAlign: 'right' },
  th: { fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', color: '#475569' },
  totalLinha: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTop: '1.5px solid #334155' },
  totalRotulo: { fontSize: 10, fontWeight: 700, marginRight: 10 },
  totalValor: { fontSize: 13, fontWeight: 700 },
  rodape: { position: 'absolute', bottom: 28, left: 36, right: 36, borderTop: '1px solid #e2e8f0', paddingTop: 8 },
  rodapeTexto: { fontSize: 8, color: '#64748b' },
});

function totalItem(item: OrcamentoItem) {
  return money(D(item.quantidade).times(D(item.precoUnitario)));
}

function Cabecalho({ empresa }: { empresa: DadosEmpresa | null }) {
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.nome;
  return (
    <View style={estilos.linhaDados}>
      <View style={{ maxWidth: '60%' }}>
        {empresa?.logoUrl ? <Image src={empresa.logoUrl} style={estilos.logo} /> : null}
        {nomeEmpresa ? <Text style={estilos.empresaNome}>{nomeEmpresa}</Text> : null}
        {empresa?.cnpj ? <Text style={estilos.empresaLinha}>CNPJ {empresa.cnpj}</Text> : null}
        {empresa?.endereco || empresa?.cidade ? (
          <Text style={estilos.empresaLinha}>
            {[empresa?.endereco, empresa?.cidade && empresa?.uf ? `${empresa.cidade}/${empresa.uf}` : empresa?.cidade]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
        {empresa?.telefone || empresa?.email ? (
          <Text style={estilos.empresaLinha}>{[empresa?.telefone, empresa?.email].filter(Boolean).join(' · ')}</Text>
        ) : null}
        {empresa?.site ? <Text style={estilos.empresaLinha}>{empresa.site}</Text> : null}
      </View>
    </View>
  );
}

export function DocumentoOrcamento({ orcamento, empresa }: { orcamento: OrcamentoParaPdf; empresa: DadosEmpresa | null }) {
  const geradoEm = toISO(new Date()) ?? '';
  return (
    <Document title={`Orçamento ${orcamento.numero}`}>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.cabecalho}>
          <Cabecalho empresa={empresa} />
          <View>
            <Text style={estilos.tituloDoc}>ORÇAMENTO</Text>
            <Text style={estilos.numeroDoc}>Nº {String(orcamento.numero).padStart(5, '0')}</Text>
            <Text style={estilos.statusChip}>{STATUS_ORCAMENTO[orcamento.status]}</Text>
          </View>
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>Cliente</Text>
          <View style={estilos.linhaDados}>
            <Text>{orcamento.cliente.nome}</Text>
            <Text>{orcamento.condominio?.nome ?? ''}</Text>
          </View>
          {orcamento.cliente.documento ? <Text style={estilos.empresaLinha}>Documento: {orcamento.cliente.documento}</Text> : null}
          {orcamento.cliente.email || orcamento.cliente.telefone ? (
            <Text style={estilos.empresaLinha}>
              {[orcamento.cliente.email, orcamento.cliente.telefone].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>{orcamento.titulo}</Text>
          <View style={estilos.linhaDados}>
            <Text>Emitido em {toISO(orcamento.criadoEm)?.slice(0, 10)}</Text>
            <Text>Válido até {toISO(orcamento.validade)}</Text>
          </View>
          {orcamento.descricao ? <Text style={{ marginTop: 6 }}>{orcamento.descricao}</Text> : null}
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>Itens</Text>
          <View style={estilos.tabela}>
            <View style={estilos.cabecalhoTabela}>
              <Text style={[estilos.th, estilos.colDescricao]}>Item</Text>
              <Text style={[estilos.th, estilos.colEscopo]}>Condição</Text>
              <Text style={[estilos.th, estilos.colQtd]}>Qtd.</Text>
              <Text style={[estilos.th, estilos.colPreco]}>Preço un.</Text>
              <Text style={[estilos.th, estilos.colTotal]}>Total</Text>
            </View>
            {orcamento.itens.map((item) => (
              <View key={item.id} style={estilos.linhaTabela}>
                <Text style={estilos.colDescricao}>{item.descricao}</Text>
                <Text style={estilos.colEscopo}>
                  {ESCOPO_ITEM[item.escopo].toLowerCase()}
                  {item.escopo === 'RECORRENTE' ? ' /mês' : ''}
                </Text>
                <Text style={estilos.colQtd}>{item.quantidade.toString()}</Text>
                <Text style={estilos.colPreco}>{brl(item.precoUnitario)}</Text>
                <Text style={estilos.colTotal}>{brl(totalItem(item))}</Text>
              </View>
            ))}
          </View>
          <View style={estilos.totalLinha}>
            <Text style={estilos.totalRotulo}>TOTAL PREVISTO</Text>
            <Text style={estilos.totalValor}>{brl(orcamento.valorTotal)}</Text>
          </View>
        </View>

        <View style={estilos.rodape}>
          {empresa?.observacoesRodape ? <Text style={estilos.rodapeTexto}>{empresa.observacoesRodape}</Text> : null}
          <Text style={estilos.rodapeTexto}>
            Documento gerado em {geradoEm} · válido conforme condições comerciais vigentes.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Ponto único que chama o renderizador: o tipo de `renderToBuffer` exige um
 * ReactElement<DocumentProps> ao pé da letra, então o JSX fica aqui dentro do
 * próprio .tsx (evita o cast feio em quem só quer o Buffer do PDF).
 */
export async function gerarPdfOrcamento(input: { orcamento: OrcamentoParaPdf; empresa: DadosEmpresa | null }): Promise<Buffer> {
  const elemento = <DocumentoOrcamento orcamento={input.orcamento} empresa={input.empresa} />;
  // @react-pdf/renderer tipa renderToBuffer exigindo literalmente ReactElement<DocumentProps>;
  // um componente de fachada (DocumentoOrcamento) tem props proprias, nao as do <Document>,
  // mesmo renderizando um <Document> por dentro — o cast documenta essa divergência de tipos.
  return renderToBuffer(elemento as unknown as ReactElement<DocumentProps>);
}
