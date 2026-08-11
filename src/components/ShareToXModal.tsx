import { useState } from 'react'
import { useT } from '../hooks/useT'
import type { UserStats } from '../types'

export type ShareTemplateType = 'host_broadcast' | 'attendee_announcement' | 'host_weekly' | 'participant_review'

interface ShareToXModalProps {
  open: boolean
  onClose: () => void
  templateType: ShareTemplateType
  data: {
    stats?: UserStats
    event?: { title: string; startTime: string; region?: string; hostName?: string; eventUrl: string }
    profileUrl?: string
    tags?: string[]
  }
}

function generateTemplate(
  templateType: ShareTemplateType,
  data: ShareToXModalProps['data'],
): string {
  switch (templateType) {
    case 'host_broadcast': {
      const e = data.event
      if (!e) return ''
      return `我在 AkaAka 舉辦了活動：【${e.title}】！時間：${e.startTime} 地區：${e.region ?? '線上'} 期待與大家見面！活動連結：${e.eventUrl} #AkaAka #BDSM`
    }
    case 'attendee_announcement': {
      const e = data.event
      if (!e) return ''
      return `我剛報名了 AkaAka 的活動：【${e.title}】！主辦人：${e.hostName ?? ''} 有興趣的夥伴也來看看吧：${e.eventUrl} #AkaAka #BDSM`
    }
    case 'host_weekly': {
      const s = data.stats
      const count = s?.hostedEvents ?? 0
      const people = s?.totalApproved ?? 0
      const rep = s?.reputationGained ?? 0
      return `過去這週我在 AkaAka 舉辦了 ${count} 場活動，共有 ${people} 位夥伴參與！感謝大家的支持，我的信譽積分提升了 ${rep} 分。我的主頁：${data.profileUrl ?? ''} #AkaAka`
    }
    case 'participant_review': {
      const s = data.stats
      const count = s?.eventsParticipated ?? 0
      const tags = data.tags && data.tags.length > 0 ? data.tags.join('、') : '多種'
      return `這段時間我在 AkaAka 參與了 ${count} 場精彩活動，探索了 ${tags} 等標籤。推薦大家這個安全透明的社群！我的主頁：${data.profileUrl ?? ''} #AkaAka`
    }
  }
}

export function ShareToXModal({ open, onClose, templateType, data }: ShareToXModalProps) {
  const { t } = useT()
  const [text, setText] = useState(() => generateTemplate(templateType, data))

  if (!open) return null

  const handlePostToX = () => {
    const url = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text)
    window.open(url, '_blank')
    onClose()
  }

  return (
    <>
      <div
        className="share-modal-overlay"
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--color-overlay)',
          zIndex: 999,
        }}
      />
      <div
        className="share-modal"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--color-surface)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          zIndex: 1000,
          width: '90%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{t('shareModal.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-muted)' }}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              cursor: 'pointer',
            }}
          >
            {t('shareModal.cancel')}
          </button>
          <button
            type="button"
            onClick={handlePostToX}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: 'var(--color-brand-x)',
              color: 'var(--color-text-on-primary)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {t('shareModal.postToX')}
          </button>
        </div>
      </div>
    </>
  )
}
