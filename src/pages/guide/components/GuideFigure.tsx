import { FC } from 'react'

interface GuideFigureProps {
  src: string
  alt: string
  loading?: 'eager' | 'lazy'
}

const GuideFigure: FC<GuideFigureProps> = ({ src, alt, loading = 'lazy' }) => (
  <figure className="guide-figure">
    <img className="guide-figure-image" src={src} alt={alt} loading={loading} />
  </figure>
)

export default GuideFigure
