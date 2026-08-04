migrate(
  (app) => {
    const romaneioItensCol = app.findCollectionByNameOrId('romaneio_itens')
    app.truncateCollection(romaneioItensCol)

    const produtosCol = app.findCollectionByNameOrId('produtos')
    app.truncateCollection(produtosCol)
  },
  (app) => {},
)
