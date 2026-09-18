migrate(
  (app) => {
    const romaneiosCol = app.findCollectionByNameOrId('romaneios')
    romaneiosCol.createRule = ''
    romaneiosCol.deleteRule = ''
    app.save(romaneiosCol)

    const itensCol = app.findCollectionByNameOrId('romaneio_itens')
    itensCol.createRule = ''
    itensCol.deleteRule = ''
    app.save(itensCol)
  },
  (app) => {
    const romaneiosCol = app.findCollectionByNameOrId('romaneios')
    romaneiosCol.createRule = "@request.auth.id != ''"
    romaneiosCol.deleteRule = "@request.auth.id != ''"
    app.save(romaneiosCol)

    const itensCol = app.findCollectionByNameOrId('romaneio_itens')
    itensCol.createRule = "@request.auth.id != ''"
    itensCol.deleteRule = "@request.auth.id != ''"
    app.save(itensCol)
  },
)
