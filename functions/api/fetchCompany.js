// Cloudflare Pages Function — orginfo.uz orqali korxona ma'lumotlari
// Ma'lumot eski bo'lishi mumkin — foydalanuvchiga registr.stat.uz link beriladi

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const stir = url.searchParams.get('stir');

  if (!stir || stir.length < 5) {
    return jsonResp({ error: "STIR noto'g'ri" });
  }

  try {
    // 1-qadam: orginfo.uz da qidirish
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 12000);
    const searchResp = await fetch('https://orginfo.uz/search?q=' + encodeURIComponent(stir), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: ctrl1.signal
    });
    clearTimeout(t1);

    const searchHtml = await searchResp.text();
    const linkMatch = searchHtml.match(/\/(?:ru|uz)\/organization\/([a-z0-9]+)\//i);
    if (!linkMatch) {
      return jsonResp({ error: 'Korxona topilmadi' });
    }

    // 2-qadam: Korxona sahifasini ochish (/uz/ — o'zbekcha faoliyat nomi uchun)
    const orgPath = '/uz/organization/' + linkMatch[1] + '/';
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 12000);
    const orgResp = await fetch('https://orginfo.uz' + orgPath, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: ctrl2.signal
    });
    clearTimeout(t2);

    const orgHtml = await orgResp.text();

    // JSON-LD dan Organization topish
    const jsonLdBlocks = orgHtml.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (!jsonLdBlocks) {
      return jsonResp({ error: 'Ma\'lumot topilmadi' });
    }

    let jsonLd = null;
    for (const block of jsonLdBlocks) {
      const content = block.match(/>([\s\S]*?)<\/script>/i);
      if (content) {
        try {
          const parsed = JSON.parse(content[1]);
          if (parsed['@type'] === 'Organization') { jsonLd = parsed; break; }
        } catch (e) {}
      }
    }

    if (!jsonLd) {
      return jsonResp({ error: 'Ma\'lumot topilmadi' });
    }

    const addr = jsonLd.address || {};
    const locality = (addr.addressLocality || '').split(',');
    const viloyat = (locality[0] || '').trim();
    const tuman = (locality[1] || '').trim();

    // ОКЭД (faoliyat turi) ni HTML dan olish
    let faoliyat = '';
    const okedMatch = orgHtml.match(/<span>IFUT<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    if (okedMatch) {
      faoliyat = okedMatch[1].replace(/\s+/g, ' ').trim();
      const dashIdx = faoliyat.indexOf('-');
      if (dashIdx > 0) faoliyat = faoliyat.substring(dashIdx + 1).trim();
    }

    return jsonResp({
      nomi: jsonLd.legalName || jsonLd.name || '',
      rahbar: (jsonLd.employee && jsonLd.employee.name) || '',
      viloyat: viloyat,
      tuman: tuman,
      kocha: addr.streetAddress || '',
      manzil: ((addr.addressLocality || '') + ' ' + (addr.streetAddress || '')).trim(),
      telefon: jsonLd.telephone || '',
      inn: jsonLd.taxID || jsonLd.identifier || '',
      faollikHolati: jsonLd.status || '',
      faoliyat: faoliyat
    });
  } catch (e) {
    return jsonResp({ error: 'orginfo.uz ga ulanib bo\'lmadi' });
  }
}

function jsonResp(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
