import * as policyService from '../services/policy.service.js'
import { presentPolicy } from '../models/policy.model.js'

/** The store's policy (Laravel's PolicyController): HTTP in, JSON out */

export async function show(req, res) {
  res.json({ data: presentPolicy(await policyService.current()) })
}

export async function update(req, res) {
  const policy = await policyService.update(req, req.body)
  res.json({ message: 'Policy saved for every product at all branches.', policy: presentPolicy(policy) })
}
