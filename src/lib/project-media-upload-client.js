import { uploadMediaViaEdge } from './profile-media-upload-client.js'

export async function uploadProjectMedia({ file, projectId = '', kind = 'photo' }) {
  return uploadMediaViaEdge({
    file,
    purpose: 'project',
    projectId,
    kind,
  })
}