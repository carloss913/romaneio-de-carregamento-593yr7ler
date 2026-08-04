migrate(
  (app) => {
    const collection = new Collection({
      name: 'produtos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'peso_caixa_kg', type: 'number', required: true, min: 0.1 },
        { name: 'pecas_por_caixa', type: 'number', required: true, min: 1, onlyInt: true },
        { name: 'peso_peca_kg', type: 'number', required: true, min: 0.01 },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_produtos_nome ON produtos (nome)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('produtos')
    app.delete(collection)
  },
)
