// Every page's URL in one place
export const PATHS = {
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvitation: '/accept-invitation',
  dashboard: '/dashboard',
  accounts: '/account-provision',
  inventory: '/inventory',
  sales: '/sales',
  purchases: '/purchases',
  catalog: '/category-product',
  transfers: '/stock-transfers',
  damaged: '/damaged',
  expenses: '/expenses',
  reports: '/reports',
  salesReport: '/reports/sales',
  inventoryReport: '/reports/inventory',
  financialReport: '/reports/financial',
  procurementReport: '/reports/procurement',
  userReports: '/reports/user',
  auditLogs: '/audit-logs',
  branches: '/branches',
  policy: '/policy',
  notifications: '/notifications',
  aiAssistance: '/ai-assistance'
}

// RBAC: the API sends each user's allowed `sections` (keys of PATHS); the first is their home page
export const canOpen = (user, section) => {
  if (!user) return false
  if (section === 'aiAssistance') return true
  if (section === 'userReports') {
    return user?.role === 'owner' || Boolean(user?.sections?.includes('userReports'))
  }
  return Boolean(user?.sections?.includes(section))
}
export const homePathFor = (user) => PATHS[user?.homeSection] || PATHS.login
