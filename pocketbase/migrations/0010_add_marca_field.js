migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    if (!col.fields.getByName('marca')) {
      col.fields.add(new TextField({ name: 'marca' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    const marcaField = col.fields.getByName('marca')
    if (marcaField) {
      col.fields.remove(marcaField)
    }

    app.save(col)
  },
)
