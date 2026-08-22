import { BarChart3, BriefcaseBusiness, Building2, CreditCard, FolderKanban, Landmark, Settings, ShieldCheck, WalletCards } from 'lucide-react'

export const routeMeta = [
  { path: '/dashboard', title: 'Dashboard', description: 'Your private workspace overview will take shape here.', icon: BarChart3, group: 'Overview' },
  { path: '/monthly-tracking', title: 'Monthly Tracking', description: 'Track your month with a clear, focused workspace.', icon: WalletCards, group: 'Overview', shortTitle: 'Monthly' },
  { path: '/clients', title: 'Clients', description: 'Keep every client relationship organized in one place.', icon: Building2, group: 'Work' },
  { path: '/projects', title: 'Projects', description: 'Manage project work, milestones and project finances.', icon: FolderKanban, group: 'Work' },
  { path: '/income', title: 'Income', description: 'A clear record of income will live here.', icon: Landmark, group: 'Finance' },
  { path: '/expenses', title: 'Expenses', description: 'Capture and review business expenses here.', icon: CreditCard, group: 'Finance' },
  { path: '/accounts', title: 'Accounts', description: 'View your linked business accounts in one secure place.', icon: BriefcaseBusiness, group: 'Finance' },
  { path: '/credentials', title: 'Credentials Vault', description: 'A private home for your work credentials.', icon: ShieldCheck, group: 'Secure' },
  { path: '/settings', title: 'Settings', description: 'Personalize your private workspace.', icon: Settings, group: 'Settings' },
]

export const getRouteMeta = (pathname) => routeMeta.find((route) => pathname === route.path || pathname.startsWith(`${route.path}/`)) || routeMeta[0]
