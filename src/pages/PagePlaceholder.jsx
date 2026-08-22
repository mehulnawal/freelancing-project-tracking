import { motion } from 'motion/react'
import { PageHeader } from '../components/PageHeader'
import { Card, EmptyState } from '../components/ui'

export function PagePlaceholder({ meta }) { const Icon = meta.icon; return <motion.div className="page-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}><PageHeader title={meta.title} description={meta.description} icon={Icon} /><Card className="preview-card"><EmptyState icon={Icon} title={`${meta.title} is ready`} description="This area is intentionally free of sample records. Its data and workflows will be connected in a future implementation step." /></Card></motion.div> }
