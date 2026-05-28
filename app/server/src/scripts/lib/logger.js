// ── Report Building ─────────────────────────────────────────────────────────

/** Build a report object from findings array. */
export function buildReport(findings, mode = 'report') {
  const byType = {};
  const bySeverity = { info: 0, warning: 0, error: 0 };
  let fixable = 0;
  let fixed = 0;

  for (const f of findings) {
    const typeKey = f.type;
    byType[typeKey] = (byType[typeKey] || 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    if (f.type !== 'staleAccount' && f.type !== 'duplicateImage') fixable++;
    if (f.fixed) fixed++;
  }

  return {
    version: '6.3.0',
    timestamp: new Date().toISOString(),
    mode,
    summary: {
      totalFindings: findings.length,
      byType,
      bySeverity,
      fixable,
      fixed,
    },
    findings,
  };
}

// ── Text Report Formatter ──────────────────────────────────────────────────

export function formatTextReport(report) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  WORBI Maintenance Report');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`  Version:  ${report.version}`);
  lines.push(`  Time:     ${report.timestamp}`);
  lines.push(`  Mode:     ${report.mode}`);
  lines.push('');
  lines.push(`  Total Findings: ${report.summary.totalFindings}`);
  lines.push(`  Fixable:        ${report.summary.fixable}`);
  lines.push(`  Fixed:          ${report.summary.fixed}`);
  lines.push('');
  lines.push(`  By Severity: info=${report.summary.bySeverity.info} warning=${report.summary.bySeverity.warning} error=${report.summary.bySeverity.error}`);
  lines.push('');

  if (report.summary.byType) {
    lines.push('  By Type:');
    for (const [type, count] of Object.entries(report.summary.byType)) {
      lines.push(`    ${type}: ${count}`);
    }
    lines.push('');
  }

  if (report.findings.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('  Findings');
    lines.push('───────────────────────────────────────────────────────────');
    for (const f of report.findings) {
      const status = f.fixed ? '[FIXED]' : '[  ]';
      lines.push(`  ${status} [${f.severity.toUpperCase()}] ${f.type} (${f.user})`);
      lines.push(`    ${f.path}`);
      lines.push(`    ${f.detail}`);
      lines.push('');
    }
  }

  lines.push('═══════════════════════════════════════════════════════════');
  return lines.join('\n');
}

// ── JSON Report Formatter ──────────────────────────────────────────────────

export function formatJsonReport(report) {
  return JSON.stringify(report, null, 2);
}