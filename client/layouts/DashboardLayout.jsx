import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Store, User } from 'lucide-react'
import { useBranchScope } from '../hooks'
import { NAV_GROUPS } from '../routes/navigation'
import { PATHS, canOpen } from '../routes/paths'
import { selectAuth, selectCurrentUser, sessionEnded } from '../features/auth/store/authSlice'
import { realtime, watchConnection } from '../api/realtime'
import { reportDeviceLocation } from '../api/sessionsApi'
import { STORAGE_KEYS, getPosition, readText, writeText } from '../utils'
import { refreshCurrentUser, signOut as signOutThunk, signOutAfterInactivity } from '../features/auth/store/authThunks'
import { loadBranches } from '../features/branches/store/branchesThunks'
import { loadProcurements, procurementPushed } from '../features/purchases/store/purchasesThunks'
import { loadPolicy, policyPushed } from '../features/policy/store/policyThunks'
import { loadTransfers, transferPushed } from '../features/transfers/store/transfersThunks'
import { loadSales, salePushed } from '../features/sales/store/salesThunks'
import { damagePushed, loadDamaged } from '../features/damaged/store/damagedThunks'
import { loadProducts, productsPushed } from '../features/inventory/store/productsThunks'
import { loadStock, stockPushed } from '../features/inventory/store/stockThunks'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { selectInventory } from '../features/inventory/store/selectors'

// Sidebar around every dashboard page
export default function DashboardLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(selectCurrentUser)
  const { storeName } = useSelector(selectSettings)
  const inventory = useSelector(selectInventory)
  const { branches, inScope } = useBranchScope()

  const location = useLocation()
  const [openSections, setOpenSections] = useState({})

  // Only the sections this role may open; groups left empty are hidden
  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => {
        const items = group.items
          .filter((item) => canOpen(user, item.section) || item.children?.some((child) => canOpen(user, child.section)))
          .map((item) => {
            if (item.children) {
              const allowedChildren = item.children.filter((child) => canOpen(user, child.section))
              return {
                ...item,
                children: allowedChildren
              }
            }
            return item
          })
        return { ...group, items }
      }).filter((group) => group.items.length),
    [user]
  )

  const isSectionOpen = (item) => {
    if (typeof openSections[item.section] === 'boolean') {
      return openSections[item.section]
    }
    return Boolean(
      item.children?.some((child) => location.pathname === child.path) ||
      (item.path && location.pathname.startsWith(item.path))
    )
  }

  const toggleSection = (sectionKey, item) => {
    const current = isSectionOpen(item)
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !current
    }))
  }

  // Check the saved session first, picking up role or branch changes the Owner made since this user signed in. A
  // session that ended meanwhile (e.g. signed out after inactivity while the browser was closed) gets one 401 and
  // goes to the login page, instead of every request below failing too. If the API can't be reached, carry on.
  const [sessionChecked, setSessionChecked] = useState(false)
  useEffect(() => {
    dispatch(refreshCurrentUser())
      .then(() => setSessionChecked(true))
      .catch((error) => {
        if (error.status !== 401) setSessionChecked(true)
      })
  }, [dispatch])

  // Then the branch list every page labels with, the records each page lists, and each branch's stock as the server
  // holds it; after that, changes arrive over the WebSocket (below)
  useEffect(() => {
    if (!sessionChecked) return
    dispatch(loadBranches()).catch(() => {})
    // The shared policy decides Low Stock and Expiring Soon on every page
    dispatch(loadPolicy()).catch(() => {})
    // The catalog first (with products new from paid orders), so stock batches find their products
    dispatch(loadProducts()).catch(() => {})
      .finally(() => dispatch(loadProcurements()).catch(() => {}))
      .finally(() => dispatch(loadStock()).catch(() => {}))
    dispatch(loadTransfers()).catch(() => {})
    dispatch(loadSales()).catch(() => {})
    dispatch(loadDamaged()).catch(() => {})
  }, [sessionChecked, dispatch])

  // Live updates per branch: stock (whatever moved it) and the procurement, transfer, sale and damage lists. Staff listen to their own branch; those who cover every branch (Owner,
  // Purchase Officer) to all of them. After a dropped connection, catch up once.
  const liveBranchIds = (user?.branchId === 'all' ? branches.map((b) => b.id) : [user?.branchId]).filter(Boolean).join(' ')
  useEffect(() => {
    const echo = realtime()
    if (!sessionChecked || !echo || !liveBranchIds) return undefined
    const channels = []
    for (const id of liveBranchIds.split(' ')) {
      echo.private(`branch.${id}.procurements`).listen('.procurement.changed', (event) => dispatch(procurementPushed(event.procurement)))
      echo.private(`branch.${id}.transfers`).listen('.transfer.changed', (event) => dispatch(transferPushed(event.transfer)))
      echo.private(`branch.${id}.sales`).listen('.sale.recorded', (event) => dispatch(salePushed(event.sale)))
      echo.private(`branch.${id}.damaged`).listen('.damage.recorded', (event) => dispatch(damagePushed(event.damagedItem)))
      echo.private(`branch.${id}.stock`).listen('.stock.changed', (event) => dispatch(stockPushed(event.batches)))
      channels.push(`branch.${id}.procurements`, `branch.${id}.transfers`, `branch.${id}.sales`, `branch.${id}.damaged`, `branch.${id}.stock`)
    }
    // The policy is shared by every branch; branch changes (added, renamed, deactivated, deleted) reach everyone too
    echo.private('policy').listen('.policy.changed', (event) => dispatch(policyPushed(event.policy)))
    echo.private('branches').listen('.branches.changed', () => dispatch(loadBranches()).catch(() => {}))
    // Product prices (set when stock is added or edited) are shared by every branch
    echo.private('products').listen('.products.changed', () => dispatch(productsPushed()))
    channels.push('policy', 'branches', 'products')
    let wasConnected = null
    const stopWatching = watchConnection((connected) => {
      if (connected && wasConnected === false) {
        dispatch(loadPolicy()).catch(() => {})
        dispatch(loadBranches()).catch(() => {})
        dispatch(loadProducts()).catch(() => {})
          .finally(() => dispatch(loadProcurements()).catch(() => {}))
          .finally(() => dispatch(loadStock()).catch(() => {}))
        dispatch(loadTransfers()).catch(() => {})
        dispatch(loadSales()).catch(() => {})
        dispatch(loadDamaged()).catch(() => {})
      }
      wasConnected = connected
    })
    return () => {
      channels.forEach((channel) => echo.leave(channel))
      stopWatching()
    }
  }, [sessionChecked, liveBranchIds, dispatch])

  // Signed out the moment this session is ended elsewhere (the Owner, deactivation, password reset),
  // pushed over the WebSocket; the token's id is the part before "|"
  const { token } = useSelector(selectAuth)
  const sessionId = token?.split('|')[0]
  useEffect(() => {
    const echo = realtime()
    if (!sessionChecked || !echo || !sessionId) return undefined
    const channel = `session.${sessionId}`
    echo.private(channel).listen('.session.ended', (event) => dispatch(sessionEnded(event.reason)))
    return () => echo.leave(channel)
  }, [sessionChecked, dispatch, sessionId])

  // Once per sign-in, ask the browser where it is so the Owner sees a precise place
  // (e.g. "Addis Ababa, Bole, Ethiopia"); if the person blocks it, the IP's city is used instead
  const askDeviceLocation = Boolean(user?.askDeviceLocation)
  useEffect(() => {
    if (!askDeviceLocation || !sessionId) return
    if (readText(STORAGE_KEYS.locationAsked) === sessionId) return
    writeText(STORAGE_KEYS.locationAsked, sessionId)
    getPosition()
      .then(reportDeviceLocation)
      .catch(() => {}) // blocked or unavailable: keep the IP-based city
  }, [askDeviceLocation, sessionId])

  // Real use (clicks, typing, scrolling) drives two things:
  //  - every 2 minutes of use, check in with the API, so the Owner sees accurate "last active"
  //  - no use in any tab for the session timeout (server setting): sign out automatically
  const timeoutMinutes = user?.sessionTimeoutMinutes || 0
  useEffect(() => {
    let usedSinceLastCheck = false
    let lastSaved = 0
    const markUsed = () => {
      usedSinceLastCheck = true
      const now = Date.now()
      // Shared by every tab of this browser; saved at most every 10 seconds
      if (now - lastSaved > 10000) {
        lastSaved = now
        writeText(STORAGE_KEYS.lastActivity, String(now))
      }
    }
    markUsed() // opening or reloading a page counts as use
    const events = ['pointerdown', 'keydown', 'scroll']
    events.forEach((name) => window.addEventListener(name, markUsed, { passive: true }))

    const checkIn = setInterval(() => {
      if (!usedSinceLastCheck) return
      usedSinceLastCheck = false
      dispatch(refreshCurrentUser()).catch(() => {})
    }, 120000)

    const idleCheck = timeoutMinutes
      ? setInterval(() => {
          const lastUsed = Number(readText(STORAGE_KEYS.lastActivity)) || Date.now()
          if (Date.now() - lastUsed >= timeoutMinutes * 60000) dispatch(signOutAfterInactivity())
        }, 15000)
      : null

    return () => {
      clearInterval(checkIn)
      if (idleCheck) clearInterval(idleCheck)
      events.forEach((name) => window.removeEventListener(name, markUsed))
    }
  }, [dispatch, timeoutMinutes])

  const badges = useMemo(() => {
    const scoped = inventory.filter((i) => inScope(i.branchId))
    return {
      // Low or out-of-stock products (once each, whatever their batches) plus batches expiring soon
      inventoryAlerts: new Set(scoped.filter((i) => i.status !== 'In Stock').map((i) => `${i.medId}-${i.branchId}`)).size + scoped.filter((i) => i.expiringSoon).length,
      branchCount: branches.length
    }
  }, [inventory, inScope, branches])

  const signOut = async () => {
    await dispatch(signOutThunk())
    navigate(PATHS.login, { replace: true })
  }

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon-wrapper">
            <Store size={22} />
          </div>
          <div className="brand-title-wrap">
            <span className="logo-text">{storeName}</span>
            <span className="brand-subtitle">Multi-Branch Inventory</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, index) => (
            <div key={group.title}>
              <div className="nav-group-title" style={index ? { marginTop: '1.2rem' } : undefined}>{group.title}</div>
              {group.items.map((item) => {
                const { path, label, icon: Icon, badge, children } = item
                const hasChildren = Boolean(children && children.length > 0)

                if (hasChildren) {
                  const isOpen = isSectionOpen(item)
                  const isAnyChildActive = children.some((child) => location.pathname === child.path)

                  return (
                    <div key={item.section} className="nav-collapsible-wrapper">
                      <button
                        type="button"
                        onClick={() => toggleSection(item.section, item)}
                        className={`nav-item nav-collapsible-trigger ${isAnyChildActive ? 'parent-active' : ''}`}
                        aria-expanded={isOpen}
                      >
                        <Icon size={18} />
                        <span>{label}</span>
                        {badge && badges[badge] ? <span className="nav-badge">{badges[badge]}</span> : null}
                        <ChevronDown size={16} className={`nav-chevron ${isOpen ? 'open' : 'closed'}`} />
                      </button>

                      {isOpen && (
                        <div className="nav-submenu">
                          {children.map((child) => {
                            const ChildIcon = child.icon || Icon
                            return (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                end={child.path === path}
                                className={({ isActive }) => `nav-subitem ${isActive ? 'active' : ''}`}
                              >
                                <ChildIcon size={16} />
                                <span>{child.label}</span>
                              </NavLink>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <NavLink key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Icon size={18} />
                    <span>{label}</span>
                    {badge && badges[badge] ? <span className="nav-badge">{badges[badge]}</span> : null}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">{user ? `${user.fullName} · ${user.roleLabel}` : ''}</span>
              <span className="user-email">{user?.email}{user?.branchName ? ` · ${user.branchName}` : ''}</span>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={signOut} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
