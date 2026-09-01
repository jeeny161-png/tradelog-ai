import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCaptchaAuthOptions,
  getCaptchaSubmissionError,
} from '../lib/auth-captcha.ts'

test('auth requests include the verified Turnstile token', () => {
  assert.deepEqual(getCaptchaAuthOptions('verified-token'), {
    captchaToken: 'verified-token',
  })
})

test('auth submission waits until Turnstile verification is complete', () => {
  assert.equal(
    getCaptchaSubmissionError('site-key', null),
    '보안 확인 중입니다. 잠시 후 다시 시도해주세요.',
  )
})

test('missing public site key is reported as a configuration problem', () => {
  assert.equal(
    getCaptchaSubmissionError(undefined, 'verified-token'),
    '보안 확인 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.',
  )
})

test('verified Turnstile state allows auth submission', () => {
  assert.equal(getCaptchaSubmissionError('site-key', 'verified-token'), null)
})
