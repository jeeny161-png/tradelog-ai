export type AuthAction = 'signup' | 'login' | 'reset' | 'update-password'

type AuthErrorLike = {
  code?: string
  message?: string
  reasons?: string[]
  status?: number
}

export const PASSWORD_MIN_LENGTH = 8

export function getPasswordValidationError(password: string): string | null {
  if (!password) return '비밀번호를 입력하세요.'
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  }
  return null
}

export function getAuthErrorMessage(error: AuthErrorLike, action: AuthAction): string {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  const minimumLength = error.message?.match(/at least\s+(\d+)\s+characters?/i)?.[1]
  if (minimumLength) return `비밀번호는 ${minimumLength}자 이상이어야 합니다.`

  const isLeakedPassword =
    message.includes('known to be weak') ||
    message.includes('easy to guess') ||
    message.includes('leaked password') ||
    error.reasons?.some((reason) => /pwned|leaked|guess/i.test(reason))
  if (isLeakedPassword) {
    return '많이 사용되었거나 유출된 비밀번호입니다. 다른 비밀번호를 사용해주세요.'
  }

  if (code === 'weak_password') {
    return `비밀번호가 보안 기준을 충족하지 않습니다. ${PASSWORD_MIN_LENGTH}자 이상의 다른 비밀번호를 사용해주세요.`
  }

  if (
    code === 'user_already_exists' ||
    code === 'user_already_registered' ||
    message.includes('already registered') ||
    message.includes('already exists')
  ) {
    return '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해주세요.'
  }

  if (code.includes('rate_limit') || message.includes('rate limit') || error.status === 429) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  }

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 받은편지함의 인증 메일을 확인해주세요.'
  }

  if (code === 'captcha_failed' || message.includes('captcha')) {
    return '보안 확인에 실패했습니다. 화면의 인증을 완료한 뒤 다시 시도해주세요.'
  }

  if (code === 'signup_disabled') return '현재 회원가입이 일시적으로 중단되었습니다.'

  if (message.includes('invalid email') || code === 'email_address_invalid') {
    return '이메일 주소 형식을 확인해주세요.'
  }

  const fallbackByAction: Record<AuthAction, string> = {
    signup: '회원가입을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.',
    login: '로그인하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.',
    reset: '재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.',
    'update-password': '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.',
  }
  return fallbackByAction[action]
}
