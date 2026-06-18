import React, { useState, useRef, useEffect } from 'react';
import { Volume2, ChevronLeft, ChevronRight, Trash2, Check, Pencil, X } from 'lucide-react';

interface SyncLineItemProps {
  line: { time: number; text: string };
  idx: number;
  isActive: boolean;
  isDone: boolean;
  isCurrentlyPlaying?: boolean;
  activeSyncRef: React.RefObject<HTMLDivElement | null> | null;
  handleJumpToLine: (idx: number) => void;
  handleManualTimeChange: (idx: number, newTime: number) => void;
  handleDeleteLine?: (idx: number) => void;
  handleUpdateLineText?: (idx: number, newText: string) => void;
  onEnterEditMode?: (idx: number, time: number) => void;
  onExitEditMode?: () => void;
}

export const SyncLineItem = ({
  line,
  idx,
  isActive,
  isDone,
  isCurrentlyPlaying,
  activeSyncRef,
  handleJumpToLine,
  handleManualTimeChange,
  handleDeleteLine,
  handleUpdateLineText,
  onEnterEditMode,
  onExitEditMode,
}: SyncLineItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(line.text);
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedTime = isDone
    ? `${Math.floor(line.time / 60).toString().padStart(2, '0')}:${(line.time % 60).toFixed(1).padStart(4, '0')}`
    : null;

  const [timeInput, setTimeInput] = useState(formattedTime || '00:00.0');

  useEffect(() => {
    if (formattedTime) {
      setTimeInput(formattedTime);
    }
  }, [formattedTime]);

  const commitTimeEdit = () => {
    const parts = timeInput.trim().split(':');
    let totalSeconds = 0;
    if (parts.length === 2) {
      totalSeconds = parseInt(parts[0] || '0', 10) * 60 + parseFloat(parts[1] || '0');
    } else if (parts.length === 1) {
      totalSeconds = parseFloat(parts[0] || '0');
    }
    
    if (!isNaN(totalSeconds) && totalSeconds >= 0) {
      handleManualTimeChange(idx, totalSeconds);
      if (onEnterEditMode && isEditing) {
        onEnterEditMode(idx, totalSeconds);
      }
    } else {
      setTimeInput(formattedTime || '00:00.0');
    }
  };

  useEffect(() => {
    if (!isEditing) setEditValue(line.text);
  }, [line.text, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const enterEdit = (e: React.MouseEvent) => {
    if (!handleUpdateLineText) return;
    e.stopPropagation();
    setIsEditing(true);
    // Iniciar loop de audio si la línea ya tiene tiempo
    if (isDone && onEnterEditMode) {
      onEnterEditMode(idx, line.time);
    }
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== line.text && handleUpdateLineText) {
      handleUpdateLineText(idx, trimmed);
    }
    setIsEditing(false);
    onExitEditMode?.();
  };

  const cancelEdit = () => {
    setEditValue(line.text);
    setIsEditing(false);
    onExitEditMode?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
    e.stopPropagation();
  };

  const isInstrumental =
    line.text === '[Instrumental]' || line.text === '[Música]';

  return (
    <div
      ref={isActive ? activeSyncRef : null}
      onClick={() => !isEditing && handleJumpToLine(idx)}
      onDoubleClick={enterEdit}
      className={`group py-2.5 px-3 sm:px-4 rounded-xl mb-2 flex items-center gap-2 sm:gap-3 transition-all duration-300 cursor-pointer hover:bg-white/5 hover:opacity-100 relative ${
        isEditing
          ? 'bg-zinc-800/80 border border-primary-500/40 opacity-100 scale-[1.01] origin-left'
          : isActive
          ? 'bg-primary-500/10 border border-primary-500/30 scale-[1.02] sm:scale-105 origin-left opacity-100 shadow-[0_0_15px_rgba(var(--color-primary-500),0.1)]'
          : isCurrentlyPlaying
          ? 'opacity-100 bg-white/5 shadow-[inset_4px_0_0_var(--color-primary-500)]'
          : isDone
          ? 'opacity-60'
          : 'opacity-30'
      }`}
    >
      {/* Indicador de línea sonando */}
      {isCurrentlyPlaying && !isActive && !isEditing && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-primary-400 animate-pulse drop-shadow-[0_0_5px_var(--color-primary-500)] hidden sm:block">
          <Volume2 size={16} />
        </div>
      )}

      {/* Badge de estado — solo cuando no estamos editando */}
      {!isEditing && (
        <div
          title={isDone ? 'Sincronizada' : isActive ? 'Siguiente a sincronizar' : 'Sin sincronizar'}
          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
            isDone
              ? 'bg-primary-500/20 text-primary-400'
              : isActive
              ? 'bg-primary-500/30 text-primary-400 animate-pulse'
              : 'bg-zinc-800 text-zinc-700'
          }`}
        >
          {isDone ? (
            <Check size={10} strokeWidth={3} />
          ) : isActive ? (
            <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          )}
        </div>
      )}

      {/* ── MODO EDICIÓN ── */}
      {isEditing ? (
        <div 
          className="flex-1 flex flex-col gap-1.5 min-w-0" 
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            // Si el foco salió completamente de este contenedor de edición
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              commitTimeEdit();
              commitEdit();
            }
          }}
        >

          {/* Fila superior: control de tiempo (si la línea ya está sincronizada) */}
          {isDone && (
            <div className="flex items-center gap-1">
              <button
                onMouseDown={(e) => { e.preventDefault(); handleManualTimeChange(idx, Math.max(0, line.time - 0.1)); }}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-primary-500/20 hover:text-primary-400 text-zinc-400 transition-all active:scale-90 flex-shrink-0"
                title="Atrasar 0.1s"
              >
                <ChevronLeft size={14} />
              </button>
              <input
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitTimeEdit(); }
                  e.stopPropagation();
                }}
                className="w-[60px] bg-transparent text-xs font-mono text-primary-400 font-bold tabular-nums text-center focus:outline-none focus:bg-primary-500/10 rounded transition-colors"
                spellCheck={false}
              />
              <button
                onMouseDown={(e) => { e.preventDefault(); handleManualTimeChange(idx, line.time + 0.1); }}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-primary-500/20 hover:text-primary-400 text-zinc-400 transition-all active:scale-90 flex-shrink-0"
                title="Adelantar 0.1s"
              >
                <ChevronRight size={14} />
              </button>
              <span className="text-[10px] text-zinc-600 ml-1 hidden sm:inline">
                🔁 bucle activo
              </span>
            </div>
          )}

          {/* Fila inferior: input de texto */}
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-b border-primary-500/60 text-primary-300 font-sans text-base sm:text-xl font-black focus:outline-none py-0.5"
            spellCheck={false}
          />
        </div>
      ) : (
        /* ── MODO NORMAL ── */
        <div className="flex-1 flex flex-col min-w-0 py-1">
          <p
            className={`font-sans text-lg sm:text-2xl font-black transition-colors leading-snug ${
              isActive
                ? 'text-primary-400 drop-shadow-[0_0_10px_var(--theme-glow)]'
                : isCurrentlyPlaying
                ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : isDone
                ? 'text-zinc-400'
                : 'text-zinc-600'
            }`}
          >
            {line.text}
          </p>

          {/* Tiempo debajo del texto (siempre visible pero sutil, no quita espacio horizontal) */}
          {isDone && (
            <span className="text-[10px] font-mono text-zinc-600 mt-0.5">
              {formattedTime}
            </span>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isEditing ? (
          /* Botón cancelar edición */
          <button
            onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
            title="Cancelar edición (Esc)"
          >
            <X size={14} />
          </button>
        ) : (
          <>
            {/* Botón editar (desktop hover) */}
            {handleUpdateLineText && !isInstrumental && (
              <button
                onClick={enterEdit}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-primary-400 hover:bg-primary-500/10 transition-all hidden lg:flex lg:opacity-0 lg:group-hover:opacity-100 flex-shrink-0"
                title="Editar (o doble clic)"
              >
                <Pencil size={13} />
              </button>
            )}

            {/* Botón eliminar instrumental */}
            {isInstrumental && handleDeleteLine && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteLine(idx); }}
                className="w-7 h-7 flex items-center justify-center rounded-xl text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all lg:opacity-0 lg:group-hover:opacity-100 flex-shrink-0"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
