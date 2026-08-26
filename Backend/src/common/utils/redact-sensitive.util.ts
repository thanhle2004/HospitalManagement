const CONNECTION_STRING_PATTERN =
  /\b(mysql|postgres(?:ql)?):\/\/[^\s/@:]+:[^\s/@]+@/gi;
const SENSITIVE_FIELD_PATTERN =
  /((?:authorization|password|passphrase|secret|access[_-]?token|refresh[_-]?token|otp|codeHash)\s*[=:]\s*)(?:Bearer\s+[^\s,;]+|"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(CONNECTION_STRING_PATTERN, '$1://[REDACTED]@')
    .replace(SENSITIVE_FIELD_PATTERN, '$1[REDACTED]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]');
}
