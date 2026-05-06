/**
 * Builds positional parameters for raw SQL queries:
 * e.g. `where id = ${p.add(id)}` -> produces `$1` and stores `id` in `p.values`
 */
export class Params {
  values = []

  add(value) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}

export default Params
