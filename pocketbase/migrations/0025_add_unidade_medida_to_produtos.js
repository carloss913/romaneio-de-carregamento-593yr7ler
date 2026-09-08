migrate(
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    if (!produtosCol.fields.getByName('unidade_medida')) {
      produtosCol.fields.add(
        new SelectField({
          name: 'unidade_medida',
          values: ['kg', 'unidade'],
          maxSelect: 1,
        }),
      )
    }
    app.save(produtosCol)

    // Setar 'kg' como padrão em todos os registros existentes
    app
      .db()
      .newQuery(
        "UPDATE produtos SET unidade_medida = 'kg' WHERE unidade_medida IS NULL OR unidade_medida = ''",
      )
      .execute()
  },
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const field = produtosCol.fields.getByName('unidade_medida')
    if (field) {
      produtosCol.fields.remove(field)
    }
    app.save(produtosCol)
  },
)
