migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')
    if (!col.fields.getByName('carregado')) {
      col.fields.add(new BoolField({ name: 'carregado', required: false }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('romaneio_itens')
    const field = col.fields.getByName('carregado')
    if (field) {
      col.fields.remove(field)
    }
    app.save(col)
  },
)
