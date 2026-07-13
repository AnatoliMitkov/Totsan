import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { User } from 'lucide-react'
import { loadChatClientProfile } from '../lib/projects.js'

export default function ChatClientProfile() {
  const { conversationId } = useParams()
  const [state, setState] = useState({ status: 'loading', shareId: '', error: '' })

  useEffect(() => {
    let active = true

    setState({ status: 'loading', shareId: '', error: '' })
    loadChatClientProfile(conversationId)
      .then((data) => {
        if (!active) return
        const shareId = data?.project?.publicShareId || data?.project?.public_share_id || ''
        if (!shareId) {
          setState({
            status: 'error',
            shareId: '',
            error: 'Проектът към този разговор не е намерен.',
          })
          return
        }
        setState({ status: 'ready', shareId, error: '' })
      })
      .catch(() => {
        if (!active) return
        setState({
          status: 'error',
          shareId: '',
          error: 'Нямаш достъп до този клиентски проект или връзката вече не е активна.',
        })
      })

    return () => {
      active = false
    }
  }, [conversationId])

  if (state.status === 'ready' && state.shareId) {
    return <Navigate to={`/proekt/${state.shareId}`} replace />
  }

  if (state.status === 'error') {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="container-page max-w-lg space-y-4 px-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <User size={32} />
          </div>
          <h1 className="font-display text-2xl text-ink">Недостъпен клиентски проект</h1>
          <p className="text-muted">{state.error}</p>
          <div className="pt-4">
            <Link to="/inbox" className="btn btn-primary">
              Към съобщенията
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
      <div className="text-sm text-muted">Отваряме проекта...</div>
    </section>
  )
}
