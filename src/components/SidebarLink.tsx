'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname.startsWith(to)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLAnchorElement>(null)

  function showTooltip() {
    if (!collapsed || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 })
  }

  return (
    <>
      <Link
        href={to}
        ref={ref}
        className={isActive ? 'active' : ''}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setPos(null)}
      >
        {children}
        {soon && !collapsed && <span className="sidebar-soon-dot" />}
      </Link>
      {pos && createPortal(
        <div className="sidebar-tooltip" style={{ top: pos.top, left: pos.left }}>
          {label}
        </div>,
        document.body
      )}
    </>
  )
}
