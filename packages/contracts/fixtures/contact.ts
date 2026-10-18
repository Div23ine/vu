import type { ClientDirectoryItem, ContactMessageView } from '../src/contact.js';
import { staffMembers } from './users.js';

/**
 * Admin contact-inbox and client-directory fixtures (Task 40f).
 *
 * Deterministic UUID v4-shaped ids; the reference "now" matches the roster
 * fixtures (2026-09-24T12:00:00Z). The triaged rows are assigned to real
 * roster members (derived from `staffMembers`, so the ids cannot drift), and
 * the directory's first row is the shared client profile (Jane Wanjiru,
 * Acme Fintech Ltd, VV-CL-48210).
 */

const lucy = staffMembers.find((member) => member.fullName === 'Lucy Achieng');
const amara = staffMembers.find((member) => member.fullName === 'Amara Njoroge');
if (lucy === undefined || amara === undefined) {
  throw new Error('The contact fixtures require Lucy Achieng and Amara Njoroge in the roster.');
}

export const contactMessages: ContactMessageView[] = [
  {
    id: 'c3000000-0000-4000-8000-0000000000c1',
    name: 'Wanjiru Kamau',
    email: 'wanjiru@example.test',
    organization: 'Example Media',
    category: 'journalist_blogger_profile_request',
    categoryLabel: 'Journalist / Blogger Profile Request',
    subject: 'Requesting the verified blogger badge',
    message:
      'I cover East African fintech security for Example Media and would like a verified contributor profile.',
    status: 'new',
    assignedTo: null,
    createdAt: '2026-09-24T09:12:00Z',
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000c2',
    name: 'Peter Otieno',
    email: 'p.otieno@saccoone.co.ke',
    organization: 'Sacco One Ltd',
    category: 'penetration_testing_request',
    categoryLabel: 'Penetration Testing Request',
    subject: 'Annual pentest for our member portal',
    message:
      'We need a full-scope assessment of our member portal and API gateway before the December audit.',
    status: 'triaged',
    assignedTo: { id: amara.id, label: amara.fullName },
    createdAt: '2026-09-23T15:40:00Z',
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000c3',
    name: 'Fatuma Ali',
    email: 'fatuma.ali@protonmail.com',
    organization: null,
    category: 'vulnerability_report',
    categoryLabel: 'Vulnerability / Bug Report',
    subject: 'Reflected parameter on a public page',
    message:
      'A query parameter on one of your public pages reflects into the response without encoding. Steps attached.',
    status: 'new',
    assignedTo: null,
    createdAt: '2026-09-23T08:05:00Z',
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000c4',
    name: 'Anonymous Source',
    email: 'source.7x2@securemail.test',
    organization: null,
    category: 'whistleblower_tip',
    categoryLabel: 'Whistleblower Tip',
    subject: 'Procurement irregularities',
    message:
      'Documents suggesting bid-rigging in a county ICT tender. I would like to know how your verification works.',
    status: 'closed',
    assignedTo: { id: lucy.id, label: lucy.fullName },
    createdAt: '2026-09-22T19:31:00Z',
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000c5',
    name: 'Grace Wambui',
    email: 'grace.wambui@acmefintech.co.ke',
    organization: 'Acme Fintech Ltd',
    category: 'general_support',
    categoryLabel: 'General Support',
    subject: 'Invoice receipt not arriving',
    message:
      'Our accounts team never received the PDF receipt for the last invoice. Could you resend it?',
    status: 'triaged',
    assignedTo: { id: lucy.id, label: lucy.fullName },
    createdAt: '2026-09-22T11:02:00Z',
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000c6',
    name: 'Daniel Mwangi',
    email: 'd.mwangi@harbourlogistics.test',
    organization: 'Harbour Logistics',
    category: 'penetration_testing_request',
    categoryLabel: 'Penetration Testing Request',
    subject: 'Scoping an assessment for our tracking platform',
    message:
      'We operate a fleet-tracking platform and want a scoped quote for an external assessment.',
    status: 'new',
    assignedTo: null,
    createdAt: '2026-09-21T07:44:00Z',
  },
];

export const clientDirectory: ClientDirectoryItem[] = [
  {
    // The shared client-profile fixture (fixtures/profile.ts).
    id: 'c0000000-0000-4000-8000-000000000011',
    fullName: 'Jane Wanjiru',
    email: 'jane.wanjiru@acmefintech.co.ke',
    company: 'Acme Fintech Ltd',
    clientCode: 'VV-CL-48210',
    verifiedBlogger: false,
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000d1',
    fullName: 'Peter Otieno',
    email: 'p.otieno@saccoone.co.ke',
    company: 'Sacco One Ltd',
    clientCode: 'VV-CL-51337',
    verifiedBlogger: true,
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000d2',
    fullName: 'Aisha Juma',
    email: 'aisha.juma@harbourlogistics.test',
    company: 'Harbour Logistics',
    clientCode: 'VV-CL-60122',
    verifiedBlogger: false,
  },
  {
    id: 'c3000000-0000-4000-8000-0000000000d3',
    fullName: 'Brian Kiptoo',
    email: 'brian.kiptoo@protonmail.com',
    company: null,
    clientCode: null,
    verifiedBlogger: false,
  },
];
