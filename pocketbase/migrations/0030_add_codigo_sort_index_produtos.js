migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')
    // idx_produtos_codigo existente tinha WHERE "codigo != ''" que impedia o SQLite de usá-lo para consultas gerais ORDER BY codigo
    // Adiciona índice idx_produtos_sort_codigo sem cláusula WHERE cobrindo todos os registros para sort rápido
    col.addIndex('idx_produtos_sort_codigo', false, 'codigo', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')
    col.removeIndex('idx_produtos_sort_codigo')
    app.save(col)
  },
)
