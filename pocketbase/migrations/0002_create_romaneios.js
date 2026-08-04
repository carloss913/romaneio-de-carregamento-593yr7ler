migrate(
  (app) => {
    const collection = new Collection({
      name: 'romaneios',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'rota',
          type: 'select',
          required: true,
          values: ['Piçarra', 'SFX', 'Tucumã', 'Floresta', 'Outros'],
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['em_andamento', 'finalizado'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'arquivo_planilha', type: 'file', maxSelect: 1, maxSize: 5242880 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_romaneios_rota ON romaneios (rota)',
        'CREATE INDEX idx_romaneios_data ON romaneios (data)',
        'CREATE INDEX idx_romaneios_status ON romaneios (status)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('romaneios')
    app.delete(collection)
  },
)
