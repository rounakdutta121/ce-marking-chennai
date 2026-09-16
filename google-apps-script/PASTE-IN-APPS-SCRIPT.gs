/**
 * =============================================================================
 * CE CHENNAI LANDING — paste this ENTIRE file into Google Apps Script (Code.gs)
 * =============================================================================
 *
 * 1. script.google.com → New project → delete default code → paste all of this
 * 2. Run doGet once in the editor (Run) and approve Mail permissions when prompted
 * 3. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone   ← MUST be "Anyone", NOT "Anyone with Google account"
 * 4. Copy the Web app URL (ends in /exec) into index.html → window.CE_WEBAPP.url
 * 5. After code changes: Deploy → Manage deployments → Edit → New version → Deploy
 * 6. Test the URL in an incognito window — you should see {"ok":true,...} not "Access denied"
 *
 * Optional: Project settings → Script properties → WEBHOOK_SECRET = random string
 *            (same value in window.CE_WEBAPP.secret on the website)
 *
 * Emails go to: damnart.seo@gmail.com
 * Form: always emailed | Call & WhatsApp: only if gclid is present in attribution
 * =============================================================================
 */

var CONFIG = {
  NOTIFY_EMAIL: 'damnart.seo@gmail.com',
  SITE_LABEL: 'CE Certification Chennai',
  PHONE_DISPLAY: '+91 93160 12883',
  WHATSAPP_NUMBER: '919316012883',
};

var ATTRIBUTION_KEYS = [
  'gclid', 'gbraid', 'wbraid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'msclkid', 'dclid', 'ttclid', 'li_fat_id',
  'landing_page', 'referrer', 'page_url', 'first_touch_at', 'session_id',
];

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, service: CONFIG.SITE_LABEL, ts: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    assertAuthorized_(e);
    var payload = parseRequest_(e);
    var eventType = String(payload.eventType || 'form').toLowerCase();

    if (eventType === 'form') {
      handleFormSubmit_(payload);
    } else if (eventType === 'call' || eventType === 'whatsapp') {
      handleContactClick_(payload, eventType);
    } else {
      throw new Error('Unknown eventType: ' + eventType);
    }

    return json_({ ok: true });
  } catch (err) {
    Logger.log(err.stack || err);
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function handleFormSubmit_(payload) {
  var form = payload.form || {};
  var attribution = normalizeAttribution_(payload.attribution || {});
  var meta = payload.meta || {};

  if (isHoneypotTripped_(form)) {
    return;
  }

  var subject = buildFormSubject_(form, attribution);
  var htmlBody = buildFormEmailHtml_(form, attribution, meta);
  var plainBody = buildFormEmailPlain_(form, attribution, meta);

  var options = {
    htmlBody: htmlBody,
    name: CONFIG.SITE_LABEL,
  };

  var replyTo = safeEmail_(form.email);
  if (replyTo) {
    options.replyTo = replyTo;
  }

  var attachment = extractAttachment_(payload);
  if (attachment) {
    options.attachments = [attachment];
  }

  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, plainBody, options);
}

function handleContactClick_(payload, eventType) {
  var attribution = normalizeAttribution_(payload.attribution || {});
  var gclid = String(attribution.gclid || '').trim();
  if (!gclid) {
    return;
  }

  var meta = payload.meta || {};
  var label = eventType === 'call' ? 'Call button click' : 'WhatsApp button click';
  var subject = '[Google Ads] ' + label + ' — ' + CONFIG.SITE_LABEL;

  MailApp.sendEmail(
    CONFIG.NOTIFY_EMAIL,
    subject,
    buildClickEmailPlain_(label, attribution, meta, eventType),
    {
      htmlBody: buildClickEmailHtml_(label, attribution, meta, eventType),
      name: CONFIG.SITE_LABEL,
    }
  );
}

function parseRequest_(e) {
  if (!e) {
    throw new Error('Empty request');
  }

  if (e.parameter && e.parameter.payload) {
    return JSON.parse(String(e.parameter.payload));
  }

  if (e.postData && e.postData.contents) {
    var contents = String(e.postData.contents);
    var type = String(e.postData.type || '').toLowerCase();

    if (contents.charAt(0) === '{') {
      return JSON.parse(contents);
    }

    if (type.indexOf('application/x-www-form-urlencoded') !== -1 || contents.indexOf('payload=') !== -1) {
      var parsed = parseFormEncodedPayload_(contents);
      if (parsed) {
        return parsed;
      }
    }
  }

  throw new Error('Send JSON in POST body or form field "payload".');
}

function parseFormEncodedPayload_(contents) {
  var parts = contents.split('&');
  var i;
  for (i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq === -1) {
      continue;
    }
    var key = parts[i].substring(0, eq);
    if (key !== 'payload') {
      continue;
    }
    var value = parts[i].substring(eq + 1);
    value = decodeURIComponent(value.replace(/\+/g, ' '));
    return JSON.parse(value);
  }
  return null;
}

function assertAuthorized_(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!expected) {
    return;
  }

  var secret = '';
  if (e.parameter && e.parameter.payload) {
    try {
      secret = JSON.parse(String(e.parameter.payload)).secret || '';
    } catch (ignore) {}
  }
  if (!secret && e.postData && e.postData.contents) {
    try {
      var contents = String(e.postData.contents);
      if (contents.charAt(0) === '{') {
        secret = JSON.parse(contents).secret || '';
      } else {
        var parsed = parseFormEncodedPayload_(contents);
        if (parsed) {
          secret = parsed.secret || '';
        }
      }
    } catch (ignore) {}
  }
  if (secret !== expected) {
    throw new Error('Unauthorized');
  }
}

function normalizeAttribution_(raw) {
  var out = {};
  var i;
  for (i = 0; i < ATTRIBUTION_KEYS.length; i++) {
    var key = ATTRIBUTION_KEYS[i];
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      out[key] = String(raw[key]).trim();
    }
  }
  Object.keys(raw).forEach(function (key) {
    if (!out[key] && raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      out[key] = String(raw[key]).trim();
    }
  });
  return out;
}

function isHoneypotTripped_(form) {
  var honey = form._honey || form.honey || form._honeypot;
  return Boolean(honey && String(honey).trim());
}

function buildFormSubject_(form, attribution) {
  var gclid = attribution.gclid ? ' [gclid]' : '';
  return 'CE enquiry — ' + (form.product || 'Product') + ' — ' + (form.name || 'Unknown') + gclid;
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
        ['Page', meta.pageUrl],
      ]))
  );
}

function buildFormEmailPlain_(form, attribution, meta) {
  return [
    'New CE marking enquiry',
    '',
    kv_('Name', form.name),
    kv_('Company', form.company),
    kv_('Phone', form.phone),
    kv_('Email', form.email),
    kv_('Location', form.location),
    kv_('Category', form.category),
    kv_('Product', form.product),
    kv_('Export', form.export),
    kv_('Reports', form.reports),
    kv_('Details', form.details),
    '',
    attributionPlain_(attribution),
    '',
    kv_('Page', meta.pageUrl),
  ].join('\n');
}

function buildClickEmailHtml_(label, attribution, meta, eventType) {
  var dest =
    eventType === 'call'
      ? 'tel:+919316012883'
      : 'https://wa.me/919316012883';

  return wrapHtml_(
    '<h2>' + esc_(label) + '</h2>' +
      '<p><strong>gclid present</strong></p>' +
      '<p>Destination: ' + esc_(dest) + '</p>' +
      section_('Marketing attribution', attributionRows_(attribution)) +
      section_('Meta', rows_([
        ['Clicked at (server)', new Date().toISOString()],
        ['Page', meta.pageUrl],
      ]))
  );
}

function buildClickEmailPlain_(label, attribution, meta) {
  return [label, '', attributionPlain_(attribution), '', kv_('Page', meta.pageUrl)].join('\n');
}

function extractAttachment_(payload) {
  var file = payload.attachment;
  if (!file || !file.data || !file.name) {
    return null;
  }
  return Utilities.newBlob(
    Utilities.base64Decode(file.data),
    file.mimeType || 'application/octet-stream',
    file.name
  );
}

function safeEmail_(value) {
  var email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function section_(title, inner) {
  return '<h3 style="margin:24px 0 8px;">' + esc_(title) + '</h3>' + inner;
}

function rows_(pairs) {
  var html = '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">';
  pairs.forEach(function (pair) {
    html +=
      '<tr><td style="border:1px solid #ddd;background:#f7f7f7;font-weight:600;">' +
      esc_(pair[0]) +
      '</td><td style="border:1px solid #ddd;">' +
      esc_(pair[1] || '') +
      '</td></tr>';
  });
  return html + '</table>';
}

function attributionRows_(attribution) {
  var keys = Object.keys(attribution);
  if (!keys.length) {
    return rows_([['(none)', '—']]);
  }
  return rows_(
    keys.map(function (key) {
      return [key, attribution[key]];
    })
  );
}

function attributionPlain_(attribution) {
  var keys = Object.keys(attribution);
  if (!keys.length) {
    return 'Marketing: (none)';
  }
  return keys
    .map(function (key) {
      return kv_(key, attribution[key]);
    })
    .join('\n');
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
    '<div style="font-family:sans-serif;color:#111;line-height:1.5;">' +
    inner +
    '<p style="margin-top:24px;font-size:12px;color:#666;">' +
    esc_(CONFIG.SITE_LABEL) +
    '</p></div>'
  );
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
