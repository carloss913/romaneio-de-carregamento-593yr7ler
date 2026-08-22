migrate(
  (app) => {
    // Migration 0019 was marked "applied" but never actually converted
    // `romaneios.rota` from a `select` field to a `text` field, because it
    // tried to flip `field.type = 'text'` in place — which PocketBase silently
    // ignores (the Go field type cannot be changed by reassigning `.type`).
    // The live schema therefore still has `rota` as a fixed select with values
    // Piçarra | SFX | Tucumã | Floresta | Outros, blocking any dynamic route
    // from the `rotas` collection (e.g. "Xinguara" cannot be assigned).
    //
    // This migration does the conversion the RIGHT way:
    //   1. Back up every existing rota value (select stores as TEXT already)
    //   2. Remove the old select field and add a new text field (same name)
    //   3. Re-add the index (the column may be dropped/recreated on save)
    //   4. Restore the backed-up values via raw SQL

    const col = app.findCollectionByNameOrId('romaneios')
    const field = col.fields.getByName('rota')

    // Idempotent: nothing to do if rota is already a text field
    if (!field || field.type !== 'select') return

    // 1. Back up existing rota values
    let backup = []
    try {
      const records = app.findRecordsByFilter('romaneios', 'id != ""', '', 1000, 0)
      for (const r of records) {
        backup.push({ id: r.id, rota: r.getString('rota') })
      }
    } catch (_) {}

    // 2. Replace the select field with a free-text field (same column name)
    col.fields.remove(field)
    col.fields.add(new TextField({ name: 'rota' }))

    // 3. Ensure the index survives (addIndex is idempotent)
    col.addIndex('idx_romaneios_rota', false, 'rota', '')

    app.save(col)

    // 4. Restore the backed-up values
    for (const b of backup) {
      if (b.rota) {
        app
          .db()
          .newQuery('UPDATE romaneios SET rota = {:rota} WHERE id = {:id}')
          .bind({ rota: b.rota, id: b.id })
          .execute()
      }
    }
  },
  (app) => {
    // Revert: restore the fixed select field with its original options
    const col = app.findCollectionByNameOrId('romaneios')
    const field = col.fields.getByName('rota')
    if (field && field.type === 'text') {
      col.fields.remove(field)
      col.fields.add(
        new SelectField({
          name: 'rota',
          values: ['Piçarra', 'SFX', 'Tucumã', 'Floresta', 'Outros'],
          maxSelect: 1,
        }),
      )
      app.save(col)
    }
  },
)
