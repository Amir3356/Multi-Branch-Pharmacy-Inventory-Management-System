import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * A dropdown for filter bars that draws its own list instead of the browser's native popup, so a long list (like the
 * Audit Logs modules) never closes the moment it opens, whatever the browser or desktop. Works like a select:
 * click or Enter/Space/↓ to open, ↑/↓/Home/End to move, Enter to pick, Escape or a click outside to close, and typing
 * a letter jumps to the next option starting with it.
 *
 * options: [{ value, label }]
 */
export default function FilterSelect({ value, onChange, options, ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]

  const openList = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }
  const pick = (index) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    close()
  }

  // A click anywhere outside closes the list
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keep the highlighted option in view while moving through a long list
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (e) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    const moves = { ArrowDown: Math.min(last, active + 1), ArrowUp: Math.max(0, active - 1), Home: 0, End: last }
    if (e.key in moves) {
      e.preventDefault()
      setActive(moves[e.key])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const letter = e.key.toLowerCase()
      const order = [...options.slice(active + 1), ...options.slice(0, active + 1)]
      const match = order.find((o) => o.label.toLowerCase().startsWith(letter))
      if (match) setActive(options.indexOf(match))
    }
  }

  return (
    <div ref={rootRef} className={`filter-dropdown ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="input-field filter-select filter-dropdown-button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="filter-dropdown-value">{selected?.label}</span>
        <ChevronDown size={16} className="filter-dropdown-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="filter-dropdown-list">
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`filter-dropdown-option ${index === active ? 'active' : ''} ${option.value === value ? 'selected' : ''}`}
              onPointerEnter={() => setActive(index)}
              // pointerdown would move focus off the button before the pick; keep it there
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
