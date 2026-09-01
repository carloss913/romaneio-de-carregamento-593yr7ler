migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')
    if (!col.fields.getByName('altura_linha')) {
      col.fields.add(
        new NumberField({
          name: 'altura_linha',
          min: 0,
          max: 500,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')
    const field = col.fields.getByName('altura_linha')
    if (field) {
      col.fields.removeByName('altura_linha')
      app.save(col)
    }
  },
)
