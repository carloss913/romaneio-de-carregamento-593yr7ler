cronAdd('daily_auto_delete_romaneios', '0 3 * * *', () => {
  console.log('[auto_delete] Iniciando verificação de limpeza automática de romaneios...')

  // 1. Busca a configuração global do servidor
  let months = 0
  try {
    const configs = $app.findRecordsByFilter('configuracoes', '', '-created', 1, 0)
    if (configs && configs.length > 0) {
      months = Number(configs[0].get('auto_delete_months')) || 0
    }
  } catch (err) {
    console.error('[auto_delete] Erro ao ler configuracoes do servidor:', String(err))
    return
  }

  if (months <= 0) {
    console.log('[auto_delete] Limpeza automática está desativada (auto_delete_months = 0).')
    return
  }

  // 2. Calcula data de corte ISO (agora menos X meses)
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - months)
  const cutoffIso = cutoffDate.toISOString().replace('T', ' ')

  console.log(
    '[auto_delete] Prazo configurado: ' + months + ' meses. Data limite (updated <): ' + cutoffIso,
  )

  // 3. Busca romaneios finalizados antigos em lotes controlados
  let totalRomaneiosExcluidos = 0
  let totalItensExcluidos = 0
  const BATCH_ROMANEIOS = 10

  while (true) {
    let romaneios = []
    try {
      romaneios = $app.findRecordsByFilter(
        'romaneios',
        'status = "finalizado" && updated < "' + cutoffIso + '"',
        'updated',
        BATCH_ROMANEIOS,
        0,
      )
    } catch (fetchErr) {
      console.error('[auto_delete] Erro ao buscar romaneios antigos:', String(fetchErr))
      break
    }

    if (!romaneios || romaneios.length === 0) {
      break
    }

    for (let i = 0; i < romaneios.length; i++) {
      const rom = romaneios[i]
      const romId = rom.id
      let romaneioItemError = false

      // Busca e exclui todos os itens vinculados ao romaneio antes de apagar o pai
      while (true) {
        let itens = []
        try {
          itens = $app.findRecordsByFilter(
            'romaneio_itens',
            'romaneio = "' + romId + '"',
            'created',
            25,
            0,
          )
        } catch (itemFindErr) {
          console.error(
            '[auto_delete] Erro ao buscar itens do romaneio ' + romId + ':',
            String(itemFindErr),
          )
          romaneioItemError = true
          break
        }

        if (!itens || itens.length === 0) {
          break
        }

        for (let j = 0; j < itens.length; j++) {
          const item = itens[j]
          let deleted = false
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              $app.delete(item)
              deleted = true
              totalItensExcluidos++
              break
            } catch (delItemErr) {
              console.warn(
                '[auto_delete] Tentativa ' + attempt + ' falhou ao excluir item ' + item.id + ':',
                String(delItemErr),
              )
            }
          }
          if (!deleted) {
            romaneioItemError = true
            console.error(
              '[auto_delete] Item ' +
                item.id +
                ' não pôde ser excluído. Abortando exclusão do romaneio pai.',
            )
            break
          }
        }

        if (romaneioItemError) {
          break
        }
      }

      // Se todos os itens foram excluídos com sucesso, exclui o romaneio pai
      if (!romaneioItemError) {
        let romDeleted = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            $app.delete(rom)
            romDeleted = true
            totalRomaneiosExcluidos++
            break
          } catch (delRomErr) {
            console.warn(
              '[auto_delete] Tentativa ' + attempt + ' falhou ao excluir romaneio ' + romId + ':',
              String(delRomErr),
            )
          }
        }
        if (!romDeleted) {
          console.error('[auto_delete] Falha definitiva ao excluir romaneio ' + romId)
        }
      }
    }
  }

  console.log(
    '[auto_delete] Limpeza concluída com sucesso. Romaneios excluídos: ' +
      totalRomaneiosExcluidos +
      ', Itens excluídos: ' +
      totalItensExcluidos,
  )
})
