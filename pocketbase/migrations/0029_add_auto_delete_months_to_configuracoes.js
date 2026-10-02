migrate(
  (app) => {
    const configCol = app.findCollectionByNameOrId('configuracoes')
    if (!configCol.fields.getByName('auto_delete_months')) {
      configCol.fields.add(
        new NumberField({
          name: 'auto_delete_months',
          min: 0,
          onlyInt: true,
        }),
      )
    }

    // Garante que operações de leitura, criação e atualização funcionem com a mesma política pública do app
    configCol.listRule = ''
    configCol.viewRule = ''
    configCol.createRule = ''
    configCol.updateRule = ''
    app.save(configCol)
  },
  (app) => {
    const configCol = app.findCollectionByNameOrId('configuracoes')
    const field = configCol.fields.getByName('auto_delete_months')
    if (field) {
      configCol.fields.remove(field)
    }
    configCol.createRule = "@request.auth.id != ''"
    configCol.updateRule = "@request.auth.id != ''"
    app.save(configCol)
  },
)
