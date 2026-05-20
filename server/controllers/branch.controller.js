import * as branchService from '../services/branch.service.js'
import { presentBranch } from '../models/branch.model.js'

/** Branches (Laravel's BranchController): HTTP in, JSON out */

export async function index(req, res) {
  const rows = await branchService.list()
  res.json({ data: rows.map(presentBranch) })
}

export async function store(req, res) {
  const branch = await branchService.create(req, req.body)
  res.status(201).json({
    message: `${branch.name} (${branch.id}) was added.`,
    branch: presentBranch(await branchService.findWithStaffCount(branch.id)),
  })
}

export async function update(req, res) {
  const after = await branchService.update(req, req.branch, req.body)
  res.json({ message: `${after.name} was updated.`, branch: presentBranch(await branchService.findWithStaffCount(req.branch.id)) })
}

export async function destroy(req, res) {
  const { branch } = req
  await branchService.remove(req, branch)
  res.json({ message: `${branch.name} was deleted.` })
}
