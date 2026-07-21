import { useT } from '../hooks/useT'

export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const { t } = useT()

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()

    const eventData = { title, text, url }

    if (navigator.share) {
      try {
        await navigator.share(eventData)
        return
      } catch (err) {
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
    }
  }

  return (
    <button type="button" onClick={(e) => void handleShare(e)} className="share-button">
      {t('events.share')}
    </button>
  )
}
