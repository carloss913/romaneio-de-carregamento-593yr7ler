migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')

    if (!col.fields.getByName('observacao')) {
      col.fields.add(new TextField({ name: 'observacao' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')

    const obsField = col.fields.getByName('observacao')
    if (obsField) {
      col.fields.remove(obsField)
    }

    app.save(col)
  },
)
