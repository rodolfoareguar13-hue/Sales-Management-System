const db = require('./database');
const { generarPDF } = require('./pdfGenerator');
const { generarExcel } = require('./excelGenerator');

module.exports = function(app) {
  
  // ==========================================
  //  PRODUCTOS
  // ==========================================
  
  // 1. Buscar productos (nombre, categoría o id — misma lógica que necesita el cliente)
  app.get('/api/productos/buscar', (req, res) => {
    const raw = String(req.query.q || '').trim();
    if (!raw) {
      return res.json([]);
    }
    if (!db) {
      return res.status(500).json({ error: 'Base de datos no disponible' });
    }
    const pattern = `%${raw.toLowerCase()}%`;
    try {
      const rows = db.prepare(
        `SELECT * FROM productos WHERE activo = 1 AND (
           LOWER(COALESCE(nombre, '')) LIKE ?
        OR LOWER(COALESCE(categoria, '')) LIKE ?
        OR CAST(id AS TEXT) LIKE ?
        )
         ORDER BY categoria, nombre LIMIT 25`
      ).all(pattern, pattern, pattern);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Obtener todos los productos
  app.get('/api/productos', (req, res) => {
    if (!db) {
      return res.status(500).json({ error: 'Base de datos no disponible' });
    }
    try {
      const rows = db.prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY categoria, nombre').all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Comprobación rápida: abre en el navegador http://localhost:3000/api/salud (con la app en marcha)
  app.get('/api/salud', (req, res) => {
    if (!db) {
      return res.status(503).json({ ok: false, error: 'Base de datos no inicializada' });
    }
    try {
      const activos = db.prepare('SELECT COUNT(*) AS n FROM productos WHERE activo = 1').get();
      const total = db.prepare('SELECT COUNT(*) AS n FROM productos').get();
      res.json({
        ok: true,
        base_datos: 'conectada',
        productos_activos: activos.n,
        productos_total: total.n
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });


  // ==========================================
  //  ESTADÍSTICAS Y METAS 
  //  (IMPORTANTE: Deben ir ANTES de /ventas/:id)
  // ==========================================

  // Estadísticas generales
  app.get('/api/ventas/estadisticas', (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    let sql = 'SELECT SUM(total) as total, COUNT(*) as cantidad FROM ventas WHERE 1=1';
    const params = [];

    if (fecha_inicio) {
      sql += ' AND DATE(fecha_hora) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ' AND DATE(fecha_hora) <= ?';
      params.push(fecha_fin);
    }

    try {
      const row = db.prepare(sql).get(...params);
      res.json({
        total: row.total || 0,
        cantidad: row.cantidad || 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Gráficos por día
  app.get('/api/ventas/por-dia', (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    let sql = `
      SELECT DATE(fecha_hora) as fecha, 
             SUM(total) as total,
             COUNT(*) as cantidad
      FROM ventas
      WHERE 1=1
    `;
    const params = [];

    if (fecha_inicio) {
      sql += ' AND DATE(fecha_hora) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ' AND DATE(fecha_hora) <= ?';
      params.push(fecha_fin);
    }

    sql += ' GROUP BY DATE(fecha_hora) ORDER BY fecha ASC';

    try {
      const rows = db.prepare(sql).all(...params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  //  REPORTES (PDF / Excel)
  //  (IMPORTANTE: Deben ir ANTES de /ventas/:id)
  // ==========================================

  app.get('/api/exportar/pdf', async (req, res) => {
    const { fecha_inicio, fecha_fin, tipo } = req.query;
    try {
      const pdfBuffer = await generarPDF(fecha_inicio, fecha_fin, tipo);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte.pdf');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/exportar/excel', async (req, res) => {
    const { fecha_inicio, fecha_fin, tipo } = req.query;
    try {
      const excelBuffer = await generarExcel(fecha_inicio, fecha_fin, tipo);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte.xlsx');
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  //  VENTAS CRUD
  // ==========================================

  // Crear nueva venta
  app.post('/api/ventas', (req, res) => {
    const { items, metodo_pago, observaciones } = req.body;
    
    if (!items || items.length === 0) return res.status(400).json({ error: 'Faltan items' });
    if (!metodo_pago) return res.status(400).json({ error: 'Falta método de pago' });

    const total = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    try {
      const realizarVenta = db.transaction((ventaItems) => {
        // Obtener fecha y hora local explícitamente para evitar problemas de zona horaria
        const fechaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' });
        
        const info = db.prepare(
          'INSERT INTO ventas (fecha_hora, total, metodo_pago, observaciones) VALUES (?, ?, ?, ?)'
        ).run(fechaLocal, total, metodo_pago, observaciones || null);
        
        const ventaId = info.lastInsertRowid;

        const insertItem = db.prepare(
          'INSERT INTO venta_items (venta_id, producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
        );

        for (const item of ventaItems) {
          insertItem.run(
            ventaId, 
            item.producto, 
            item.cantidad, 
            item.precio_unitario, 
            item.cantidad * item.precio_unitario
          );
        }
        return ventaId;
      });

      const ventaId = realizarVenta(items);
      res.json({ id: ventaId, total, message: 'Venta registrada correctamente' });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obtener lista de ventas (Filtros)
  app.get('/api/ventas', (req, res) => {
    const { fecha_inicio, fecha_fin, metodo_pago } = req.query;
    let sql = `
      SELECT v.*, 
        GROUP_CONCAT(vi.producto || ' x' || vi.cantidad) as items
      FROM ventas v
      LEFT JOIN venta_items vi ON v.id = vi.venta_id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_inicio) {
      sql += ' AND DATE(v.fecha_hora) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      sql += ' AND DATE(v.fecha_hora) <= ?';
      params.push(fecha_fin);
    }
    if (metodo_pago) {
      sql += ' AND v.metodo_pago = ?';
      params.push(metodo_pago);
    }

    sql += ' GROUP BY v.id ORDER BY v.fecha_hora DESC LIMIT 1000';

    try {
      const rows = db.prepare(sql).all(...params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // !!! AQUÍ ESTÁ EL CAMBIO CRÍTICO !!!
  // Esta ruta (/:id) captura cualquier cosa después de /ventas/
  // Por eso la movimos AL FINAL. Ahora 'estadisticas' caerá en su ruta propia arriba
  // y solo los números caerán aquí.
  
  // Obtener detalles de una venta
  app.get('/api/ventas/:id', (req, res) => {
    try {
      const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
      
      if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

      const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(req.params.id);
      
      res.json({ ...venta, items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Eliminar venta
  app.delete('/api/ventas/:id', (req, res) => {
    const ventaId = req.params.id;

    try {
      const eliminarVenta = db.transaction((id) => {
        db.prepare('DELETE FROM venta_items WHERE venta_id = ?').run(id);
        const info = db.prepare('DELETE FROM ventas WHERE id = ?').run(id);
        return info.changes;
      });

      const cambios = eliminarVenta(ventaId);

      if (cambios === 0) return res.status(404).json({ error: 'Venta no encontrada' });
      
      res.json({ message: 'Venta eliminada correctamente', id: ventaId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // ==========================================
  //  METAS (Gestión)
  // ==========================================

  // Obtener meta
  app.get('/api/meta', (req, res) => {
    try {
      let meta = db.prepare('SELECT * FROM metas WHERE activa = 1 ORDER BY id DESC LIMIT 1').get();

      if (!meta) {
        const inicioSemana = getInicioSemana();
        const info = db.prepare('INSERT INTO metas (meta_semanal, fecha_inicio, activa) VALUES (?, ?, 1)')
                       .run(600000, inicioSemana);
        meta = db.prepare('SELECT * FROM metas WHERE id = ?').get(info.lastInsertRowid);
      }
      
      const datosProgreso = calcularProgreso(meta);
      res.json(datosProgreso);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Actualizar meta
  app.put('/api/meta', (req, res) => {
    const { meta_semanal } = req.body;
    if (!meta_semanal || meta_semanal <= 0) return res.status(400).json({ error: 'Meta inválida' });

    try {
      const actualizarMeta = db.transaction(() => {
        db.prepare('UPDATE metas SET activa = 0').run();
        const inicioSemana = getInicioSemana();
        const info = db.prepare('INSERT INTO metas (meta_semanal, fecha_inicio, activa) VALUES (?, ?, 1)')
                       .run(meta_semanal, inicioSemana);
        return info.lastInsertRowid;
      });

      const nuevaId = actualizarMeta();
      res.json({ id: nuevaId, message: 'Meta actualizada correctamente' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // ==========================================
  //  IMPORTACIÓN DE VENTAS
  // ==========================================

  // Importar ventas desde Excel
  app.post('/api/importar/ventas', (req, res) => {
    const { ventas } = req.body;
    
    if (!ventas || !Array.isArray(ventas)) {
      return res.status(400).json({ error: 'Formato de datos inválido' });
    }

    try {
      const resultados = {
        exitosos: 0,
        errores: 0,
        detalles: []
      };

      const importarVentas = db.transaction((ventasArray) => {
        for (const ventaData of ventasArray) {
          try {
            // Validar datos mínimos
            if (!ventaData.fecha_hora || !ventaData.total || !ventaData.metodo_pago) {
              resultados.errores++;
              resultados.detalles.push({
                fila: ventaData.fila || 'N/A',
                error: 'Faltan datos obligatorios (fecha, total, método de pago)',
                datos: ventaData
              });
              continue;
            }

            // Validar método de pago
            const metodosValidos = ['Efectivo', 'Tarjeta', 'Simple Móvil'];
            if (!metodosValidos.includes(ventaData.metodo_pago)) {
              resultados.errores++;
              resultados.detalles.push({
                fila: ventaData.fila || 'N/A',
                error: `Método de pago inválido: ${ventaData.metodo_pago}`,
                datos: ventaData
              });
              continue;
            }

            // Insertar venta
            const info = db.prepare(
              'INSERT INTO ventas (fecha_hora, total, metodo_pago, observaciones) VALUES (?, ?, ?, ?)'
            ).run(
              ventaData.fecha_hora,
              parseFloat(ventaData.total),
              ventaData.metodo_pago,
              ventaData.observaciones || null
            );

            const ventaId = info.lastInsertRowid;

            // Insertar items si existen
            if (ventaData.items && Array.isArray(ventaData.items)) {
              const insertItem = db.prepare(
                'INSERT INTO venta_items (venta_id, producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
              );

              for (const item of ventaData.items) {
                if (item.producto && item.cantidad && item.precio_unitario) {
                  insertItem.run(
                    ventaId,
                    item.producto,
                    parseInt(item.cantidad),
                    parseFloat(item.precio_unitario),
                    parseFloat(item.subtotal || (item.cantidad * item.precio_unitario))
                  );
                }
              }
            }

            resultados.exitosos++;
            resultados.detalles.push({
              fila: ventaData.fila || 'N/A',
              exito: true,
              venta_id: ventaId,
              mensaje: 'Venta importada correctamente'
            });

          } catch (error) {
            resultados.errores++;
            resultados.detalles.push({
              fila: ventaData.fila || 'N/A',
              error: error.message,
              datos: ventaData
            });
          }
        }
      });

      importarVentas(ventas);

      res.json({
        mensaje: 'Proceso de importación completado',
        resultados: {
          exitosos: resultados.exitosos,
          errores: resultados.errores,
          detalles: resultados.detalles
        }
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  //  HELPERS
  // ==========================================

  function getInicioSemana() {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
    const lunes = new Date(hoy.setDate(diff));
    return lunes.toISOString().split('T')[0];
  }

  function calcularProgreso(meta) {
    const inicioSemana = meta.fecha_inicio || getInicioSemana();
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 6);
    
    const fechaInicio = inicioSemana;
    const fechaFin = finSemana.toISOString().split('T')[0];

    const row = db.prepare(
      `SELECT SUM(total) as total FROM ventas 
       WHERE DATE(fecha_hora) >= ? AND DATE(fecha_hora) <= ?`
    ).get(fechaInicio, fechaFin);

    const totalVendido = row.total || 0;
    const porcentaje = (totalVendido / meta.meta_semanal) * 100;
    const restante = Math.max(0, meta.meta_semanal - totalVendido);

    return {
      ...meta,
      total_vendido: totalVendido,
      porcentaje: porcentaje.toFixed(2),
      restante: restante,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    };
  }
};