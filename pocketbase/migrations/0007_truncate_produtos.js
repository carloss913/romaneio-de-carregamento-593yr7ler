migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')
    app.truncateCollection(col)
  },
  (app) => {},
)
