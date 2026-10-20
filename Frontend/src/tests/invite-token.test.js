import { describe, expect, it } from 'vitest'
import { inviteFromLocation } from '../utils/inviteToken'

describe('invitation links', () => {
  it('reads new fragment links and keeps legacy query links working', () => {
    expect(inviteFromLocation({ hash: '#invite=abc', search: '' })).toBe('abc')
    expect(inviteFromLocation({ hash: '', search: '?invite=legacy' })).toBe('legacy')
    expect(inviteFromLocation({ hash: '#invite=new', search: '?invite=old' })).toBe('new')
  })
})
