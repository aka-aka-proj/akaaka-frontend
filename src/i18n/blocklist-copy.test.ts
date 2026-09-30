import { expect, it } from 'vitest'
import zhTW from './zh-TW'

it('uses personal blocklist terminology throughout Traditional Chinese visible copy', () => {
  const text = JSON.stringify(zhTW)
  expect(text.includes('封鎖')).toBe(false)
  expect(zhTW.profile.block).toBe('加入黑名單')
  expect(zhTW.profile.unblock).toBe('從黑名單移除')
  expect(zhTW.blocklist.title).toBe('我的黑名單')
})
