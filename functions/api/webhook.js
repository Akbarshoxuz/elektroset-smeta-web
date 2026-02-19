// Cloudflare Pages Function — Telegram webhook proxy
// GAS 302 redirect muammosini hal qiladi
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwF5EvkZTQRd_GwZGvJiPdTjgNlqVmktvrqRKufgkErdKwHzemxuWi8woPul8RXsmvohA/exec';

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();

    // GAS ga yuborish (redirect kuzatib)
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      redirect: 'follow'
    });

    const text = await resp.text();
    return new Response(text, { status: 200 });
  } catch (err) {
    return new Response('OK', { status: 200 });
  }
}
