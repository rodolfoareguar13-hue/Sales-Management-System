const PDFDocument = require('pdfkit');
const db = require('./database');

async function generarPDF(fecha_inicio, fecha_fin, tipo = 'ventas') {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (tipo === 'meta') {
        generarPDFMeta(doc, fecha_inicio, fecha_fin);
      } else {
        generarPDFVentas(doc, fecha_inicio, fecha_fin);
      }
      
      // Finalizamos el documento aquí porque las consultas DB ahora son síncronas
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

function generarPDFVentas(doc, fecha_inicio, fecha_fin) {
  // Encabezado
  doc.fontSize(20).text('Reporte de Ventas', { align: 'center' });
  doc.moveDown();
  
  if (fecha_inicio || fecha_fin) {
    doc.fontSize(12).text(
      `Período: ${fecha_inicio || 'Inicio'} - ${fecha_fin || 'Hoy'}`,
      { align: 'center' }
    );
  } else {
    doc.fontSize(12).text('Todos los registros', { align: 'center' });
  }
  doc.moveDown(2);

  let query = `
    SELECT v.*, 
      GROUP_CONCAT(vi.producto || ' x' || vi.cantidad, '; ') as items
    FROM ventas v
    LEFT JOIN venta_items vi ON v.id = vi.venta_id
    WHERE 1=1
  `;
  const params = [];

  if (fecha_inicio) {
    query += ' AND DATE(v.fecha_hora) >= ?';
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    query += ' AND DATE(v.fecha_hora) <= ?';
    params.push(fecha_fin);
  }
  query += ' GROUP BY v.id ORDER BY v.fecha_hora DESC';

  // --- CONSULTA SÍNCRONA ---
  const ventas = db.prepare(query).all(...params);

  // Estadísticas
  let totalGeneral = 0;
  let cantidadVentas = ventas.length;
  ventas.forEach(v => totalGeneral += v.total);

  doc.fontSize(14).text('Resumen', { underline: true });
  doc.fontSize(12).text(`Total de ventas: ${cantidadVentas}`);
  doc.text(`Total vendido: ₡${totalGeneral.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`);
  doc.moveDown(2);

  // Tabla de ventas
  doc.fontSize(14).text('Detalle de Ventas', { underline: true });
  doc.moveDown();

  let y = doc.y;
  const pageWidth = doc.page.width - 100;
  const colWidths = {
    fecha: 120,
    total: 100,
    metodo: 100,
    items: pageWidth - 320
  };

  // Encabezados
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Fecha', 50, y);
  doc.text('Total', 50 + colWidths.fecha, y);
  doc.text('Método', 50 + colWidths.fecha + colWidths.total, y);
  doc.text('Items', 50 + colWidths.fecha + colWidths.total + colWidths.metodo, y);
  
  y += 20;
  doc.moveTo(50, y).lineTo(pageWidth + 50, y).stroke();
  y += 10;

  doc.font('Helvetica').fontSize(9);
  
  ventas.forEach((venta) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 50;
    }

    const fecha = new Date(venta.fecha_hora).toLocaleDateString('es-CR');
    const items = (venta.items || '').substring(0, 50) + (venta.items && venta.items.length > 50 ? '...' : '');

    doc.text(fecha, 50, y);
    doc.text(`₡${venta.total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, 50 + colWidths.fecha, y);
    doc.text(venta.metodo_pago, 50 + colWidths.fecha + colWidths.total, y);
    doc.text(items, 50 + colWidths.fecha + colWidths.total + colWidths.metodo, y, {
      width: colWidths.items
    });

    y += 20;
  });
}

function generarPDFMeta(doc, fecha_inicio, fecha_fin) {
  doc.fontSize(20).text('Reporte de Meta Semanal', { align: 'center' });
  doc.moveDown(2);

  const meta = db.prepare('SELECT * FROM metas WHERE activa = 1 ORDER BY id DESC LIMIT 1').get();

  if (!meta) {
    doc.text('No hay meta configurada');
    return;
  }

  const inicioSemana = meta.fecha_inicio || getInicioSemana();
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 6);

  const row = db.prepare(
    `SELECT SUM(total) as total FROM ventas 
     WHERE DATE(fecha_hora) >= ? AND DATE(fecha_hora) <= ?`
  ).get(inicioSemana, finSemana.toISOString().split('T')[0]);

  const totalVendido = row.total || 0;
  const porcentaje = (totalVendido / meta.meta_semanal) * 100;
  const restante = Math.max(0, meta.meta_semanal - totalVendido);

  doc.fontSize(14).text('Información de la Meta', { underline: true });
  doc.moveDown();
  doc.fontSize(12);
  doc.text(`Meta semanal: ₡${meta.meta_semanal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`);
  doc.text(`Total vendido: ₡${totalVendido.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`);
  doc.text(`Porcentaje cumplido: ${porcentaje.toFixed(2)}%`);
  doc.text(`Restante: ₡${restante.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`);
  doc.text(`Semana: ${inicioSemana} - ${finSemana.toISOString().split('T')[0]}`);
  doc.moveDown(2);

  // Gráfico simple de barras
  doc.fontSize(14).text('Progreso', { underline: true });
  doc.moveDown();
  const barWidth = 400;
  const barHeight = 30;
  const fillWidth = (totalVendido / meta.meta_semanal) * barWidth;
  
  doc.rect(50, doc.y, barWidth, barHeight).stroke();
  if (fillWidth > 0) {
    doc.rect(50, doc.y, Math.min(fillWidth, barWidth), barHeight).fill('#4CAF50');
  }
  doc.y += barHeight + 10;
}

function getInicioSemana() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(hoy.setDate(diff));
  return lunes.toISOString().split('T')[0];
}

module.exports = { generarPDF };