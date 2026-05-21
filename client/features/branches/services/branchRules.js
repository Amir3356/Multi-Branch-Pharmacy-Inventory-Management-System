// Field errors for the Add/Edit Branch form; names are unique ignoring case (the API checks the same)
export function validateBranch(form, branches, editing) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Branch name is required'
  else if (branches.some((b) => b.id !== editing?.id && b.name.toLowerCase() === form.name.trim().toLowerCase())) errors.name = 'A branch with this name already exists'
  if (!form.location.trim()) errors.location = 'Location is required'
  return errors
}
