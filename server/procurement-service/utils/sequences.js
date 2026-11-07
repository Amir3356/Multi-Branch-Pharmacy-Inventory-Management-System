/**
 * Gapless counters for record ids (SL-00001, …) and batch numbers, one row per name in id_sequences. Taking a number
 * locks its counter row until the surrounding transaction ends, so two requests at the same moment can't get the same
 * number, and a save that rolls back gives its number back. Call with the client of the transaction that saves it.
 *
 * Each counter belongs to one service: sales, expenses (sales-service); stock_transfers, damaged_items, batches
 * (inventory-service); procurements (procurement-service); branches (branch-service).
 */
export async function nextSequence(client, name) {
  if (!client?.inTransaction) {
    throw new Error(`Take the next ${name} number inside the transaction that saves it.`)
  }
  let { rows } = await client.query('update id_sequences set value = value + 1 where name = $1 returning value', [name])
  if (!rows.length) {
    // A counter the migration didn't create: start it, then take its first number
    await client.query('insert into id_sequences (name, value) values ($1, 0) on conflict (name) do nothing', [name])
    ;({ rows } = await client.query('update id_sequences set value = value + 1 where name = $1 returning value', [name]))
  }
  return Number(rows[0].value)
}

/** formatId('SL', 7) → 'SL-00007'; formatId('BR', 3, 2) → 'BR-03' */
export const formatId = (prefix, number, pad = 5) => `${prefix}-${String(number).padStart(pad, '0')}`

/** The next id for a counter, e.g. await nextId(client, 'sales', 'SL') → 'SL-00008' */
export async function nextId(client, name, prefix, pad = 5) {
  return formatId(prefix, await nextSequence(client, name), pad)
}
