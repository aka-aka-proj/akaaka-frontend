import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { ConversationSidebar } from '../components/ConversationSidebar'
import { useT } from '../hooks/useT'

export function MessagesPage() {
  const { t } = useT()

  return <Layout>
    <section className="messages-workspace card">
      <ConversationSidebar />
      <section className="chat-placeholder" aria-label={t('messages.title')}>
        <div className="chat-placeholder-content">
          <span className="chat-placeholder-icon" aria-hidden="true">✉</span>
          <h2>{t('messages.selectConversation')}</h2>
          <p>{t('messages.selectConversationDescription')}</p>
          <Link to="/messages/new" className="primary-action">{t('messages.startConversation')}</Link>
        </div>
      </section>
    </section>
  </Layout>
}
