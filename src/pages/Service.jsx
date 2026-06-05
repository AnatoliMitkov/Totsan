import { Navigate, useParams } from 'react-router-dom'

export default function Service() {
  const { slug = '' } = useParams()
  return <Navigate to={slug ? `/uslugi/${slug}` : '/uslugi'} replace />
}
