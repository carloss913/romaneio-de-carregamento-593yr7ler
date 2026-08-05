migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    const pesoCaixaField = col.fields.getByName('peso_caixa_kg')
    if (pesoCaixaField) {
      pesoCaixaField.required = false
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    const pesoCaixaField = col.fields.getByName('peso_caixa_kg')
    if (pesoCaixaField) {
      pesoCaixaField.required = true
    }

    app.save(col)
  },
)
