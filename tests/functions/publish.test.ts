// Lives outside functions/: Cloudflare Pages bundles every file in there.
import { describe, expect, it } from 'vitest'
import { authorise, roleForCode } from '../../functions/publish'

// Made-up PINs for the test only — the real ones live in Cloudflare secrets.
const env = { CLUB_PUBLISH_CODE: 'test-coach', SAFEGUARDING_PIN: 'test-safeguarding' }

describe('roleForCode', () => {
  it('maps each PIN to its role', () => {
    expect(roleForCode('test-coach', env)).toBe('coach')
    expect(roleForCode('test-safeguarding', env)).toBe('safeguarding')
    expect(roleForCode('test-wrong', env)).toBeNull()
    expect(roleForCode('', env)).toBeNull()
    expect(roleForCode(undefined, env)).toBeNull()
  })
  it('has no safeguarding role when the secret is unset', () => {
    expect(roleForCode('', { CLUB_PUBLISH_CODE: 'test-coach' })).toBeNull()
    expect(roleForCode('test-safeguarding', { CLUB_PUBLISH_CODE: 'test-coach' })).toBeNull()
  })
})

describe('authorise', () => {
  it('leaves coach publishing as it was', () => {
    expect(authorise('coach', {})).toBeNull()
    expect(authorise('coach', { collection: 'fixtures' })).toBeNull()
  })
  it('lets coaches file injuries and start, not update, a protocol', () => {
    expect(authorise('coach', { folder: 'safeguarding', subfolder: 'injuries' })).toBeNull()
    expect(authorise('coach', { folder: 'safeguarding', subfolder: 'concussions', createOnly: true })).toBeNull()
    expect(authorise('coach', { folder: 'safeguarding', subfolder: 'concussions' })).not.toBeNull()
    expect(authorise('coach', { folder: 'safeguarding', subfolder: 'injuries', delete: true })).not.toBeNull()
  })
  it('keeps the safeguarding PIN to the safeguarding folder', () => {
    expect(authorise('safeguarding', { folder: 'safeguarding', subfolder: 'concussions' })).toBeNull()
    expect(authorise('safeguarding', { folder: 'safeguarding', subfolder: 'injuries', delete: true })).toBeNull()
    expect(authorise('safeguarding', {})).not.toBeNull()
    expect(authorise('safeguarding', { collection: 'matches' })).not.toBeNull()
    expect(authorise('safeguarding', { folder: 'safeguarding', subfolder: 'other' })).not.toBeNull()
  })
})
