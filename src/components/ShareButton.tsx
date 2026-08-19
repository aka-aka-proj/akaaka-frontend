import { useRef } from 'react'
import { useT } from '../hooks/useT'

export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const { t } = useT()
  const sharingRef = useRef(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (sharingRef.current) return

    sharingRef.current = true

    const eventData = { title, text, url }

    if (navigator.share) {
      try {
        await navigator.share(eventData)
        sharingRef.current = false
        return
      } catch (err) {
        sharingRef.current = false
        if ((err as Error).name === 'AbortError') return
        console.error('Error sharing:', err)
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      alert(t('events.shareLinkCopied'))
    } catch (err) {
      console.error('Failed to copy: ', err)
      alert(t('events.shareFailed'))
    } finally {
      sharingRef.current = false
    }
  }

  return (
    <button type="button" onClick={(e) => void handleShare(e)} className="share-button">
      {t('events.share')}
    </button>
  )
}
