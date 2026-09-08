migrate(
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const field = produtosCol.fields.getByName('unidade_medida')
    if (field) {
      field.values = ['kg', 'unidade', 'pacote']
    }
    app.save(produtosCol)
  },
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const field = produtosCol.fields.getByName('unidade_medida')
    if (field) {
      field.values = ['kg', 'unidade']
    }
    app.save(produtosCol)
  },
)
