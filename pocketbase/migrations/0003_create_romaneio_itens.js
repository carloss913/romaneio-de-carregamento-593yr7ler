migrate(
  (app) => {
    const romaneiosCol = app.findCollectionByNameOrId('romaneios')
    const produtosCol = app.findCollectionByNameOrId('produtos')

    const collection = new Collection({
      name: 'romaneio_itens',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'romaneio',
          type: 'relation',
          required: true,
          collectionId: romaneiosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'produto',
          type: 'relation',
          required: true,
          collectionId: produtosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'peso_total_kg', type: 'number', required: true, min: 0.01 },
        { name: 'caixas', type: 'number', required: true, min: 0, onlyInt: true },
        { name: 'pecas', type: 'number', required: true, min: 0, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_romaneio_itens_romaneio ON romaneio_itens (romaneio)',
        'CREATE INDEX idx_romaneio_itens_produto ON romaneio_itens (produto)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('romaneio_itens')
    app.delete(collection)
  },
)
