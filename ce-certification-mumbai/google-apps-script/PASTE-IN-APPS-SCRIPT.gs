/**
 * =============================================================================
 * CE CHENNAI + MUMBAI LANDINGS — paste this ENTIRE file into Apps Script (Code.gs)
 * =============================================================================
 *
 * 1. script.google.com → open the existing CE web app project (or New project)
 * 2. Replace Code.gs with this file → Save
 * 3. Run doGet once and approve Mail permissions
 * 4. Deploy → Manage deployments → Edit → Version: New version → Deploy
 *      Execute as: Me | Who has access: Anyone
 * 5. Keep the same Web app URL in both pages:
 *      window.CE_WEBAPP.url = ".../exec"
 *
 * Emails → damnart.seo@gmail.com
 *
 * Rules:
 *   FORM      → always emailed
 *               no gclid  → submitted form values only
 *               with gclid → form values + marketing attribution (gclid, UTMs, etc.)
 *   CALL / WA → email ONLY when gclid is present
 * =============================================================================
 */

var CONFIG = {
  NOTIFY_EMAIL: 'damnart.seo@gmail.com',
  SITE_LABEL_DEFAULT: 'CE Certification',
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
    JSON.stringify({
      ok: true,
      service: 'CE Certification Chennai + Mumbai',
      ts: new Date().toISOString(),
    })
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

function resolveSiteLabel_(payload) {
  var label = String((payload && payload.siteLabel) || '').trim();
  if (label) {
    return label;
  }
  var pageUrl = String(((payload && payload.meta) || {}).pageUrl || '').toLowerCase();
  if (pageUrl.indexOf('mumbai') !== -1) {
    return 'CE Certification Mumbai';
  }
  if (pageUrl.indexOf('chennai') !== -1) {
    return 'CE Certification Chennai';
  }
  return CONFIG.SITE_LABEL_DEFAULT;
}

function hasGclid_(attribution) {
  return Boolean(String((attribution && attribution.gclid) || '').trim());
}

function handleFormSubmit_(payload) {
  var form = payload.form || {};
  var attribution = normalizeAttribution_(payload.attribution || {});
  var meta = payload.meta || {};
  var siteLabel = resolveSiteLabel_(payload);
  var withAds = hasGclid_(attribution);

  if (isHoneypotTripped_(form)) {
    return;
  }

  var subject = buildFormSubject_(form, attribution, siteLabel, withAds);
  var htmlBody = buildFormEmailHtml_(form, attribution, meta, siteLabel, withAds);
  var plainBody = buildFormEmailPlain_(form, attribution, meta, siteLabel, withAds);

  var options = {
    htmlBody: htmlBody,
    name: siteLabel,
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
  if (!hasGclid_(attribution)) {
    return;
  }

  var meta = payload.meta || {};
  var siteLabel = resolveSiteLabel_(payload);
  var label = eventType === 'call' ? 'Call button click' : 'WhatsApp button click';
  var subject = '[Google Ads] ' + label + ' — ' + siteLabel;

  MailApp.sendEmail(
    CONFIG.NOTIFY_EMAIL,
    subject,
    buildClickEmailPlain_(label, attribution, meta, siteLabel),
    {
      htmlBody: buildClickEmailHtml_(label, attribution, meta, eventType, siteLabel),
      name: siteLabel,
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
  Object.keys(raw || {}).forEach(function (key) {
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

function buildFormSubject_(form, attribution, siteLabel, withAds) {
  var gclid = withAds ? ' [gclid]' : '';
  return (
    siteLabel +
    ' enquiry — ' +
    (form.product || 'Product') +
    ' — ' +
    (form.name || 'Unknown') +
    gclid
  );
}

function buildFormEmailHtml_(form, attribution, meta, siteLabel, withAds) {
  var html =
    '<h2>New CE marking enquiry</h2>' +
    '<p><strong>Site:</strong> ' +
    esc_(siteLabel) +
    '</p>' +
    section_(
      'Contact',
      rows_([
        ['Name', form.name],
        ['Company', form.company],
        ['Phone', form.phone],
        ['Email', form.email],
        ['Location', form.location],
      ])
    ) +
    section_(
      'Product',
      rows_([
        ['Category', form.category],
        ['Product name', form.product],
        ['Number of models', form.models],
        ['Export to Europe', form.export],
        ['Existing test reports', form.reports],
        ['Details', form.details],
      ])
    );

  if (withAds) {
    html += section_('Marketing attribution', attributionRows_(attribution));
    html += section_(
      'Meta',
      rows_([
        ['Submitted at (server)', new Date().toISOString()],
        ['User agent', meta.userAgent],
        ['Page', meta.pageUrl],
      ])
    );
  }

  return wrapHtml_(html, siteLabel);
}

function buildFormEmailPlain_(form, attribution, meta, siteLabel, withAds) {
  var lines = [
    'New CE marking enquiry',
    kv_('Site', siteLabel),
    '',
    kv_('Name', form.name),
    kv_('Company', form.company),
    kv_('Phone', form.phone),
    kv_('Email', form.email),
    kv_('Location', form.location),
    kv_('Category', form.category),
    kv_('Product', form.product),
    kv_('Models', form.models),
    kv_('Export', form.export),
    kv_('Reports', form.reports),
    kv_('Details', form.details),
  ];

  if (withAds) {
    lines.push('', attributionPlain_(attribution), '', kv_('Page', meta.pageUrl));
  }

  return lines.join('\n');
}

function buildClickEmailHtml_(label, attribution, meta, eventType, siteLabel) {
  var dest =
    eventType === 'call'
      ? 'tel:+919316012883'
      : 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER;

  return wrapHtml_(
    '<h2>' +
      esc_(label) +
      '</h2>' +
      '<p><strong>Site:</strong> ' +
      esc_(siteLabel) +
      '</p>' +
      '<p><strong>gclid present</strong> — notification sent per your rule.</p>' +
      '<p>Destination: ' +
      esc_(dest) +
      '</p>' +
      section_('Marketing attribution', attributionRows_(attribution)) +
      section_(
        'Meta',
        rows_([
          ['Clicked at (server)', new Date().toISOString()],
          ['Page', meta.pageUrl],
        ])
      ),
    siteLabel
  );
}

function buildClickEmailPlain_(label, attribution, meta, siteLabel) {
  return [
    label,
    kv_('Site', siteLabel),
    'gclid present — notification enabled',
    '',
    attributionPlain_(attribution),
    '',
    kv_('Page', meta.pageUrl),
  ].join('\n');
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

function wrapHtml_(inner, siteLabel) {
  return (
    '<div style="font-family:sans-serif;color:#111;line-height:1.5;">' +
    inner +
    '<p style="margin-top:24px;font-size:12px;color:#666;">' +
    esc_(siteLabel || CONFIG.SITE_LABEL_DEFAULT) +
    '</p></div>'
  );
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
