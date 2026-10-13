import { StyleSheet } from '@react-pdf/renderer';

/**
 * Shared PDF theme (Task 90).
 *
 * The only colours used are the platform's brand blue and ink dark from the
 * design tokens — no invented palette. Documents are A4, text-first, and
 * printable in grayscale without losing structure (the severity column carries
 * the word, not just a colour).
 */

export const COLORS = {
  brand: '#3B99FC',
  dark: '#0A0D12',
  ink: '#0A0D12',
  muted: '#55606E',
  line: '#D6DEE8',
  white: '#FFFFFF',
} as const;

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.ink,
    paddingTop: 0,
    paddingBottom: 42,
  },
  headerBar: {
    backgroundColor: COLORS.dark,
    paddingHorizontal: 36,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: {
    color: COLORS.white,
    fontSize: 16,
    letterSpacing: 3,
    fontWeight: 700,
  },
  headerMeta: {
    color: COLORS.brand,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: 'right',
  },
  body: {
    paddingHorizontal: 36,
    paddingTop: 22,
  },
  sectionTitle: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: COLORS.muted,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 90,
    color: COLORS.muted,
  },
  metaValue: {
    flex: 1,
    fontWeight: 600,
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.brand,
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
    paddingVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.dark,
    marginTop: 6,
    paddingTop: 6,
  },
  colDesc: { flex: 4, paddingRight: 8 },
  colQty: { flex: 1, textAlign: 'right', paddingRight: 8 },
  colUnit: { flex: 1.4, textAlign: 'right', paddingRight: 8 },
  colAmount: { flex: 1.6, textAlign: 'right' },
  colSev: { flex: 1.1, paddingRight: 6 },
  colTitle: { flex: 4, paddingRight: 6 },
  colCwe: { flex: 1.2, paddingRight: 6 },
  colCvss: { flex: 0.9, paddingRight: 6, textAlign: 'right' },
  colStatus: { flex: 1.2, textAlign: 'right' },
  footer: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 20,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.line,
    paddingTop: 6,
    fontSize: 7.5,
    color: COLORS.muted,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  remediationBlock: {
    marginTop: 14,
  },
  remediationItem: {
    marginBottom: 6,
  },
  remediationTitle: {
    fontWeight: 700,
    marginBottom: 1,
  },
  remediationText: {
    color: COLORS.muted,
  },
});
