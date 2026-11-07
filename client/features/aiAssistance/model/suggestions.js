// Starter questions in the chat, per role (the API's role values)
export const SUGGESTED_QUESTIONS = {
  owner: ['What needs my attention right now?', 'What will run out soon, and what should I reorder?', 'What revenue should I expect in the next 30 days?', 'Which stock will expire before it sells?'],
  inventory_officer: ['What should I restock first?', 'Which batches should I use or move before they expire?', 'Can another branch send me anything I am short of?'],
  cashier: ['How are sales today compared with yesterday?', 'Which best sellers are about to run out?', 'When are my busiest hours?'],
  purchase_officer: ['What should I order this week, and how many?', 'Which supplier has the best price for each product?', 'Which orders still need payment or receiving?']
}

export const suggestionsFor = (role) => SUGGESTED_QUESTIONS[role] || SUGGESTED_QUESTIONS.inventory_officer
