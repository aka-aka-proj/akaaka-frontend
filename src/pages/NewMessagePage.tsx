import { useSearchParams } from 'react-router-dom'
import { DirectChatPage } from './DirectChatPage'
import { UserSearchPage } from './UserSearchPage'

export function NewMessagePage() {
  const [searchParams] = useSearchParams()
  return searchParams.get('user') ? <DirectChatPage /> : <UserSearchPage />
}
