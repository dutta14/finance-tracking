import { useEffect, type FC } from 'react'
import { useFlag } from './useFlag'
import { FLAGS } from './flagDefinitions'

export const ModernDesignToggle: FC = () => {
  const enabled = useFlag(FLAGS.MODERN_DESIGN)
  useEffect(() => {
    if (enabled) {
      document.body.classList.add('modern-design')
      // Load Inter font dynamically
      if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
        const preconnect1 = document.createElement('link')
        preconnect1.rel = 'preconnect'
        preconnect1.href = 'https://fonts.googleapis.com'
        document.head.appendChild(preconnect1)

        const preconnect2 = document.createElement('link')
        preconnect2.rel = 'preconnect'
        preconnect2.href = 'https://fonts.gstatic.com'
        preconnect2.crossOrigin = ''
        document.head.appendChild(preconnect2)

        const fontLink = document.createElement('link')
        fontLink.rel = 'stylesheet'
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
        document.head.appendChild(fontLink)
      }
    } else {
      document.body.classList.remove('modern-design')
    }
    return () => document.body.classList.remove('modern-design')
  }, [enabled])
  return null
}
