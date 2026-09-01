export const CAPTCHA_WAITING_MESSAGE = '보안 확인 중입니다. 잠시 후 다시 시도해주세요.'
export const CAPTCHA_CONFIGURATION_MESSAGE =
  '보안 확인 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.'

export function getCaptchaAuthOptions(captchaToken: string) {
  return { captchaToken }
}

export function getCaptchaSubmissionError(
  siteKey: string | undefined,
  captchaToken: string | null,
): string | null {
  if (!siteKey) return CAPTCHA_CONFIGURATION_MESSAGE
  if (!captchaToken) return CAPTCHA_WAITING_MESSAGE
  return null
}
