migrate(
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    if (!produtosCol.fields.getByName('secao')) {
      produtosCol.fields.add(
        new SelectField({
          name: 'secao',
          values: ['CONGELADO', 'GERAL', 'RESFRIADO'],
        }),
      )
    }
    app.save(produtosCol)

    const configCol = app.findCollectionByNameOrId('configuracoes')
    if (!configCol.fields.getByName('telefone_contato')) {
      configCol.fields.add(new TextField({ name: 'telefone_contato' }))
    }
    if (!configCol.fields.getByName('nome_contato')) {
      configCol.fields.add(new TextField({ name: 'nome_contato' }))
    }
    app.save(configCol)
  },
  (app) => {
    const produtosCol = app.findCollectionByNameOrId('produtos')
    const secaoField = produtosCol.fields.getByName('secao')
    if (secaoField) {
      produtosCol.fields.remove(secaoField)
    }
    app.save(produtosCol)

    const configCol = app.findCollectionByNameOrId('configuracoes')
    const telField = configCol.fields.getByName('telefone_contato')
    if (telField) {
      configCol.fields.remove(telField)
    }
    const nomeField = configCol.fields.getByName('nome_contato')
    if (nomeField) {
      configCol.fields.remove(nomeField)
    }
    app.save(configCol)
  },
)
