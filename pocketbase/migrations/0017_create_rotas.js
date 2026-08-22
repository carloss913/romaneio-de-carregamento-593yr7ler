migrate(
  (app) => {
    const collection = new Collection({
      name: 'rotas',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'cor', type: 'text' },
        { name: 'ativa', type: 'bool' },
        { name: 'ordem', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_rotas_nome ON rotas (nome) WHERE nome != ''"],
    })
    app.save(collection)

    const rotasCol = app.findCollectionByNameOrId('rotas')
    const seeds = [
      { nome: 'Piçarra', cor: '#78716c', ordem: 1 },
      { nome: 'SFX', cor: '#3b82f6', ordem: 2 },
      { nome: 'Tucumã', cor: '#22c55e', ordem: 3 },
      { nome: 'Floresta', cor: '#059669', ordem: 4 },
      { nome: 'Xinguara', cor: '#f59e0b', ordem: 5 },
      { nome: 'Outros', cor: '#a855f7', ordem: 6 },
    ]

    for (const s of seeds) {
      try {
        app.findFirstRecordByData('rotas', 'nome', s.nome)
      } catch (_) {
        const rec = new Record(rotasCol)
        rec.set('nome', s.nome)
        rec.set('cor', s.cor)
        rec.set('ativa', true)
        rec.set('ordem', s.ordem)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('rotas')
      app.delete(col)
    } catch (_) {}
  },
)
