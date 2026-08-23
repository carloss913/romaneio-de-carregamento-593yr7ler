migrate(
  (app) => {
    // 1. Back up existing rota values
    let backup = []
    try {
      const records = app.findRecordsByFilter('romaneios', 'id != ""', '', 1000, 0)
      for (const r of records) {
        backup.push({ id: r.id, rota: r.getString('rota') })
      }
    } catch (_) {}

    // 2. Remove the old select/text field and add a clean TextField
    const col = app.findCollectionByNameOrId('romaneios')
    const oldField = col.fields.getByName('rota')
    if (oldField) {
      col.fields.removeByName('rota')
    }
    col.fields.add(
      new TextField({
        name: 'rota',
        required: true,
      }),
    )
    col.addIndex('idx_romaneios_rota', false, 'rota', '')
    app.save(col)

    // 3. Restore any backed-up rota values
    for (const b of backup) {
      if (b.rota) {
        app
          .db()
          .newQuery('UPDATE romaneios SET rota = {:rota} WHERE id = {:id}')
          .bind({ rota: b.rota, id: b.id })
          .execute()
      }
    }

    // Specific restore for any known initial test records if empty
    try {
      app
        .db()
        .newQuery(
          "UPDATE romaneios SET rota = 'Floresta' WHERE id = 'lnoeq6lcifrnpb9' AND (rota IS NULL OR rota = '')",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE romaneios SET rota = 'Outros' WHERE id = 'zcke77wu4q6wctg' AND (rota IS NULL OR rota = '')",
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('romaneios')
    const oldField = col.fields.getByName('rota')
    if (oldField) {
      col.fields.removeByName('rota')
    }
    col.fields.add(
      new SelectField({
        name: 'rota',
        required: true,
        values: ['Piçarra', 'SFX', 'Tucumã', 'Floresta', 'Outros'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
