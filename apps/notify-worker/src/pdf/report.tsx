import { Document, Page, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type { FindingSeverity } from '@vunvault/contracts';
import type { ReportView } from '../ports';
import { COLORS, styles } from './theme';

/**
 * The released scan-report PDF (Task 90) — planner-authored layout; the portal
 * renders the interactive version and this document is the printable record.
 *
 * Findings are ordered by severity (critical first) and the counts line is
 * derived from the rows — never a stored number that could disagree with them.
 * Evidence is not printed: the scan worker already redacts it, and the report
 * PDF is a client-facing summary, not a payload dump.
 */

const SEVERITY_ORDER: readonly FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

export function sortFindings(report: ReportView): ReportView['findings'] {
  return [...report.findings].sort((a, b) => {
    const rank = (severity: FindingSeverity): number => {
      const index = SEVERITY_ORDER.indexOf(severity);
      return index === -1 ? SEVERITY_ORDER.length : index;
    };
    return rank(a.severity) - rank(b.severity) || a.title.localeCompare(b.title);
  });
}

export function severityCounts(report: ReportView): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of report.findings) counts[finding.severity] += 1;
  return counts;
}

/** Remediation guidance is clipped so one long note cannot orphan the table. */
const REMEDIATION_CLIP = 300;

function clip(value: string): string {
  return value.length > REMEDIATION_CLIP ? `${value.slice(0, REMEDIATION_CLIP - 1)}…` : value;
}

function isoDate(at: Date | null): string {
  return at === null ? '—' : at.toISOString().slice(0, 10);
}

export interface ReportDocumentProps {
  report: ReportView;
  /** ISO date the worker rendered the document; printed in the footer. */
  generatedAt: string;
}

export function ReportDocument({
  report,
  generatedAt,
}: ReportDocumentProps): ReactElement<DocumentProps> {
  const findings = sortFindings(report);
  const counts = severityCounts(report);
  const jobCode = report.jobCode ?? report.id;

  return (
    <Document
      title={`Scan report ${jobCode}`}
      author="VUNVAULT Ltd"
      subject={`Scan report ${jobCode} — ${report.targetHost}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} fixed>
          <Text style={styles.wordmark}>VUNVAULT</Text>
          <Text style={styles.headerMeta}>SCAN REPORT {jobCode}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Assessment</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Target</Text>
            <Text style={styles.metaValue}>{report.targetHost}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Type</Text>
            <Text style={styles.metaValue}>{report.scanType}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{report.status}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Released</Text>
            <Text style={styles.metaValue}>{isoDate(report.releasedAt)}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: 700 }}>
              Findings: {report.findings.length} (critical {counts.critical}, high {counts.high},
              medium {counts.medium}, low {counts.low})
            </Text>
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.sectionTitle, styles.colSev, { marginBottom: 0 }]}>Severity</Text>
            <Text style={[styles.sectionTitle, styles.colTitle, { marginBottom: 0 }]}>Finding</Text>
            <Text style={[styles.sectionTitle, styles.colCwe, { marginBottom: 0 }]}>CWE</Text>
            <Text style={[styles.sectionTitle, styles.colCvss, { marginBottom: 0 }]}>CVSS</Text>
            <Text style={[styles.sectionTitle, styles.colStatus, { marginBottom: 0 }]}>Status</Text>
          </View>

          {findings.map((finding, index) => (
            <View style={styles.tableRow} key={`${finding.title}-${index}`}>
              <Text style={[styles.colSev, { color: COLORS.ink, fontWeight: 700 }]}>
                {finding.severity}
              </Text>
              <Text style={styles.colTitle}>{finding.title}</Text>
              <Text style={styles.colCwe}>{finding.cwe ?? '—'}</Text>
              <Text style={styles.colCvss}>{finding.cvss ?? '—'}</Text>
              <Text style={styles.colStatus}>{finding.status}</Text>
            </View>
          ))}

          {findings.some((finding) => finding.remediationGuidance !== null) ? (
            <View style={styles.remediationBlock} wrap={false}>
              <Text style={styles.sectionTitle}>Remediation</Text>
              {findings.map((finding, index) =>
                finding.remediationGuidance === null ? null : (
                  <View style={styles.remediationItem} key={`rem-${finding.title}-${index}`}>
                    <Text style={styles.remediationTitle}>
                      {finding.severity} · {finding.title}
                    </Text>
                    <Text style={styles.remediationText}>{clip(finding.remediationGuidance)}</Text>
                  </View>
                ),
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text>VUNVAULT Ltd · Report {jobCode}</Text>
          <Text>Generated {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
