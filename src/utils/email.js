const nodemailer = require('nodemailer');

// ── Transporter ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── Helper: enviar email ─────────────────────────────────────────────────────
async function enviarEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP no configurado — email no enviado:', subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'LatinShop España'}" <${process.env.FROM_EMAIL || 'noreply@latinshop.es'}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error('[email] Error al enviar:', err.message);
  }
}

// ── Estilos base compartidos ────────────────────────────────────────────────
const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 0;
`;

const CARD_STYLE = `
  max-width: 560px;
  margin: 32px auto;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
`;

const HEADER_STYLE = `
  background: linear-gradient(135deg, #991b1b, #b91c1c);
  padding: 28px 32px;
  text-align: center;
`;

const BODY_STYLE = `padding: 32px;`;

const FOOTER_STYLE = `
  background: #f9fafb;
  padding: 16px 32px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  border-top: 1px solid #e5e7eb;
`;

const BTN_STYLE = `
  display: inline-block;
  margin: 20px 0;
  padding: 14px 28px;
  background: #991b1b;
  color: #ffffff !important;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 15px;
`;

function layout(contenido, pie = '') {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="${BASE_STYLES}">
      <div style="${CARD_STYLE}">
        <div style="${HEADER_STYLE}">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:-0.5px;">LatinShop España</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Marketplace de productos latinos</p>
        </div>
        <div style="${BODY_STYLE}">
          ${contenido}
        </div>
        <div style="${FOOTER_STYLE}">
          ${pie || 'Este correo ha sido generado automáticamente. Por favor no respondas a este mensaje.'}
          <br>© ${new Date().getFullYear()} LatinShop España
        </div>
      </div>
    </body>
    </html>
  `;
}

// ── Plantillas ───────────────────────────────────────────────────────────────

function htmlResetPassword(nombre, enlace) {
  return layout(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Recuperar contraseña</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#374151;line-height:1.7;">
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
      Haz clic en el botón de abajo para crear una nueva contraseña.
    </p>
    <div style="text-align:center;">
      <a href="${enlace}" style="${BTN_STYLE}">Restablecer contraseña</a>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
      Este enlace caduca en <strong>1 hora</strong>. Si no solicitaste el cambio, ignora este correo.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;font-size:12px;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <a href="${enlace}" style="color:#991b1b;word-break:break-all;">${enlace}</a>
    </p>
  `);
}

function htmlConfirmacionPedido(nombre, pedido) {
  const filas = pedido.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${item.nombre_producto}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151;">${item.cantidad}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;">${Number(item.precio_unitario).toFixed(2)} €</td>
    </tr>
  `).join('');

  return layout(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">¡Pedido confirmado!</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#374151;line-height:1.7;">
      Tu pedido <strong>${pedido.numero_pedido}</strong> ha sido recibido correctamente
      y está siendo procesado por la tienda.
    </p>

    <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;color:#6b7280;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Producto</th>
            <th style="text-align:center;padding-bottom:8px;color:#6b7280;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Cantidad</th>
            <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Precio</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <table style="width:100%;margin-top:12px;">
        <tr><td style="color:#6b7280;font-size:13px;">Subtotal</td><td style="text-align:right;color:#374151;">${Number(pedido.subtotal).toFixed(2)} €</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;">Envío</td><td style="text-align:right;color:#374151;">${Number(pedido.costo_envio).toFixed(2)} €</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;">IVA (21%)</td><td style="text-align:right;color:#374151;">${Number(pedido.iva).toFixed(2)} €</td></tr>
        <tr>
          <td style="color:#111827;font-weight:700;font-size:15px;padding-top:8px;border-top:2px solid #e5e7eb;">Total</td>
          <td style="text-align:right;color:#991b1b;font-weight:700;font-size:15px;padding-top:8px;border-top:2px solid #e5e7eb;">${Number(pedido.total).toFixed(2)} €</td>
        </tr>
      </table>
    </div>

    <p style="color:#374151;font-size:13px;">
      <strong>Dirección de envío:</strong> ${pedido.direccion_envio}, ${pedido.ciudad_envio}<br>
      <strong>Método de pago:</strong> ${pedido.metodo_pago}
    </p>
  `, `Puedes consultar el estado de tu pedido en <a href="${process.env.FRONTEND_URL}/cliente/pedidos" style="color:#991b1b;">tu panel de cliente</a>.`);
}

function htmlNuevoPedidoTienda(nombreTienda, pedido) {
  const filas = pedido.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${item.nombre_producto}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151;">${item.cantidad}</td>
    </tr>
  `).join('');

  return layout(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Nuevo pedido recibido</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Hola <strong>${nombreTienda}</strong>,</p>
    <p style="color:#374151;line-height:1.7;">
      Has recibido un nuevo pedido: <strong>${pedido.numero_pedido}</strong>
    </p>

    <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px;"><strong>Cliente:</strong> ${pedido.cliente_nombre} — ${pedido.cliente_email}</p>
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px;"><strong>Envío a:</strong> ${pedido.direccion_envio}, ${pedido.ciudad_envio}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;color:#6b7280;font-size:12px;border-bottom:2px solid #e5e7eb;">Producto</th>
            <th style="text-align:center;padding-bottom:8px;color:#6b7280;font-size:12px;border-bottom:2px solid #e5e7eb;">Cantidad</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="text-align:right;color:#991b1b;font-weight:700;font-size:15px;margin:12px 0 0;">Total: ${Number(pedido.total).toFixed(2)} €</p>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL}/tienda/pedidos" style="${BTN_STYLE}">Ver pedidos</a>
    </div>
  `);
}

function htmlCambioEstadoPedido(nombre, pedido, nuevoEstado) {
  const etiquetas = {
    CONFIRMADO:     { texto: 'Pedido confirmado',      color: '#059669', icono: '✅' },
    EN_PREPARACION: { texto: 'En preparación',         color: '#d97706', icono: '📦' },
    ENVIADO:        { texto: 'Pedido enviado',          color: '#2563eb', icono: '🚚' },
    ENTREGADO:      { texto: 'Pedido entregado',        color: '#059669', icono: '🎉' },
    CANCELADO:      { texto: 'Pedido cancelado',        color: '#dc2626', icono: '❌' }
  };

  const info = etiquetas[nuevoEstado] || { texto: nuevoEstado, color: '#374151', icono: '📋' };

  return layout(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Actualización de tu pedido</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Hola <strong>${nombre}</strong>,</p>

    <div style="background:#f9fafb;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
      <div style="font-size:36px;margin-bottom:8px;">${info.icono}</div>
      <p style="margin:0;font-size:18px;font-weight:700;color:${info.color};">${info.texto}</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Pedido <strong>${pedido.numero_pedido}</strong></p>
    </div>

    <p style="color:#374151;line-height:1.7;">
      Tu pedido ha cambiado al estado <strong style="color:${info.color};">${info.texto}</strong>.
    </p>
  `, `Consulta el detalle en <a href="${process.env.FRONTEND_URL}/cliente/pedidos" style="color:#991b1b;">tu panel de cliente</a>.`);
}

// ── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  enviarEmail,
  htmlResetPassword,
  htmlConfirmacionPedido,
  htmlNuevoPedidoTienda,
  htmlCambioEstadoPedido
};
