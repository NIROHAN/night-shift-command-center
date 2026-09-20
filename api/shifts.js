// Vercel Serverless Function: /api/shifts
// Supports Vercel KV / Upstash Redis or memory fallback

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // 1. Upstash Redis / Vercel KV Integration
  if (kvUrl && kvToken) {
    try {
      if (req.method === 'GET') {
        const response = await fetch(`${kvUrl}/get/night_shift_records`, {
          headers: { Authorization: `Bearer ${kvToken}` }
        });
        const data = await response.json();
        const shifts = data.result ? JSON.parse(data.result) : {};
        return res.status(200).json({ shifts });
      }

      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        let shiftsToSave = body.shifts;

        if (!shiftsToSave && body.dateKey && body.shift) {
          // Fetch existing to merge
          const existingRes = await fetch(`${kvUrl}/get/night_shift_records`, {
            headers: { Authorization: `Bearer ${kvToken}` }
          });
          const existingData = await existingRes.json();
          const cur = existingData.result ? JSON.parse(existingData.result) : {};
          cur[body.dateKey] = body.shift;
          shiftsToSave = cur;
        }

        if (shiftsToSave) {
          await fetch(`${kvUrl}/set/night_shift_records`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${kvToken}` },
            body: JSON.stringify(shiftsToSave)
          });
          return res.status(200).json({ success: true, count: Object.keys(shiftsToSave).length });
        }
      }
    } catch (err) {
      console.error("KV Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. Unconfigured response with guidance
  if (req.method === 'GET') {
    return res.status(200).json({
      shifts: null,
      message: "Serverless function active. Connect Vercel KV or use Firebase Firestore for cross-device shared persistence."
    });
  }

  return res.status(200).json({ success: false, message: "Storage not configured" });
}
