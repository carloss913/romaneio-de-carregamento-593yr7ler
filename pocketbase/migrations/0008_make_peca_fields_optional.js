migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    const pesoPecaField = col.fields.getByName('peso_peca_kg')
    if (pesoPecaField) {
      pesoPecaField.required = false
    }

    const pecasPorCaixaField = col.fields.getByName('pecas_por_caixa')
    if (pecasPorCaixaField) {
      pecasPorCaixaField.required = false
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    const pesoPecaField = col.fields.getByName('peso_peca_kg')
    if (pesoPecaField) {
      pesoPecaField.required = true
    }

    const pecasPorCaixaField = col.fields.getByName('pecas_por_caixa')
    if (pecasPorCaixaField) {
      pecasPorCaixaField.required = true
    }

    app.save(col)
  },
)
