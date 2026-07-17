import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import type { SocialLink, Visibility } from '../types'

const createSocialLink = (): SocialLink => ({ platform: 'facebook', url: '' })

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [agreed, setAgreed] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([createSocialLink()])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateLink = (index: number, patch: Partial<SocialLink>) => {
    setSocialLinks((links) =>
      links.map((link, current) => (index === current ? { ...link, ...patch } : link)),
    )
  }

  const addLink = () => {
    setSocialLinks((links) => [...links, createSocialLink()])
  }

  const removeLink = (index: number) => {
    setSocialLinks((links) => links.filter((_link, current) => current !== index))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setMessage('Please sign in first.')
      return
    }

    if (!agreed) {
      setMessage('You must agree to the safety compact.')
      return
    }

    const sanitizedLinks = socialLinks.filter((link) => link.url.trim().length > 0)
    if (sanitizedLinks.length === 0) {
      setMessage('Add at least one external social link to continue.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        external_social_links: sanitizedLinks,
        metadata: {
          visibility: {
            bio: visibility || 'public',
          },
        },
      },
      { onConflict: 'id' },
    )
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    await refreshProfile()
    navigate('/events', { replace: true })
  }

  return (
    <Layout title="Onboarding">
      <form className="card" onSubmit={submit}>
        <label className="checkbox">
          <input
            aria-label="Agree to safety compact"
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          I agree to the AkaAka safety compact.
        </label>
        <label>
          Display name
          <input
            aria-label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          Bio
          <textarea
            aria-label="Bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
        <label>
          Bio visibility
          <select
            aria-label="Bio visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            <option value="public">public</option>
            <option value="connections_only">connections_only</option>
            <option value="private">private</option>
          </select>
        </label>
        <section>
          <h3>External social links</h3>
          {socialLinks.map((link, index) => (
            <div key={`social-link-${index}`} className="row">
              <select
                aria-label={`Social platform ${index + 1}`}
                value={link.platform}
                onChange={(event) =>
                  updateLink(index, {
                    platform: event.target.value as SocialLink['platform'],
                  })
                }
              >
                <option value="facebook">facebook</option>
                <option value="instagram">instagram</option>
                <option value="x">x</option>
              </select>
              <input
                aria-label={`Social url ${index + 1}`}
                placeholder="https://..."
                value={link.url}
                onChange={(event) => updateLink(index, { url: event.target.value })}
              />
              <button type="button" onClick={() => removeLink(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addLink}>
            Add social link
          </button>
        </section>
        <button type="submit" disabled={submitting}>
          Complete onboarding
        </button>
        {message ? <p className="message">{message}</p> : null}
      </form>
    </Layout>
  )
}
