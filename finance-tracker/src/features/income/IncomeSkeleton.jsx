import Skeleton from '../../components/Skeleton'
import { useSettings } from '../../context/useSettings'

// What the Income screen shows while its code loads: the same shapes (title,
// chips, summary card, rows) as soft pulsing blocks, so nothing jumps when the
// real screen arrives. Screen readers hear "loading" once.
export default function IncomeSkeleton() {
  const { t } = useSettings()
  return (
    <div className="income-screen" role="status" aria-label={t('incomeLoading')}>
      <div className="hist-headrow">
        <Skeleton width={140} height={30} />
        <Skeleton width={150} height={44} round />
      </div>
      <div className="income-cols">
        <div className="income-side">
          <div className="hist-chip-row">
            <Skeleton width={96} height={44} round />
            <Skeleton width={96} height={44} round />
            <Skeleton width={120} height={44} round />
          </div>
          <div className="summary income-summary">
            <Skeleton width={120} height={16} />
            <Skeleton width={220} height={44} />
            <Skeleton width={90} height={14} />
          </div>
        </div>
        <div className="income-main">
          {[0, 1, 2].map((i) => (
            <div className="skeleton-row" key={i}>
              <Skeleton width={40} height={40} round />
              <Skeleton width="50%" height={16} />
              <Skeleton width={80} height={16} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
