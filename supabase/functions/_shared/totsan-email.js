export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function optionalRow(label, value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  return `
    <tr>
      <td style="padding:10px 0; color:#647487; font-size:13px; line-height:20px; border-bottom:1px solid #dbe6ef;">${escapeHtml(label)}</td>
      <td align="right" style="padding:10px 0 10px 16px; color:#102033; font-size:13px; line-height:20px; font-weight:bold; border-bottom:1px solid #dbe6ef;">${escapeHtml(text)}</td>
    </tr>
  `
}

export function buildInquiryEmail(record) {
  const name = escapeHtml(record.name)
  const rawContact = String(record.contact ?? '').trim()
  const replyHref = rawContact.includes('@')
    ? `mailto:${rawContact}`
    : `tel:${rawContact.replace(/[^\d+]/g, '')}`
  const replyButton = rawContact
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
        <tr>
          <td align="center" bgcolor="#244766" style="border-radius:18px;">
            <a href="${escapeHtml(replyHref)}" style="display:inline-block; padding:15px 26px; border-radius:18px; background:#244766; color:#ffffff; font-size:15px; line-height:20px; font-weight:bold; text-decoration:none;">Отговори</a>
          </td>
        </tr>
      </table>
    `
    : ''
  const message = escapeHtml(record.message)

  return `
    <!doctype html>
    <html lang="bg">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title>Ново запитване в Totsan</title>
      </head>
      <body style="margin:0; padding:0; background:#eef4f8; font-family:Arial, Helvetica, sans-serif; color:#102033;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; line-height:1px;">
          Ново запитване от ${name}.
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef4f8; padding:34px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px; max-width:100%;">
                <tr>
                  <td align="center" style="padding:0 0 18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff; border:1px solid #dbe6ef; border-radius:999px;">
                      <tr>
                        <td style="padding:13px 20px;">
                          <img src="https://totsan.com/email/totsan-design-dark.png" width="154" alt="Totsan Design" style="display:block; width:154px; max-width:154px; height:auto; border:0;">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="background:#ffffff; border:1px solid #d6e1eb; border-radius:30px; overflow:hidden; box-shadow:0 26px 70px rgba(16,32,51,0.12);">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:34px 38px 30px; background:#102033;">
                          <p style="margin:0 0 12px; color:#a8bdd1; font-size:12px; line-height:18px; font-weight:bold; letter-spacing:1.8px; text-transform:uppercase;">Totsan inquiry</p>
                          <h1 style="margin:0; color:#ffffff; font-family:Georgia, 'Times New Roman', serif; font-size:38px; line-height:42px; font-weight:700;">Ново запитване</h1>
                          <p style="margin:16px 0 0; color:#d8e4ef; font-size:16px; line-height:26px;">${name} очаква следваща стъпка.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:34px 38px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fa; border:1px solid #dbe6ef; border-radius:24px;">
                            <tr>
                              <td style="padding:22px 22px 18px;">
                                <p style="margin:0 0 12px; color:#647487; font-size:12px; line-height:18px; font-weight:bold; letter-spacing:1.6px; text-transform:uppercase;">Детайли</p>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  ${optionalRow('Име', record.name)}
                                  ${optionalRow('Контакт', record.contact)}
                                  ${optionalRow('Тема', record.route_label)}
                                  ${optionalRow('Източник', record.source)}
                                  ${optionalRow('Слой', record.layer_slug)}
                                </table>
                              </td>
                            </tr>
                          </table>

                          <div style="margin:26px 0 0;">
                            <p style="margin:0 0 10px; color:#647487; font-size:12px; line-height:18px; font-weight:bold; letter-spacing:1.6px; text-transform:uppercase;">Съобщение</p>
                            <div style="white-space:pre-wrap; color:#26384d; font-size:15px; line-height:25px; background:#ffffff; border:1px solid #dbe6ef; border-radius:20px; padding:18px 20px;">${message}</div>
                          </div>

                          ${replyButton}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:22px 18px 0;">
                    <p style="margin:0; color:#647487; font-size:12px; line-height:19px;">Автоматично известие от Totsan.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
