const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'LatinShop/1.0 (academic)' } }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function geocodificar(direccion, ciudad, codigoPostal) {
  const q = encodeURIComponent(`${direccion}, ${codigoPostal} ${ciudad}, España`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=es`;
  const result = await httpGet(url);
  if (Array.isArray(result) && result.length > 0) {
    return { lat: parseFloat(result[0].lat), lon: parseFloat(result[0].lon) };
  }
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { geocodificar, haversineKm };
