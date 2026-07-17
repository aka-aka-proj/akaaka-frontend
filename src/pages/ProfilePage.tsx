import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ReportForm } from '../components/ReportForm'
import { useAuth } from '../context/AuthContext'
import { canViewBio, getBioVisibility, normalizeSocialLinks } from '../lib/profile'
import { supabase } from '../supabaseClient'
import type { Profile, SocialLink, Visibility } from '../types'

const createSocialLink = (): SocialLink => ({ platform: 'facebook', url: '' })

function mapProfileRow(row: unknown): Profile {
  const source = (row ?? {}) as Record<string, unknown>
  return {
    id: String(source.id ?? ''),
    role_status: (source.role_status as Profile['role_status']) ?? 'general',
    display_name: (source.display_name as string | null) ?? null,
    bio: (source.bio as string | null) ?? null,
    external_social_links: normalizeSocialLinks(source.external_social_links),
    metadata: (source.metadata as Profile['metadata']) ?? null,
    reputation_score: Number(source.reputation_score ?? 0),
  }
}

export function ProfilePage() {
  const { id } = useParams()
  const { user, refreshProfile } = useAuth()
  const targetProfileId = id === undefined || id === 'me' ? user?.id ?? '' : id
  const isOwner = user?.id === targetProfileId
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [recommendComment, setRecommendComment] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [message, setMessage] = useState('')

  const bioVisibility = getBioVisibility(profile)
  const showBio = profile
    ? canViewBio(user?.id, profile.id, bioVisibility)
    : false

  const socialLinksForView = useMemo(
    () => socialLinks.filter((item) => item.url.trim().length > 0),
    [socialLinks],
  )

  const loadProfile = async () => {
    if (!targetProfileId) {
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetProfileId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      return
    }

    const mapped = data ? mapProfileRow(data) : null
    setProfile(mapped)
    setDisplayName(mapped?.display_name ?? '')
    setBio(mapped?.bio ?? '')
    setVisibility(getBioVisibility(mapped))
    setSocialLinks(mapped?.external_social_links ?? [createSocialLink()])

    if (user && targetProfileId) {
      const { data: blockData, error: blockError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetProfileId)
        .maybeSingle()

      if (blockError) {
        setMessage(blockError.message)
      } else {
        setIsBlocked(Boolean(blockData))
      }
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [targetProfileId, user?.id])

  const updateLink = (index: number, patch: Partial<SocialLink>) => {
    setSocialLinks((links) =>
      links.map((link, current) => (current === index ? { ...link, ...patch } : link)),
    )
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isOwner || !user) {
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        external_social_links: socialLinksForView,
        metadata: {
          visibility: {
            bio: visibility || 'public',
          },
        },
      })
      .eq('id', user.id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Profile updated.')
    await refreshProfile()
    await loadProfile()
  }

  const recommend = async () => {
    if (!user || !targetProfileId) {
      return
    }

    if (user.id === targetProfileId) {
      setMessage('You cannot recommend yourself.')
      return
    }

    const { error } = await supabase.functions.invoke('create-recommendation', {
      body: {
        to_profile_id: targetProfileId,
        comment: recommendComment.trim() || undefined,
      },
    })

    if (error) {
      const status = (error as { status?: number }).status
      if (status === 429) {
        setMessage('You can only recommend this person once every 24 hours.')
      } else {
        setMessage((error as { message?: string }).message ?? 'An error occurred.')
      }
      return
    }

    setRecommendComment('')
    setMessage('Recommendation submitted.')
    await loadProfile()
  }

  const toggleBlock = async () => {
    if (!user || !targetProfileId || user.id === targetProfileId) {
      return
    }

    if (isBlocked) {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetProfileId)
      if (error) {
        setMessage(error.message)
        return
      }

      setIsBlocked(false)
      setMessage('User unblocked.')
      return
    }

    const { error } = await supabase.from('blocks').insert([
      { blocker_id: user.id, blocked_id: targetProfileId },
    ])
    if (error) {
      setMessage(error.message)
      return
    }

    setIsBlocked(true)
    setMessage('User blocked.')
  }

  return (
    <Layout title="Profile">
      <section className="card">
        {profile ? (
          <>
            <h2>{profile.display_name || profile.id}</h2>
            <p>Role: {profile.role_status}</p>
            <p>Reputation: {profile.reputation_score}</p>
            <p>
              Bio:{' '}
              {showBio
                ? profile.bio || 'No bio set.'
                : `Hidden (${bioVisibility})`}
            </p>
            <ul>
              {profile.external_social_links.map((link) => (
                <li key={`${link.platform}-${link.url}`}>
                  {link.platform}: {link.url}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Profile not found.</p>
        )}
        {message ? <p className="message">{message}</p> : null}
      </section>

      {isOwner ? (
        <form className="card" onSubmit={saveProfile}>
          <h3>Edit profile</h3>
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
            <h4>Social links</h4>
            {socialLinks.map((link, index) => (
              <div className="row" key={`owner-social-${index}`}>
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
                  value={link.url}
                  placeholder="https://..."
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                />
              </div>
            ))}
            <button type="button" onClick={() => setSocialLinks((links) => [...links, createSocialLink()])}>
              Add social link
            </button>
          </section>
          <button type="submit">Save profile</button>
        </form>
      ) : (
        <section className="card">
          <h3>Trust actions</h3>
          <button
            type="button"
            onClick={() => void recommend()}
            disabled={user?.id === targetProfileId}
          >
            Give Recommendation
          </button>
          <textarea
            aria-label="Recommendation comment"
            placeholder="Optional recommendation comment"
            value={recommendComment}
            onChange={(event) => setRecommendComment(event.target.value)}
          />
          <button
            type="button"
            onClick={() => void toggleBlock()}
            disabled={user?.id === targetProfileId}
          >
            {isBlocked ? 'Unblock User' : 'Block User'}
          </button>
          {user?.id === targetProfileId ? (
            <p className="message">You cannot recommend yourself.</p>
          ) : null}
        </section>
      )}

      {!isOwner && targetProfileId ? <ReportForm targetProfileId={targetProfileId} /> : null}
    </Layout>
  )
}
