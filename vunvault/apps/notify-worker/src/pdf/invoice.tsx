import { Document, Page, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { formatUsd } from '@vunvault/lib/money';
import type { InvoiceView } from '../ports';
import { COLORS, styles } from './theme';

/**
 * The invoice PDF (Task 90) — planner-authored layout; no prototype exists.
 *
 * Design constraints honoured here: brand blue on ink dark for the header bar,
 * every amount in USD (the platform's only settlement currency — the schema
 * checks it), cents rendered through the shared `formatUsd` formatter so the
 * PDF and the portal can never disagree about a number.
 */

function isoDate(at: Date | null): string {
  return at === null ? '—' : at.toISOString().slice(0, 10);
}

export interface InvoiceDocumentProps {
  invoice: InvoiceView;
  /** ISO date the worker rendered the document; printed in the footer. */
  generatedAt: string;
}

export function InvoiceDocument({ invoice, generatedAt }: InvoiceDocumentProps): ReactElement<DocumentProps> {
  const totalCents = invoice.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitUsdCents,
    0,
  );

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author="VUNVAULT Ltd"
      subject={`Invoice ${invoice.number} — ${invoice.title}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} fixed>
          <Text style={styles.wordmark}>VUNVAULT</Text>
          <Text style={styles.headerMeta}>INVOICE {invoice.number}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Invoice details</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Issued</Text>
            <Text style={styles.metaValue}>{isoDate(invoice.issuedAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Due</Text>
            <Text style={styles.metaValue}>{isoDate(invoice.dueAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{invoice.status}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>For</Text>
            <Text style={styles.metaValue}>{invoice.title}</Text>
          </View>
          {invoice.detail !== null && invoice.detail !== '' ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Detail</Text>
              <Text style={styles.metaValue}>{invoice.detail}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionTitle}>Bill to</Text>
            <Text style={{ fontWeight: 700, fontSize: 11 }}>{invoice.orgName}</Text>
            <Text style={{ color: COLORS.muted }}>Client code: {invoice.orgClientCode}</Text>
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.sectionTitle, styles.colDesc, { marginBottom: 0 }]}>
              Description
            </Text>
            <Text style={[styles.sectionTitle, styles.colQty, { marginBottom: 0 }]}>Qty</Text>
            <Text style={[styles.sectionTitle, styles.colUnit, { marginBottom: 0 }]}>Unit</Text>
            <Text style={[styles.sectionTitle, styles.colAmount, { marginBottom: 0 }]}>Amount</Text>
          </View>

          {invoice.lines.map((line, index) => (
            <View style={styles.tableRow} key={`${line.description}-${index}`}>
              <Text style={styles.colDesc}>{line.description}</Text>
              <Text style={styles.colQty}>{String(line.quantity)}</Text>
              <Text style={styles.colUnit}>{formatUsd(line.unitUsdCents)}</Text>
              <Text style={styles.colAmount}>{formatUsd(line.quantity * line.unitUsdCents)}</Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={[styles.colDesc, { fontWeight: 700 }]}>
              Total ({invoice.settlementCurrency})
            </Text>
            <Text style={styles.colQty} />
            <Text style={styles.colUnit} />
            <Text style={[styles.colAmount, { fontWeight: 700 }]}>{formatUsd(totalCents)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>VUNVAULT Ltd · Nairobi · Settlement currency USD</Text>
          <Text>Generated {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
