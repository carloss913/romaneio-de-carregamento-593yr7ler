migrate(
  (app) => {
    const romaneiosCol = app.findCollectionByNameOrId('romaneios')
    if (!romaneiosCol.fields.getByName('conferente')) {
      romaneiosCol.fields.add(
        new TextField({
          name: 'conferente',
          required: false,
        }),
      )
      app.save(romaneiosCol)
    }
  },
  (app) => {
    const romaneiosCol = app.findCollectionByNameOrId('romaneios')
    const conferenteField = romaneiosCol.fields.getByName('conferente')
    if (conferenteField) {
      romaneiosCol.fields.remove(conferenteField)
      app.save(romaneiosCol)
    }
  },
)
