import assert from 'node:assert/strict'
import test from 'node:test'

import { getAuthErrorMessage, getPasswordValidationError } from '../lib/auth-errors.ts'

test('signup password validation explains the eight-character minimum', () => {
  assert.equal(getPasswordValidationError('short'), '비밀번호는 8자 이상이어야 합니다.')
  assert.equal(getPasswordValidationError('long-enough'), null)
})

test('minimum-length auth errors explain the exact rejected length in Korean', () => {
  assert.equal(
    getAuthErrorMessage(
      { code: 'weak_password', message: 'Password should be at least 8 characters.' },
      'signup',
    ),
    '비밀번호는 8자 이상이어야 합니다.',
  )
})

test('leaked-password auth errors explain that the user must choose another password', () => {
  assert.equal(
    getAuthErrorMessage(
      {
        code: 'weak_password',
        message: 'Password is known to be weak and easy to guess. Please choose a different password.',
      },
      'signup',
    ),
    '많이 사용되었거나 유출된 비밀번호입니다. 다른 비밀번호를 사용해주세요.',
  )
})

test('duplicate signup errors direct the user to login or password reset', () => {
  assert.equal(
    getAuthErrorMessage({ code: 'user_already_exists', message: 'User already registered' }, 'signup'),
    '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해주세요.',
  )
})

test('rate-limit errors tell the user when to retry', () => {
  assert.equal(
    getAuthErrorMessage({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }, 'reset'),
    '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  )
})
