import React, { useState, useRef, useEffect, useCallback } from 'react'
import { RomaneioItem } from '@/types/database'
import { TableRow, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'

interface ResizableTableRowProps {
  item: RomaneioItem
  isFinalizado: boolean
  updatingSecaoProdId: string | null
  getSecaoBadgeClass: (secao?: string) => string
  getItemQuantidade: (item: RomaneioItem) => string
  onToggleCarregado: (item: RomaneioItem) => void
  onUpdateSecao: (produtoId: string, novaSecao: string) => void
  onEditItemObs: (item: RomaneioItem) => void
  onDeleteItem: (itemId: string) => void
  onUpdateRowHeight: (itemId: string, height: number | null) => void
}

export const ResizableTableRow: React.FC<ResizableTableRowProps> = ({
  item,
  isFinalizado,
  updatingSecaoProdId,
  getSecaoBadgeClass,
  getItemQuantidade,
  onToggleCarregado,
  onUpdateSecao,
  onEditItemObs,
  onDeleteItem,
  onUpdateRowHeight,
}) => {
  const rowRef = useRef<HTMLTableRowElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [localHeight, setLocalHeight] = useState<number | null>(item.altura_linha || null)

  useEffect(() => {
    setLocalHeight(item.altura_linha || null)
  }, [item.altura_linha])

  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const currentHeightRef = useRef<number | null>(item.altura_linha || null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (rowRef.current) {
        const rect = rowRef.current.getBoundingClientRect()
        startHeightRef.current = rect.height
        startYRef.current = e.clientY
        currentHeightRef.current = rect.height
        setIsResizing(true)

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const delta = moveEvent.clientY - startYRef.current
          // Minimum row height ~44px, maximum 400px
          const newHeight = Math.max(44, Math.min(400, Math.round(startHeightRef.current + delta)))
          currentHeightRef.current = newHeight
          setLocalHeight(newHeight)
        }

        const handleMouseUp = () => {
          setIsResizing(false)
          window.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('mouseup', handleMouseUp)

          if (currentHeightRef.current !== null) {
            // If close to default height (<= 48px), treat as null / reset, otherwise persist
            const finalHeight = currentHeightRef.current <= 48 ? null : currentHeightRef.current
            setLocalHeight(finalHeight)
            onUpdateRowHeight(item.id, finalHeight)
          }
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
      }
    },
    [item.id, onUpdateRowHeight],
  )

  const handleResetHeight = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setLocalHeight(null)
      onUpdateRowHeight(item.id, null)
    },
    [item.id, onUpdateRowHeight],
  )

  const prod = item.expand?.produto
  const currentSecao = prod?.secao
  const displaySecao = currentSecao ? currentSecao : '—'
  const hasCustomHeight = localHeight !== null && localHeight > 48

  return (
    <TableRow
      ref={rowRef}
      style={localHeight ? { height: `${localHeight}px` } : undefined}
      className={`group/row relative select-none transition-colors ${
        item.carregado ? 'opacity-50' : ''
      } ${isResizing ? 'bg-orange-50/40 select-none' : ''}`}
    >
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="text-center align-top pt-3 pb-3 relative"
      >
        <div className="flex items-center justify-center pt-0.5">
          <Checkbox
            checked={item.carregado}
            onCheckedChange={() => onToggleCarregado(item)}
            disabled={isFinalizado}
            className={item.carregado ? 'border-emerald-500 bg-emerald-500 text-white' : ''}
          />
        </div>
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="font-mono text-xs text-slate-500 tabular-nums align-top pt-3 pb-3"
      >
        {prod?.codigo || '-'}
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="min-w-[130px] align-top pt-2.5 pb-3"
      >
        {isFinalizado || !prod ? (
          <span
            className={
              currentSecao
                ? `inline-flex items-center px-2 py-0.5 rounded border ${getSecaoBadgeClass(currentSecao)}`
                : 'text-slate-300 font-medium'
            }
          >
            {displaySecao}
          </span>
        ) : (
          <Select
            value={currentSecao || '__NONE'}
            onValueChange={(val) => onUpdateSecao(prod.id, val)}
            disabled={updatingSecaoProdId === prod.id}
          >
            <SelectTrigger
              className={`h-7 text-xs px-2 py-0.5 rounded border border-slate-200/80 bg-white shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-orange-400 w-auto min-w-[110px] ${
                currentSecao ? getSecaoBadgeClass(currentSecao) : 'text-slate-400 font-normal'
              }`}
            >
              <SelectValue placeholder="—">
                {currentSecao ? currentSecao : <span className="text-slate-300">—</span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONGELADO">CONGELADO</SelectItem>
              <SelectItem value="GERAL">GERAL</SelectItem>
              <SelectItem value="RESFRIADO">RESFRIADO</SelectItem>
              <SelectItem value="__NONE">Outros</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className={`font-bold text-slate-800 align-top pt-3 pb-3 ${
          item.carregado ? 'line-through text-slate-400' : ''
        }`}
      >
        <div className="flex flex-col">
          <span>{prod?.nome || 'Produto'}</span>
          {hasCustomHeight && (
            <span className="text-[10px] font-normal text-slate-400 mt-1 italic print:hidden">
              (Linha expandida: {localHeight}px)
            </span>
          )}
        </div>
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="text-slate-600 text-sm align-top pt-3 pb-3"
      >
        {prod?.marca || '-'}
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="text-right font-medium tabular-nums align-top pt-3 pb-3"
      >
        {item.peso_total_kg.toFixed(1)} kg
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="text-right font-black text-slate-900 align-top pt-3 pb-3"
      >
        {getItemQuantidade(item)}
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="text-xs text-slate-500 max-w-[160px] truncate align-top pt-3 pb-3"
      >
        {item.observacao || '-'}
      </TableCell>
      <TableCell
        style={localHeight ? { height: `${localHeight}px` } : undefined}
        className="text-right align-top pt-2 pb-3"
      >
        <div className="flex items-center justify-end gap-1">
          {hasCustomHeight && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetHeight}
              className="text-slate-300 hover:text-amber-600 hover:bg-amber-50 h-8 w-8"
              title="Restaurar altura padrão da linha"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          {!isFinalizado && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditItemObs(item)}
              className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 h-8 w-8"
              title="Editar observação do item"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {!isFinalizado && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteItem(item.id)}
              className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8"
              title="Excluir item"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Excel-like Bottom Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-20 group-hover/row:bg-blue-400/30 transition-colors ${
            isResizing
              ? 'bg-orange-500 h-2.5 opacity-100 shadow-sm'
              : 'opacity-0 group-hover/row:opacity-100'
          }`}
          title="Clique e arraste para ajustar a altura da linha (estilo Excel)"
        >
          {/* Subtle line indicator in the center */}
          <div className="w-12 h-0.5 bg-blue-500 rounded-full mx-auto my-auto mt-0.5" />
        </div>
      </TableCell>
    </TableRow>
  )
}
