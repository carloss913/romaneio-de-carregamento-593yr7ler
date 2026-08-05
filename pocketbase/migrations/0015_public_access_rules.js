migrate(
  (app) => {
    var romaneiosCol = app.findCollectionByNameOrId('romaneios')
    romaneiosCol.listRule = ''
    romaneiosCol.viewRule = ''
    romaneiosCol.updateRule = ''
    app.save(romaneiosCol)

    var itensCol = app.findCollectionByNameOrId('romaneio_itens')
    itensCol.listRule = ''
    itensCol.viewRule = ''
    itensCol.updateRule = ''
    app.save(itensCol)

    var produtosCol = app.findCollectionByNameOrId('produtos')
    produtosCol.listRule = ''
    produtosCol.viewRule = ''
    app.save(produtosCol)

    var configCol = app.findCollectionByNameOrId('configuracoes')
    configCol.listRule = ''
    configCol.viewRule = ''
    app.save(configCol)
  },
  (app) => {
    var romaneiosCol = app.findCollectionByNameOrId('romaneios')
    romaneiosCol.listRule = "@request.auth.id != ''"
    romaneiosCol.viewRule = "@request.auth.id != ''"
    romaneiosCol.updateRule = "@request.auth.id != ''"
    app.save(romaneiosCol)

    var itensCol = app.findCollectionByNameOrId('romaneio_itens')
    itensCol.listRule = "@request.auth.id != ''"
    itensCol.viewRule = "@request.auth.id != ''"
    itensCol.updateRule = "@request.auth.id != ''"
    app.save(itensCol)

    var produtosCol = app.findCollectionByNameOrId('produtos')
    produtosCol.listRule = "@request.auth.id != ''"
    produtosCol.viewRule = "@request.auth.id != ''"
    app.save(produtosCol)

    var configCol = app.findCollectionByNameOrId('configuracoes')
    configCol.listRule = "@request.auth.id != ''"
    configCol.viewRule = "@request.auth.id != ''"
    app.save(configCol)
  },
)
