import { ReactNode } from 'react'
import './Card.css'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  const classes = ['card', hover ? 'card-hover' : '', className]
    .filter(Boolean)
    .join(' ')

  return <div className={classes}>{children}</div>
}
