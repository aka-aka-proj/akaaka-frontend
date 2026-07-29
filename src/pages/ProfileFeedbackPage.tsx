import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import type { Recommendation } from '../types'

export function ProfileFeedbackPage() {
  const { id } = useParams()
  const { t } = useT()
  const [feedbacks, setFeedbacks] = useState<Partial<Recommendation>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!id) return
      setLoading(true)
      const { data, error } = await supabase
        .from('recommendations')
        .select('id, comment, created_at')
        .eq('to_profile_id', id)
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setFeedbacks(data || [])
      }
      setLoading(false)
    }

    void fetchFeedback()
  }, [id])

  return (
    <Layout>
      <section className="card">
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : error ? (
          <p className="message error">{error}</p>
        ) : feedbacks.length > 0 ? (
          <ul className="feedback-list" style={{ listStyle: 'none', padding: 0 }}>
            {feedbacks.map((feedback) => (
              <li key={feedback.id} className="feedback-item" style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem 0' }}>
                <p className="feedback-comment" style={{ margin: '0 0 0.5rem 0' }}>
                  {feedback.comment || t('events.noDescription')}
                </p>
                <time className="feedback-date" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {feedback.created_at ? new Date(feedback.created_at).toLocaleDateString() : ''}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('profile.noFeedback')}</p>
        )}
      </section>
    </Layout>
  )
}
