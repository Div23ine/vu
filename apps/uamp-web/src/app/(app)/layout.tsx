import { requireUampSession } from '../../lib/session';
import { AppShell } from '../../components/app-shell';

export default async function UampLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUampSession();
  return <AppShell userName={user.fullName ?? user.email}>{children}</AppShell>;
}