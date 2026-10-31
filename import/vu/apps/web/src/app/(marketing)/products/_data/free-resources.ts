/**
 * Free resources constants (Task 55b) — six community downloads, verbatim
 * from the prototype. The prototype's Download buttons carry no file URLs
 * (and none are published yet), so the buttons render disabled with the
 * catalogue's title; the shell's `download` command prints its lines but
 * likewise fetches nothing until the files exist.
 */

export interface FreeResource {
  /** Shell `download <id>` key (from the prototype's FREE map). */
  id: string;
  name: string;
  /** Name as the shell's `free` list prints it (prototype's FREE map). */
  shellName: string;
  description: string;
  tags: readonly string[];
  size: string;
  /** Prototype source path — printed by the shell, not fetched yet. */
  file: string;
  icon: 'terminal' | 'file-text' | 'shield' | 'activity' | 'clipboard-check' | 'rss';
}

// TODO(content): file URLs
export const FREE_RESOURCES: readonly FreeResource[] = [
  {
    id: 'cve-tracker',
    name: 'CVE Tracker CLI',
    shellName: 'CVE Tracker CLI',
    description:
      'Terminal utility that pulls the NVD feed, filters by vendor and ecosystem, and prints a prioritised patch queue for your estate.',
    tags: ['CLI', 'Python', 'NVD'],
    size: '2.4 MB · .zip',
    file: 'downloads/vv-cve-tracker-cli-v1.4.0.zip',
    icon: 'terminal',
  },
  {
    id: 'nmap-cheatsheet',
    name: 'Nmap Operator Cheatsheet',
    shellName: 'Nmap Operator Cheatsheet',
    description:
      'A twelve-page PDF of the scan flags, timing templates and evasion switches our assessors actually reach for during engagements.',
    tags: ['PDF', 'Recon', 'Reference'],
    size: '1.1 MB · .pdf',
    file: 'downloads/vunvault-nmap-cheatsheet.pdf',
    icon: 'file-text',
  },
  {
    id: 'hardening-baselines',
    name: 'Linux Hardening Baselines',
    shellName: 'Linux Hardening Baselines',
    description:
      'Idempotent shell scripts that apply CIS-aligned baselines to Ubuntu, Debian and RHEL hosts, with a dry-run mode and rollback manifest.',
    tags: ['Bash', 'CIS', 'Linux'],
    size: '380 KB · .tar.gz',
    file: 'downloads/vv-hardening-baselines.tar.gz',
    icon: 'shield',
  },
  {
    id: 'threat-feed',
    name: 'Threat Intel Feed',
    shellName: 'Threat Intel Feed (JSON)',
    description:
      'Machine-readable JSON feed of weaponised CVEs, active exploitation status and vendor advisory links — refreshed every fifteen minutes.',
    tags: ['JSON', 'API', 'Live'],
    size: 'External host · .json',
    file: 'https://feeds.vunvault.com/threat-intel.json',
    icon: 'activity',
  },
  {
    id: 'sacco-checklist',
    name: 'SACCO Compliance Checklist',
    shellName: 'SACCO Compliance Checklist',
    description:
      'A printable readiness checklist mapping Central Bank of Kenya and Data Protection Act obligations to concrete technical controls.',
    tags: ['PDF', 'CBK', 'Fintech'],
    size: '860 KB · .pdf',
    file: 'downloads/vv-sacco-compliance-checklist.pdf',
    icon: 'clipboard-check',
  },
  {
    id: 'zero-day-watch',
    name: 'Zero-Day Watch (RSS)',
    shellName: 'Zero-Day Watch (RSS)',
    description:
      'Subscribe in any feed reader to receive VUNVAULT’s zero-day bulletin the moment a critical vulnerability becomes weaponised in the wild.',
    tags: ['RSS', 'XML', 'Alerts'],
    size: 'External host · .xml',
    file: 'https://feeds.vunvault.com/zero-day-watch.xml',
    icon: 'rss',
  },
];

export const FREE_RESOURCES_FOOTNOTE =
  'Free resources are provided as-is for authorised testing only. Never scan systems you do not own or have written permission to assess.';

export const DOWNLOAD_BUTTON_TITLE = 'Download links are published when the file is released';
