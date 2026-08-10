import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useT } from '../hooks/useT'

interface ProfileShareModalProps {
  profileUrl: string
  profileName: string
  onClose: () => void
  onMessage: (message: string) => void
}

export function ProfileShareModal({ profileUrl, profileName, onClose, onMessage }: ProfileShareModalProps) {
  const { t } = useT()
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(profileUrl, { width: 240, margin: 2 })
      .then((url) => { if (active) setQrCodeUrl(url) })
      .catch(() => onMessage(t('profile.shareQrFailed')))
    return () => { active = false }
  }, [profileUrl, onMessage, t])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
      onMessage(t('profile.shareLinkCopied'))
    } catch {
      onMessage(t('profile.shareFailed'))
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: profileName, text: t('profile.shareText'), url: profileUrl })
        return
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
      }
    }
    await copyLink()
  }

  return (
    <div className="profile-share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="profile-share-modal" role="dialog" aria-modal="true" aria-labelledby="profile-share-title">
        <div className="profile-share-heading">
          <h3 id="profile-share-title">{t('profile.shareTitle')}</h3>
          <button type="button" className="btn-quiet" onClick={onClose} aria-label={t('profile.closeShare')}>×</button>
        </div>
        {qrCodeUrl ? <img className="profile-share-qr" src={qrCodeUrl} alt={t('profile.shareQrAlt', { name: profileName })} /> : <p>{t('profile.shareQrLoading')}</p>}
        <p className="profile-share-url">{profileUrl}</p>
        <div className="profile-share-actions">
          <button type="button" onClick={() => void share()}>{t('profile.share')}</button>
          <button type="button" className="btn-secondary" onClick={() => void copyLink()}>{t('profile.copyProfileLink')}</button>
        </div>
      </div>
    </div>
  )
}
