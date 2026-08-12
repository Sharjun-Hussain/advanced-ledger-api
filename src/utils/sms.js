async function sendSms({ to, message }) {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    console.warn(`[SMS::stub] to=${to} -> ${message}`);
    return { delivered: false, stub: true };
  }
  // Example Dialog SMPP/HTTP integration point:
  // const url = `https://api.dialog.lk/sms/send?message=${encodeURIComponent(message)}&to=${encodeURIComponent(to)}&api_key=${apiKey}&sender_id=${process.env.SMS_SENDER_ID}`;
  // const res = await fetch(url);
  // return { delivered: res.ok, ...(await res.json()) };
  throw new Error('SMS provider not configured');
}

module.exports = { sendSms };
