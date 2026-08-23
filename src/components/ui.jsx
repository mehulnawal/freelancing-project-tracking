import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import clsx from 'clsx'

export function Button({ className, variant = 'primary', loading, children, ...props }) {
  return <button className={clsx('button', `button-${variant}`, className)} disabled={loading || props.disabled} {...props}>{loading ? 'Working...' : children}</button>
}
export function IconButton({ label, className, children, ...props }) { return <button className={clsx('icon-button', className)} aria-label={label} title={label} {...props}>{children}</button> }
export function Card({ className, children, ...props }) { return <section className={clsx('card', className)} {...props}>{children}</section> }
export function Badge({ children, tone = 'neutral' }) { return <span className={`badge badge-${tone}`}><span aria-hidden="true" className="status-dot" />{children}</span> }
export function Input(props) { return <input className="input" {...props} /> }
export function Textarea(props) { return <textarea className="input textarea" {...props} /> }
export function Checkbox({ label, ...props }) { return <label className="checkbox"><input type="checkbox" {...props} /><span>{label}</span></label> }
export function FormField({ label, children, htmlFor, required, error }) {
  return <label className={clsx('form-field', error && 'has-error')} htmlFor={htmlFor}>
    <span>{label}{required && <span className="required-mark" aria-hidden="true"> *</span>}</span>
    {children}
    {error && <small className="field-error" role="alert">{error}</small>}
  </label>
}
export function SearchField({ ...props }) { return <Input type="search" placeholder="Search..." {...props} /> }
export function EmptyState({ icon: Icon, title = 'Ready when you are', description }) { return <div className="empty-state"><div className="empty-icon"><Icon size={25} /></div><h2>{title}</h2><p>{description}</p><Badge>Workspace foundation</Badge></div> }
export function LoadingOverlay({ label = 'Loading' }) { return <div className="loading-overlay" role="status">{label}...</div> }
export function ErrorState({ title = 'Something went wrong', description }) { return <div className="empty-state"><h2>{title}</h2><p>{description}</p></div> }
export function Skeleton({ className }) { return <div className={clsx('skeleton', className)} /> }
export function TableShell({ children }) { return <div className="table-shell">{children}</div> }
export function Pagination() { return <nav className="pagination" aria-label="Pagination"><Button variant="secondary" disabled>Previous</Button><span>Page 1</span><Button variant="secondary" disabled>Next</Button></nav> }
export function Tabs({ items = [] }) { return <div className="tabs" role="tablist">{items.map((item, index) => <button key={item} role="tab" aria-selected={index === 0}>{item}</button>)}</div> }
export function Tooltip({ children, label }) { return <span className="tooltip" data-tooltip={label}>{children}</span> }
export function Modal({ open, onClose, title, children }) { const ref = useRef(null); useEffect(() => { if (open) ref.current?.focus() }, [open]); if (!open) return null; return <div className="overlay" onMouseDown={onClose}><motion.section initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" ref={ref} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X size={19} /></IconButton></div>{children}</motion.section></div> }
export const ConfirmDialog = Modal
export const Drawer = ({ open, onClose, children }) => open ? <div className="overlay drawer-overlay" onMouseDown={onClose}><motion.aside initial={{ x: -280 }} animate={{ x: 0 }} className="drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>{children}</motion.aside></div> : null
export const Dropdown = ({ children, className }) => <div className={clsx('dropdown', className)} role="menu">{children}</div>
export const SelectShell = (props) => <select className="input" {...props} />

