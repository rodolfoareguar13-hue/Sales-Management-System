const ExcelJS = require('exceljs');
const db = require('./database');

async function generarExcel(fecha_inicio, fecha_fin, tipo = 'ventas') {
  const workbook = new ExcelJS.Workbook();
  
  // Como better-sqlite3 es síncrono, ya no necesitamos "await" para las consultas,
  // pero mantenemos la función async porque ExcelJS sí es asíncrono.
  if (tipo === 'meta') {
    generarExcelMeta(workbook, fecha_inicio, fecha_fin);
  } else {
    generarExcelVentas(workbook, fecha_inicio, fecha_fin);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function generarExcelVentas(workbook, fecha_inicio, fecha_fin) {
  const worksheet = workbook.addWorksheet('Ventas');

  // Encabezados
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Fecha y Hora', key: 'fecha_hora', width: 20 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Método de Pago', key: 'metodo_pago', width: 15 },
    { header: 'Observaciones', key: 'observaciones', width: 30 }
  ];

  let query = 'SELECT * FROM ventas WHERE 1=1';
  const params = [];

  if (fecha_inicio) {
    query += ' AND DATE(fecha_hora) >= ?';
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    query += ' AND DATE(fecha_hora) <= ?';
    params.push(fecha_fin);
  }
  query += ' ORDER BY fecha_hora DESC';

  // --- CAMBIO A BETTER-SQLITE3 ---
  const ventas = db.prepare(query).all(...params);

  // Agregar ventas
  ventas.forEach(venta => {
    worksheet.addRow({
      id: venta.id,
      fecha_hora: new Date(venta.fecha_hora).toLocaleString('es-CR'),
      total: venta.total,
      metodo_pago: venta.metodo_pago,
      observaciones: venta.observaciones || ''
    });
  });

  // Agregar fila de totales
  const totalRow = worksheet.addRow({});
  totalRow.getCell('metodo_pago').value = 'TOTAL:';
  totalRow.getCell('total').value = {
    formula: `SUM(C2:C${ventas.length + 1})`,
    result: ventas.reduce((sum, v) => sum + v.total, 0)
  };
  totalRow.font = { bold: true };
  worksheet.getColumn('total').numFmt = '#,##0.00';
  
  // Estilos
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' }
  };

  // --- HOJA DE ITEMS ---
  const itemsSheet = workbook.addWorksheet('Items de Ventas');
  itemsSheet.columns = [
    { header: 'ID Venta', key: 'venta_id', width: 10 },
    { header: 'Producto', key: 'producto', width: 40 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Precio Unitario', key: 'precio_unitario', width: 15 },
    { header: 'Subtotal', key: 'subtotal', width: 15 }
  ];

  let itemsQuery = `
    SELECT vi.*, v.fecha_hora 
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    WHERE 1=1
  `;
  const itemsParams = [];

  if (fecha_inicio) {
    itemsQuery += ' AND DATE(v.fecha_hora) >= ?';
    itemsParams.push(fecha_inicio);
  }
  if (fecha_fin) {
    itemsQuery += ' AND DATE(v.fecha_hora) <= ?';
    itemsParams.push(fecha_fin);
  }
  itemsQuery += ' ORDER BY v.fecha_hora DESC, vi.id';

  // Consulta Síncrona
  const items = db.prepare(itemsQuery).all(...itemsParams);

  items.forEach(item => {
    itemsSheet.addRow({
      venta_id: item.venta_id,
      producto: item.producto,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal
    });
  });

  itemsSheet.getColumn('precio_unitario').numFmt = '#,##0.00';
  itemsSheet.getColumn('subtotal').numFmt = '#,##0.00';
  itemsSheet.getRow(1).font = { bold: true };
  itemsSheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' }
  };
}

function generarExcelMeta(workbook, fecha_inicio, fecha_fin) {
  const worksheet = workbook.addWorksheet('Meta Semanal');

  worksheet.columns = [
    { header: 'Meta Semanal', key: 'meta', width: 20 },
    { header: 'Total Vendido', key: 'vendido', width: 20 },
    { header: 'Porcentaje', key: 'porcentaje', width: 15 },
    { header: 'Restante', key: 'restante', width: 20 },
    { header: 'Fecha Inicio', key: 'fecha_inicio', width: 15 },
    { header: 'Fecha Fin', key: 'fecha_fin', width: 15 }
  ];

  // Consultas Síncronas
  const meta = db.prepare('SELECT * FROM metas WHERE activa = 1 ORDER BY id DESC LIMIT 1').get();

  if (!meta) {
    worksheet.addRow({ meta: 'No hay meta configurada' });
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

  worksheet.addRow({
    meta: meta.meta_semanal,
    vendido: totalVendido,
    porcentaje: porcentaje.toFixed(2) + '%',
    restante: restante,
    fecha_inicio: inicioSemana,
    fecha_fin: finSemana.toISOString().split('T')[0]
  });

  worksheet.getColumn('meta').numFmt = '#,##0.00';
  worksheet.getColumn('vendido').numFmt = '#,##0.00';
  worksheet.getColumn('restante').numFmt = '#,##0.00';
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' }
  };
}

function getInicioSemana() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(hoy.setDate(diff));
  return lunes.toISOString().split('T')[0];
}

module.exports = { generarExcel };