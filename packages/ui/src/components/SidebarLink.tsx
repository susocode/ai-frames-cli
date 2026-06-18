import { useState, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { createPortal } from 'react-dom'

interface Props {
  to: string
  end?: boolean
  label: string
  collapsed: boolean
  soon?: boolean
  children: React.ReactNode
}

export default function SidebarLink({ to, end, label, collapsed, soon, children }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLAnchorElement>(null)

  function showTooltip() {
    if (!collapsed || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 })
  }

  return (
    <>
      <NavLink to={to} end={end} ref={ref} onMouseEnter={showTooltip} onMouseLeave={() => setPos(null)}>
        {children}
        {soon && !collapsed && <span className="sidebar-soon-dot" />}
      </NavLink>
      {pos && createPortal(
        <div className="sidebar-tooltip" style={{ top: pos.top, left: pos.left }}>
          {label}
        </div>,
        document.body
      )}
    </>
  )
}
