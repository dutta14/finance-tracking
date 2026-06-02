import { FC } from 'react'
import type { TaxDocOwner } from '../types'

export interface OwnerBadgeProps {
  owner: TaxDocOwner
  primaryName: string
  partnerName: string
  primaryAvatar?: string
  partnerAvatar?: string
}

const OwnerBadge: FC<OwnerBadgeProps> = ({ owner, primaryName, partnerName, primaryAvatar, partnerAvatar }) => {
  const pi = (primaryName || 'P')[0].toUpperCase()
  const si = (partnerName || 'S')[0].toUpperCase()
  if (owner === 'joint') {
    return (
      <span className="tax-owner-group" title="Joint">
        <span className="tax-owner-avatar tax-owner-primary">
          {primaryAvatar ? <img src={primaryAvatar} alt="" /> : pi}
        </span>
        <span className="tax-owner-avatar tax-owner-partner">
          {partnerAvatar ? <img src={partnerAvatar} alt="" /> : si}
        </span>
      </span>
    )
  }
  const isPartner = owner === 'partner'
  return (
    <span
      className={`tax-owner-avatar ${isPartner ? 'tax-owner-partner' : 'tax-owner-primary'}`}
      title={isPartner ? partnerName : primaryName}
    >
      {isPartner ? (
        partnerAvatar ? (
          <img src={partnerAvatar} alt="" />
        ) : (
          si
        )
      ) : primaryAvatar ? (
        <img src={primaryAvatar} alt="" />
      ) : (
        pi
      )}
    </span>
  )
}

export default OwnerBadge
