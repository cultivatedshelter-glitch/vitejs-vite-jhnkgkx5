import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type GalleryPhoto = {
  name: string
  path: string
  url: string
}

const BUCKET = 'job-files'
const PHOTO_FOLDER = 'photos'

export default function Gallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(false)

  async function loadGallery() {
    setLoading(true)

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(PHOTO_FOLDER, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) throw error

      const imageFiles = (data || []).filter((file) =>
        /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)
      )

      const signedPhotos: GalleryPhoto[] = []

      for (const file of imageFiles) {
        const path = `${PHOTO_FOLDER}/${file.name}`

        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60)

        if (!signedError && signedData?.signedUrl) {
          signedPhotos.push({
            name: file.name,
            path,
            url: signedData.signedUrl,
          })
        }
      }

      setPhotos(signedPhotos)
    } catch (err) {
      console.error(err)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGallery()
  }, [])

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Project Gallery</h2>
          <p style={textStyle}>
            Recently uploaded job photos from Shelter Prep requests.
          </p>
        </div>

        <button style={buttonStyle} onClick={loadGallery}>
          {loading ? 'Loading...' : 'Refresh Gallery'}
        </button>
      </div>

      {photos.length === 0 && !loading && (
        <div style={emptyStyle}>
          No gallery photos yet. Uploaded job photos will appear here.
        </div>
      )}

      <div style={gridStyle}>
        {photos.map((photo) => (
          <div key={photo.path} style={photoCardStyle}>
            <img src={photo.url} alt={photo.name} style={imageStyle} />
            <div style={captionStyle}>{photo.name}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 24,
  padding: 24,
  border: '1px solid #d7dfd3',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  color: '#173425',
}

const textStyle: React.CSSProperties = {
  color: '#5f6f63',
  fontSize: 16,
}

const buttonStyle: React.CSSProperties = {
  background: '#0f542d',
  color: 'white',
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  fontWeight: 800,
  cursor: 'pointer',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginTop: 20,
}

const photoCardStyle: React.CSSProperties = {
  borderRadius: 18,
  overflow: 'hidden',
  border: '1px solid #d7dfd3',
  background: '#eef3ea',
}

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: 220,
  objectFit: 'cover',
  display: 'block',
}

const captionStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 13,
  color: '#173425',
  fontWeight: 700,
  wordBreak: 'break-word',
}

const emptyStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 24,
  borderRadius: 18,
  background: '#eef3ea',
  color: '#0f542d',
  fontWeight: 800,
}
