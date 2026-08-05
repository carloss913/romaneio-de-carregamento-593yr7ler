migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')

    const caixasField = col.fields.getByName('caixas')
    if (caixasField) {
      caixasField.required = false
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')

    const caixasField = col.fields.getByName('caixas')
    if (caixasField) {
      caixasField.required = true
    }

    app.save(col)
  },
)
