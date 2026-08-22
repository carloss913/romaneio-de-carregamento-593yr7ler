migrate(
  (app) => {
    // Convert `romaneios.rota` from a fixed `select` field to a free `text`
    // field so the routes can be managed dynamically via the `rotas` collection.
    //
    // PocketBase stores `select` values as TEXT in SQLite, so the underlying
    // column already holds text-compatible data — we only need to flip the
    // field's schema metadata type in place (no column drop/recreate, no data
    // loss). A defensive CAST ensures every stored value is normalised to TEXT.
    const col = app.findCollectionByNameOrId('romaneios')
    const field = col.fields.getByName('rota')
    if (field) {
      field.type = 'text'
      // drop the select-specific options so they don't linger on a text field
      field.selectValues = []
      field.maxSelect = null
    }
    app.save(col)

    // normalise any existing values to text (no-op for values already stored as text)
    app
      .db()
      .newQuery('UPDATE romaneios SET rota = CAST(rota AS TEXT) WHERE rota IS NOT NULL')
      .execute()
  },
  (app) => {
    // revert: restore the fixed select options
    const col = app.findCollectionByNameOrId('romaneios')
    const field = col.fields.getByName('rota')
    if (field) {
      field.type = 'select'
      field.selectValues = ['Piçarra', 'SFX', 'Tucumã', 'Floresta', 'Outros']
      field.maxSelect = 1
    }
    app.save(col)
  },
)
