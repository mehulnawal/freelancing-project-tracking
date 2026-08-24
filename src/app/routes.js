import { BarChart3, Building2, CreditCard, FolderKanban, KeyRound, Settings, WalletCards } from 'lucide-react'

export const routeMeta = [
  { path: '/dashboard', title: 'Dashboard', description: 'A clear view of your freelance business.', icon: BarChart3, group: 'Workspace' },
  { path: '/monthly-tracking', title: 'Money Tracking', description: 'Your income, expenses and monthly cash flow.', icon: WalletCards, group: 'Workspace', shortTitle: 'Money' },
  { path: '/clients', title: 'Clients', description: 'Your client relationships and their work.', icon: Building2, group: 'Workspace' },
  { path: '/projects', title: 'Projects', description: 'Plan work and keep every payment in context.', icon: FolderKanban, group: 'Workspace' },
  { path: '/expenses', title: 'Expenses', description: 'Track one-time and recurring business costs.', icon: CreditCard, group: 'Workspace' },
  { path: '/credentials', title: 'Credentials', description: 'Secure project access details.', icon: KeyRound, group: 'Workspace' },
  { path: '/settings', title: 'Settings', description: 'Personalize your workspace.', icon: Settings, group: 'Settings' },
]
export const getRouteMeta = (pathname) => routeMeta.find((route) => pathname === route.path || pathname.startsWith(`${route.path}/`)) || routeMeta[0]