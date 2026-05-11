import { formatMoneyIn } from '../utils'

// Helpers thunks use to word confirmation messages
export const thunkContext = (getState) => {
  const state = getState()
  return {
    state,
    money: (value) => formatMoneyIn(state.settings.currency, value),
    branchName: (id) => (id === 'all' ? 'All Branches' : state.branches.find((b) => b.id === id)?.name)
  }
}
