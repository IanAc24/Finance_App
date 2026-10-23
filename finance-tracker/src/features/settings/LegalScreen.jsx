import { Link, Navigate, useParams } from 'react-router-dom'
import { useSettings } from '../../context/useSettings'
import LegalText from '../../components/LegalText'
import { isLegalDoc } from '../../lib/legal'

// /legal/:doc: one legal document, opened from Settings
export default function LegalScreen() {
  const { t } = useSettings()
  const { doc } = useParams()

  if (!isLegalDoc(doc)) return <Navigate to="/settings" replace />

  return (
    <>
      <Link className="back-link" to="/settings">
        ‹ {t('settings')}
      </Link>
      <LegalText doc={doc} />
    </>
  )
}
