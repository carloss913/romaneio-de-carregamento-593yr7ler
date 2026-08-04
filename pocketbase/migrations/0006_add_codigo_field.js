migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    if (!col.fields.getByName('codigo')) {
      col.fields.add(new TextField({ name: 'codigo' }))
    }

    col.removeIndex('idx_produtos_nome')
    col.addIndex('idx_produtos_nome_nonunique', false, 'nome', '')
    col.addIndex('idx_produtos_codigo', true, 'codigo', "codigo != ''")

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    const codigoField = col.fields.getByName('codigo')
    if (codigoField) {
      col.fields.remove(codigoField)
    }

    col.removeIndex('idx_produtos_nome_nonunique')
    col.removeIndex('idx_produtos_codigo')
    col.addIndex('idx_produtos_nome', true, 'nome', '')

    app.save(col)
  },
)
