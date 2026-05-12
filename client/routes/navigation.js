import {
  LayoutDashboard,
  UserCog,
  Package,
  ShoppingCart,
  PackageCheck,
  ArrowLeftRight,
  PackageX,
  Wallet,
  BarChart3,
  FileText,
  Building2,
  Settings,
  Sparkles,
  Users,
  TrendingUp,
  Boxes,
  Landmark,
  Truck,
  Tags
} from 'lucide-react'
import { PATHS } from './paths'

// Sidebar groups and links. `section` is checked against the user's role; `badge` names a count the layout fills in.
export const NAV_GROUPS = [
  {
    title: 'MAIN MENU',
    items: [
      { section: 'dashboard', path: PATHS.dashboard, label: 'Dashboard', icon: LayoutDashboard },
      { section: 'accounts', path: PATHS.accounts, label: 'Account Provision', icon: UserCog },
      { section: 'inventory', path: PATHS.inventory, label: 'Inventory', icon: Package, badge: 'inventoryAlerts' },
      { section: 'sales', path: PATHS.sales, label: 'Sales', icon: ShoppingCart }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { section: 'purchases', path: PATHS.purchases, label: 'Purchase', icon: PackageCheck },
      { section: 'catalog', path: PATHS.catalog, label: 'Category & Product', icon: Tags },
      { section: 'transfers', path: PATHS.transfers, label: 'Stock Transfers', icon: ArrowLeftRight },
      { section: 'damaged', path: PATHS.damaged, label: 'Damaged', icon: PackageX },
      { section: 'expenses', path: PATHS.expenses, label: 'Expenses', icon: Wallet }
    ]
  },
  {
    title: 'ANALYTICS & AUDIT',
    items: [
      {
        section: 'reports',
        path: PATHS.reports,
        label: 'Reports',
        icon: BarChart3,
        children: [
          { section: 'salesReport', path: PATHS.salesReport, label: 'Sales Report', icon: TrendingUp },
          { section: 'inventoryReport', path: PATHS.inventoryReport, label: 'Inventory Report', icon: Boxes },
          { section: 'financialReport', path: PATHS.financialReport, label: 'Financial Report', icon: Landmark },
          { section: 'procurementReport', path: PATHS.procurementReport, label: 'Procurement Report', icon: Truck },
          { section: 'userReports', path: PATHS.userReports, label: 'User Report', icon: Users }
        ]
      },
      { section: 'auditLogs', path: PATHS.auditLogs, label: 'Audit Logs', icon: FileText }
    ]
  },
  {
    title: 'AI ASSISTANCE',
    items: [
      { section: 'aiAssistance', path: PATHS.aiAssistance, label: 'AI Assistance', icon: Sparkles }
    ]
  },
  {
    title: 'CONFIGURATION',
    items: [
      { section: 'branches', path: PATHS.branches, label: 'Branches', icon: Building2, badge: 'branchCount' },
      { section: 'policy', path: PATHS.policy, label: 'Settings', icon: Settings }
    ]
  }
]
