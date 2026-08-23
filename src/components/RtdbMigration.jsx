import { useState } from 'react'
import { Database, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card } from './ui'
import { useAuth } from '../context/useAuth'

export function RtdbMigration() {
  const { user, isConfigured, preview } = useAuth()
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const canRun = Boolean(user && isConfigured && !preview && !complete)

  const run = async () => {
    if (!window.confirm('Migrate this admin workspace from Firestore to Realtime Database? This copies legacy data once and refuses to overwrite an existing RTDB workspace.')) return
    setBusy(true)
    try {
      const { migrateFirestoreToRealtimeDatabase } = await import("../services/rtdbMigration")
      const result = await migrateFirestoreToRealtimeDatabase(user.uid)
      setComplete(true)
      toast.success(`Migration copied ${result.copied} records. Reload the app to use RTDB data.`)
    } catch (error) {
      toast.error(error.message || 'Migration could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return <Card className="rtdb-migration">
    <div className="section-heading">
      <Database size={18} />
      <div>
        <h3>One-time RTDB migration</h3>
        <p>Copies legacy Firestore records into this admin's private RTDB namespace. It never deletes Firestore data and refuses to overwrite RTDB data.</p>
      </div>
    </div>
    <p className="helper-text"><TriangleAlert size={14} /> Run only after confirming the deployed RTDB rules and taking a backup.</p>
    <Button onClick={run} disabled={!canRun} loading={busy}>
      Migrate Firestore data to RTDB
    </Button>
  </Card>
}



