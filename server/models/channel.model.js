/**
 * Private channels and authorization rules. `who` is the socket's
 * signed-in session: { user, tokenId }.
 */
export const BRANCH_TOPICS = Object.freeze(['stock', 'sales', 'transfers', 'procurements', 'damaged', 'expenses'])

const everyone = () => true
const ownerOnly = ({ user }) => user.role === 'owner'

const RULES = [
  // New audit log entries; session list changes: only the Owner
  [/^audit-logs$/, ownerOnly],
  [/^sessions$/, ownerOnly],
  // Branch list, policy and catalog price changes reach every signed-in user
  [/^branches$/, everyone],
  [/^policy$/, everyone],
  [/^products$/, everyone],
  // "Your session was ended": only the browser holding that very session
  [/^session\.(\d+)$/, ({ tokenId }, [, sessionId]) => String(tokenId) === sessionId],
  // Live branch data: its own staff, and those who cover every branch (Owner, Purchase Officer)
  [
    /^branch\.([^.]+)\.([a-z]+)$/,
    ({ user }, [, branchId, topic]) => BRANCH_TOPICS.includes(topic) && (user.coversAllBranches || user.branchId === branchId),
  ],
]

/** True when this session may join the channel */
export function canListen(who, channel) {
  if (!who?.user || typeof channel !== 'string') return false
  for (const [pattern, rule] of RULES) {
    const match = channel.match(pattern)
    if (match) return Boolean(rule(who, match))
  }
  return false
}
