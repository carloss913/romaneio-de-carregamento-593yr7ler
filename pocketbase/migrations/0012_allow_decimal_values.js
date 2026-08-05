migrate(
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const pecasPorCaixaField = produtosCol.fields.getByName('pecas_por_caixa')
    if (pecasPorCaixaField) {
      pecasPorCaixaField.onlyInt = false
      pecasPorCaixaField.min = 0
    }
    app.save(produtosCol)

    const itensCol = app.findCollectionByNameOrId('romaneio_itens')
    const caixasField = itensCol.fields.getByName('caixas')
    if (caixasField) {
      caixasField.onlyInt = false
    }
    const pecasField = itensCol.fields.getByName('pecas')
    if (pecasField) {
      pecasField.onlyInt = false
    }
    app.save(itensCol)
  },
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const pecasPorCaixaField = produtosCol.fields.getByName('pecas_por_caixa')
    if (pecasPorCaixaField) {
      pecasPorCaixaField.onlyInt = true
      pecasPorCaixaField.min = 1
    }
    app.save(produtosCol)

    const itensCol = app.findCollectionByNameOrId('romaneio_itens')
    const caixasField = itensCol.fields.getByName('caixas')
    if (caixasField) {
      caixasField.onlyInt = true
    }
    const pecasField = itensCol.fields.getByName('pecas')
    if (pecasField) {
      pecasField.onlyInt = true
    }
    app.save(itensCol)
  },
)
