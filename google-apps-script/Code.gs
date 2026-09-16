/**
 * CE Chennai landing — form + marketing attribution + ad click alerts
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → New deployment
 *   Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Optional Script property (Project settings → Script properties):
 *   WEBHOOK_SECRET = your-random-string
 *
 * POST JSON body shape:
 *   { "eventType": "form" | "call" | "whatsapp", "secret": "...", "attribution": {...}, "form": {...}, "meta": {...} }
 */

const CONFIG = {
  NOTIFY_EMAIL: 'damnart.seo@gmail.com',
  SITE_LABEL: 'CE Certification Chennai',
  PHONE_DISPLAY: '+91 93160 12883',
  WHATSAPP_NUMBER: '919316012883',
};

const ATTRIBUTION_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'msclkid',
  'dclid',
  'ttclid',
  'li_fat_id',
  'landing_page',
  'referrer',
  'page_url',
  'first_touch_at',
  'session_id',
];

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, service: CONFIG.SITE_LABEL, ts: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    assertAuthorized_(e);
    const payload = parseRequest_(e);
    const eventType = String(payload.eventType || 'form').toLowerCase();

    if (eventType === 'form') {
      handleFormSubmit_(payload);
    } else if (eventType === 'call' || eventType === 'whatsapp') {
      handleContactClick_(payload, eventType);
    } else {
      throw new Error('Unknown eventType: ' + eventType);
    }

    return json_( { ok: true } );
  } catch (err) {
    Logger.log(err.stack || err);
    return json_( { ok: false, error: String(err.message || err) }, 400 );
  }
}

function handleFormSubmit_(payload) {
  const form = payload.form || {};
  const attribution = normalizeAttribution_(payload.attribution || {});
  const meta = payload.meta || {};

  if (isHoneypotTripped_(form)) {
    return;
  }

  const subject = buildFormSubject_(form, attribution);
  const htmlBody = buildFormEmailHtml_(form, attribution, meta);
  const plainBody = buildFormEmailPlain_(form, attribution, meta);

  const options = {
    htmlBody: htmlBody,
    name: CONFIG.SITE_LABEL,
    replyTo: safeEmail_(form.email) || undefined,
  };

  const attachment = extractAttachment_(payload);
  if (attachment) {
    options.attachments = [attachment];
  }

  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, plainBody, options);
}

function handleContactClick_(payload, eventType) {
  const attribution = normalizeAttribution_(payload.attribution || {});
  const gclid = String(attribution.gclid || '').trim();

  if (!gclid) {
    return;
  }

  const meta = payload.meta || {};
  const label = eventType === 'call' ? 'Call button click' : 'WhatsApp button click';
  const subject = '[Google Ads] ' + label + ' — ' + CONFIG.SITE_LABEL;
  const htmlBody = buildClickEmailHtml_(label, attribution, meta, eventType);
  const plainBody = buildClickEmailPlain_(label, attribution, meta, eventType);

  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, plainBody, {
    htmlBody: htmlBody,
    name: CONFIG.SITE_LABEL,
  });
}

function parseRequest_(e) {
  if (!e) {
    throw new Error('Empty request');
  }

  if (e.parameter && e.parameter.payload) {
    return JSON.parse(String(e.parameter.payload));
  }

  if (e.postData && e.postData.contents) {
    const contents = String(e.postData.contents);
    const type = String(e.postData.type || '').toLowerCase();

    if (contents.charAt(0) === '{') {
      return JSON.parse(contents);
    }

    if (type.includes('application/x-www-form-urlencoded') || contents.includes('payload=')) {
      const parsed = parseFormEncodedPayload_(contents);
      if (parsed) {
        return parsed;
      }
    }
  }

  if (e.parameter && e.parameter.eventType) {
    return flattenParameters_(e.parameter);
  }

  throw new Error('Send JSON in POST body or form field "payload".');
}

function parseFormEncodedPayload_(contents) {
  const parts = contents.split('&');
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    const key = parts[i].substring(0, eq);
    if (key !== 'payload') continue;
    let value = parts[i].substring(eq + 1);
    value = decodeURIComponent(value.replace(/\+/g, ' '));
    return JSON.parse(value);
  }
  return null;
}

function flattenParameters_(params) {
  const payload = {
    eventType: params.eventType,
    secret: params.secret,
    meta: {},
    attribution: {},
    form: {},
  };

  Object.keys(params).forEach((key) => {
    if (key.indexOf('attr_') === 0) {
      payload.attribution[key.slice(5)] = params[key];
    } else if (key.indexOf('form_') === 0) {
      payload.form[key.slice(5)] = params[key];
    } else if (key.indexOf('meta_') === 0) {
      payload.meta[key.slice(5)] = params[key];
    }
  });

  return payload;
}

function assertAuthorized_(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!expected) {
    return;
  }

  let secret = '';
  if (e.postData && e.postData.contents) {
    try {
      secret = JSON.parse(e.postData.contents).secret || '';
    } catch (ignore) {}
  }
  if (!secret && e.parameter) {
    secret = e.parameter.secret || '';
  }

  if (secret !== expected) {
    throw new Error('Unauthorized');
  }
}

function normalizeAttribution_(raw) {
  const out = {};
  ATTRIBUTION_KEYS.forEach((key) => {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      out[key] = String(raw[key]).trim();
    }
  });
  Object.keys(raw).forEach((key) => {
    if (!out[key] && raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      out[key] = String(raw[key]).trim();
    }
  });
  return out;
}

function isHoneypotTripped_(form) {
  const honey = form._honey || form.honey || form._honeypot;
  return Boolean(honey && String(honey).trim());
}

function buildFormSubject_(form, attribution) {
  const name = esc_(form.name || 'Unknown');
  const product = esc_(form.product || 'Product');
  const gclid = attribution.gclid ? ' [gclid]' : '';
  return 'CE enquiry — ' + product + ' — ' + name + gclid;
}

function buildFormEmailHtml_(form, attribution, meta) {
  return wrapHtml_(
    '<h2>New CE marking enquiry</h2>' +
      section_('Contact', rows_([
        ['Name', form.name],
        ['Company', form.company],
        ['Phone', form.phone],
        ['Email', form.email],
        ['Location', form.location],
      ])) +
      section_('Product', rows_([
        ['Category', form.category],
        ['Product name', form.product],
        ['Export to Europe', form.export],
        ['Existing test reports', form.reports],
        ['Details', form.details],
      ])) +
      section_('Marketing attribution', attributionRows_(attribution)) +
      section_('Meta', rows_([
        ['Submitted at (server)', new Date().toISOString()],
        ['User agent', meta.userAgent],
        ['IP (client-reported)', meta.clientIp],
        ['Page', meta.pageUrl],
      ]))
  );
}

function buildFormEmailPlain_(form, attribution, meta) {
  return [
    'New CE marking enquiry',
    '',
    '--- Contact ---',
    kv_('Name', form.name),
    kv_('Company', form.company),
    kv_('Phone', form.phone),
    kv_('Email', form.email),
    kv_('Location', form.location),
    '',
    '--- Product ---',
    kv_('Category', form.category),
    kv_('Product name', form.product),
    kv_('Export', form.export),
    kv_('Reports', form.reports),
    kv_('Details', form.details),
    '',
    '--- Marketing ---',
    attributionPlain_(attribution),
    '',
    '--- Meta ---',
    kv_('Submitted', new Date().toISOString()),
    kv_('Page', meta.pageUrl),
    kv_('User agent', meta.userAgent),
  ].join('\n');
}

function buildClickEmailHtml_(label, attribution, meta, eventType) {
  const dest =
    eventType === 'call'
      ? 'tel:' + CONFIG.PHONE_DISPLAY.replace(/\s/g, '')
      : 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER;

  return wrapHtml_(
    '<h2>' + esc_(label) + '</h2>' +
      '<p><strong>gclid present</strong> — notification sent per your rule.</p>' +
      '<p>Destination: <a href="' + esc_(dest) + '">' + esc_(dest) + '</a></p>' +
      section_('Marketing attribution', attributionRows_(attribution)) +
      section_('Meta', rows_([
        ['Clicked at (server)', new Date().toISOString()],
        ['Page', meta.pageUrl],
        ['User agent', meta.userAgent],
      ]))
  );
}

function buildClickEmailPlain_(label, attribution, meta, eventType) {
  return [
    label,
    'gclid present — notification enabled',
    '',
    '--- Marketing ---',
    attributionPlain_(attribution),
    '',
    '--- Meta ---',
    kv_('Clicked', new Date().toISOString()),
    kv_('Page', meta.pageUrl),
  ].join('\n');
}

function extractAttachment_(payload) {
  const file = payload.attachment;
  if (!file || !file.data || !file.name) {
    return null;
  }

  const bytes = Utilities.base64Decode(file.data);
  const blob = Utilities.newBlob(bytes, file.mimeType || 'application/octet-stream', file.name);
  return blob;
}

function safeEmail_(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function section_(title, inner) {
  return '<h3 style="margin:24px 0 8px;font-family:sans-serif;">' + esc_(title) + '</h3>' + inner;
}

function rows_(pairs) {
  var html = '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">';
  pairs.forEach(function (pair) {
    html +=
      '<tr><td style="border:1px solid #ddd;background:#f7f7f7;font-weight:600;">' +
      esc_(pair[0]) +
      '</td><td style="border:1px solid #ddd;">' +
      esc_(pair[1] || '') +
      '</td></tr>';
  });
  html += '</table>';
  return html;
}

function attributionRows_(attribution) {
  const keys = Object.keys(attribution);
  if (!keys.length) {
    return rows_([['(none)', '—']]);
  }
  return rows_(keys.map(function (key) {
    return [key, attribution[key]];
  }));
}

function attributionPlain_(attribution) {
  const keys = Object.keys(attribution);
  if (!keys.length) {
    return '(none)';
  }
  return keys.map(function (key) {
    return kv_(key, attribution[key]);
  }).join('\n');
}

function kv_(key, value) {
  return key + ': ' + String(value === undefined || value === null ? '' : value);
}

function esc_(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapHtml_(inner) {
  return (
    '<div style="font-family:sans-serif;color:#111;line-height:1.5;max-width:720px;">' +
    inner +
    '<p style="margin-top:24px;font-size:12px;color:#666;">' +
    esc_(CONFIG.SITE_LABEL) +
    ' · Apps Script webhook</p></div>'
  );
}

function json_(obj, statusCode) {
  const out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
  return out;
}
