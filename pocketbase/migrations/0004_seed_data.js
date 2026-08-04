migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'carlosaugusto913@hotmail.com')
    } catch (_) {
      const user = new Record(users)
      user.setEmail('carlosaugusto913@hotmail.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Carlos Augusto')
      app.save(user)
    }

    const produtosCol = app.findCollectionByNameOrId('produtos')
    const defaultProdutos = [
      { nome: 'Frango', peso_caixa_kg: 20, pecas_por_caixa: 4, peso_peca_kg: 5, ativo: true },
      {
        nome: 'Linguiça Toscana',
        peso_caixa_kg: 20,
        pecas_por_caixa: 4,
        peso_peca_kg: 5,
        ativo: true,
      },
      { nome: 'Picanha', peso_caixa_kg: 15, pecas_por_caixa: 3, peso_peca_kg: 5, ativo: true },
      { nome: 'Acém', peso_caixa_kg: 20, pecas_por_caixa: 4, peso_peca_kg: 5, ativo: true },
      {
        nome: 'Costela Bovina',
        peso_caixa_kg: 25,
        pecas_por_caixa: 5,
        peso_peca_kg: 5,
        ativo: true,
      },
    ]

    const createdProdutos = {}
    for (const p of defaultProdutos) {
      try {
        const rec = app.findFirstRecordByData('produtos', 'nome', p.nome)
        createdProdutos[p.nome] = rec.id
      } catch (_) {
        const rec = new Record(produtosCol)
        rec.set('nome', p.nome)
        rec.set('peso_caixa_kg', p.peso_caixa_kg)
        rec.set('pecas_por_caixa', p.pecas_por_caixa)
        rec.set('peso_peca_kg', p.peso_peca_kg)
        rec.set('ativo', p.ativo)
        app.save(rec)
        createdProdutos[p.nome] = rec.id
      }
    }

    const romaneiosCol = app.findCollectionByNameOrId('romaneios')
    const today = new Date().toISOString().split('T')[0] + ' 00:00:00.000Z'
    let demoRomaneioId = null

    try {
      const existingRomaneio = app.findFirstRecordByData('romaneios', 'rota', 'Piçarra')
      demoRomaneioId = existingRomaneio.id
    } catch (_) {
      const romaneio = new Record(romaneiosCol)
      romaneio.set('rota', 'Piçarra')
      romaneio.set('data', today)
      romaneio.set('status', 'em_andamento')
      romaneio.set('observacoes', 'Carga inicial demonstrativa para rota Piçarra')
      app.save(romaneio)
      demoRomaneioId = romaneio.id

      const itensCol = app.findCollectionByNameOrId('romaneio_itens')
      if (createdProdutos['Frango']) {
        const item1 = new Record(itensCol)
        item1.set('romaneio', demoRomaneioId)
        item1.set('produto', createdProdutos['Frango'])
        item1.set('peso_total_kg', 100)
        item1.set('caixas', 5)
        item1.set('pecas', 0)
        app.save(item1)
      }

      if (createdProdutos['Linguiça Toscana']) {
        const item2 = new Record(itensCol)
        item2.set('romaneio', demoRomaneioId)
        item2.set('produto', createdProdutos['Linguiça Toscana'])
        item2.set('peso_total_kg', 30)
        item2.set('caixas', 1)
        item2.set('pecas', 2)
        app.save(item2)
      }
    }
  },
  (app) => {},
)
