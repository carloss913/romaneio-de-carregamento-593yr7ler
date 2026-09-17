migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')

    if (!col.fields.getByName('obs_acrescimo')) {
      col.fields.add(new TextField({ name: 'obs_acrescimo' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')

    const field = col.fields.getByName('obs_acrescimo')
    if (field) {
      col.fields.remove(field)
    }

    app.save(col)
  },
)
