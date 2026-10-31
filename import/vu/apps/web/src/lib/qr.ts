/** QR data-URI helper shared by the TOTP enrolment panel. */
export function qrCodeSrc(qrCodeSvg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCodeSvg)}`;
}
