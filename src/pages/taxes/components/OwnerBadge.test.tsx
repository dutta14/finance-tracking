import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OwnerBadge from './OwnerBadge'

describe('OwnerBadge', () => {
  it('renders primary initial when no avatar provided', () => {
    render(<OwnerBadge owner="primary" primaryName="Alice" partnerName="Bob" />)
    expect(screen.getByTitle('Alice')).toHaveTextContent('A')
  })

  it('renders partner initial when no avatar provided', () => {
    render(<OwnerBadge owner="partner" primaryName="Alice" partnerName="Bob" />)
    expect(screen.getByTitle('Bob')).toHaveTextContent('B')
  })

  it('renders both initials for joint owner', () => {
    render(<OwnerBadge owner="joint" primaryName="Alice" partnerName="Bob" />)
    const group = screen.getByTitle('Joint')
    expect(group).toHaveTextContent('A')
    expect(group).toHaveTextContent('B')
  })

  it('renders primary avatar as img when provided', () => {
    const { container } = render(
      <OwnerBadge owner="primary" primaryName="Alice" partnerName="Bob" primaryAvatar="data:image/png;base64,a" />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,a')
  })

  it('renders partner avatar as img when provided', () => {
    const { container } = render(
      <OwnerBadge owner="partner" primaryName="Alice" partnerName="Bob" partnerAvatar="data:image/png;base64,b" />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,b')
  })

  it('renders both avatars as imgs for joint when provided', () => {
    const { container } = render(
      <OwnerBadge
        owner="joint"
        primaryName="Alice"
        partnerName="Bob"
        primaryAvatar="data:image/png;base64,a"
        partnerAvatar="data:image/png;base64,b"
      />,
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
  })

  it('falls back to P for empty primary name', () => {
    render(<OwnerBadge owner="primary" primaryName="" partnerName="" />)
    expect(screen.getByTitle('')).toHaveTextContent('P')
  })

  it('falls back to S for empty partner name', () => {
    render(<OwnerBadge owner="partner" primaryName="" partnerName="" />)
    expect(screen.getByTitle('')).toHaveTextContent('S')
  })
})
