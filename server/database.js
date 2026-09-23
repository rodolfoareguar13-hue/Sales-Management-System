// ==========================
//   DATABASE.JS FINAL
// ==========================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/** Copia SQLite y archivos -wal / -shm si existen. */
function copySqliteBundle(fromFile, toFile) {
    const pairs = [
        [fromFile, toFile],
        [`${fromFile}-wal`, `${toFile}-wal`],
        [`${fromFile}-shm`, `${toFile}-shm`]
    ];
    for (const [from, to] of pairs) {
        if (fs.existsSync(from)) {
            fs.copyFileSync(from, to);
        }
    }
}

// 1. Rutas
//    - Desarrollo: data/ventas.db (como siempre).
//    - Instalador (.exe): userData/ventas.db → NO se borra al actualizar (no vive en Program Files).
//    - Primera vez: si existe la BD vieja en resources/database.sqlite, se copia a userData.
let dbPath;

if (app && app.isPackaged) {
    const userDataDir = app.getPath('userData');
    dbPath = path.join(userDataDir, 'ventas.db');
    const legacyPath = path.join(process.resourcesPath, 'database.sqlite');

    if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
        try {
            copySqliteBundle(legacyPath, dbPath);
            console.log('BD copiada de la instalación anterior a:', dbPath);
        } catch (err) {
            console.error('No se pudo copiar BD antigua desde resources:', err);
        }
    }
} else {
    dbPath = path.join(__dirname, '..', 'data', 'ventas.db');
}

console.log("Conectando a BD en:", dbPath);

// 2. Crear carpeta si no existe
const dbFolder = path.dirname(dbPath);
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

// 3. Conexión
let db;
try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeDatabase();
} catch (err) {
    console.error("ERROR CRÍTICO AL ABRIR DB:", err);
}


// ==========================================
//   CREACIÓN DE TABLAS Y DATOS INICIALES
// ==========================================

function initializeDatabase() {

    // Tabla productos
    db.prepare(`CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        precio REAL NOT NULL,
        categoria TEXT,
        activo INTEGER DEFAULT 1
    )`).run();

    // Tabla ventas
    db.prepare(`CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        total REAL NOT NULL,
        metodo_pago TEXT NOT NULL,
        observaciones TEXT
    )`).run();

    // Tabla items de venta
    db.prepare(`CREATE TABLE IF NOT EXISTS venta_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (venta_id) REFERENCES ventas(id)
    )`).run();

    // Tabla metas
    db.prepare(`CREATE TABLE IF NOT EXISTS metas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meta_semanal REAL NOT NULL DEFAULT 600000,
        fecha_inicio DATE,
        activa INTEGER DEFAULT 1
    )`).run();

    // Insertar meta inicial si no existe
    const metas = db.prepare('SELECT COUNT(*) as count FROM metas WHERE activa = 1').get();
    if (metas.count === 0) {
        db.prepare(`
            INSERT INTO metas (meta_semanal, fecha_inicio, activa)
            VALUES (?, ?, 1)
        `).run(600000, getInicioSemana());
    }

    // Insertar productos si está vacío
    const row = db.prepare('SELECT COUNT(*) as count FROM productos').get();
    if (row.count === 0) {
        insertProductosIniciales();
    } else {
        const activos = db.prepare('SELECT COUNT(*) as count FROM productos WHERE activo = 1').get();
        if (activos.count === 0) {
            db.prepare('UPDATE productos SET activo = 1').run();
            console.log('Catálogo: productos reactivados (todos estaban inactivos).');
        }
    }
}


// ==========================================
//   FUNCIONES AUXILIARES
// ==========================================

function getInicioSemana() {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
    const lunes = new Date(hoy.setDate(diff));
    return lunes.toISOString().split('T')[0];
}


// ==========================================
//   INSERCIÓN DE PRODUCTOS INICIALES
// ==========================================

function insertProductosIniciales() {

    const productos = [
        // Pupusas de Carnes
        { nombre: 'Mixta (Chicharrón, Frijol y Queso)', precio: 1700, categoria: 'Pupusas de Carnes' },
        { nombre: 'Pollo con Queso', precio: 1700, categoria: 'Pupusas de Carnes' },
        { nombre: 'Chicharrón con Queso', precio: 1700, categoria: 'Pupusas de Carnes' },
        { nombre: 'Jamón con Queso', precio: 1700, categoria: 'Pupusas de Carnes' },
        { nombre: 'Carne Mechada con Queso', precio: 2200, categoria: 'Pupusas de Carnes' },
        { nombre: 'Solo Chicharrón', precio: 2100, categoria: 'Pupusas de Carnes' },
        { nombre: 'Frijol y Chicharrón', precio: 1700, categoria: 'Pupusas de Carnes' },
        { nombre: 'Super Loca', precio: 3000, categoria: 'Pupusas de Carnes' },
        { nombre: 'Hawaiana (Jamón/Queso/Piña)', precio: 1700, categoria: 'Pupusas de Carnes' },

        // Vegetarianas
        { nombre: 'Frijol con Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Espinaca con Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Queso con Hongos', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Jalapeño con Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Ayote Tierno con Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Chile Dulce con Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Queso con Ajo', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Albahaca con Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Solo Queso', precio: 1700, categoria: 'Pupusas Vegetarianas' },
        { nombre: 'Solo Frijol', precio: 1700, categoria: 'Pupusas Vegetarianas' },

        // Especiales
        { nombre: 'Pupusas Veganas', precio: 2300, categoria: 'Pupusas Especiales' },
        { nombre: 'Super Pupusa Loca', precio: 3000, categoria: 'Pupusas Especiales' },
        { nombre: 'Pupusas Keto', precio: 2500, categoria: 'Pupusas Especiales' },

        // Comidas Rápidas
        { nombre: 'Hamburguesas Sencilla', precio: 2000, categoria: 'Comidas Rápidas' },
        { nombre: 'Hamburguesa Doble', precio: 3000, categoria: 'Comidas Rápidas' },
        { nombre: 'Hot Dogs', precio: 1000, categoria: 'Comidas Rápidas' },
        { nombre: 'Tacos', precio: 1000, categoria: 'Comidas Rápidas' },
        { nombre: 'Sandwich de Carne Mechada', precio: 2000, categoria: 'Comidas Rápidas' },
        { nombre: 'Salchipapas', precio: 2500, categoria: 'Comidas Rápidas' },
        { nombre: 'Papas Fritas', precio: 1000, categoria: 'Comidas Rápidas' },
        { nombre: 'Empanadas de Maduro', precio: 700, categoria: 'Comidas Rápidas' },
        { nombre: 'Quesadilla Salvadoreña', precio: 600, categoria: 'Comidas Rápidas' },

        // Bebidas Naturales
        { nombre: 'Horchata', precio: 1000, categoria: 'Bebidas Naturales' },
        { nombre: 'Té Frío', precio: 1000, categoria: 'Bebidas Naturales' },
        { nombre: 'Cebada', precio: 1000, categoria: 'Bebidas Naturales' },
        { nombre: 'Kolashanpan', precio: 1000, categoria: 'Bebidas Naturales' },

        // Promociones
        { nombre: 'Promo Compra 4 Lleva 5', precio: 7250, categoria: 'Promociones' },
        { nombre: 'Six Pack (6 Pupusas)', precio: 9000, categoria: 'Promociones' },
        { nombre: '10 Family Pack', precio: 14500, categoria: 'Promociones' },

        // Servicios
        { nombre: 'Express de envios', precio: 0, categoria: 'Servicios' }
    ];

    const insert = db.prepare(
        'INSERT INTO productos (nombre, precio, categoria) VALUES (@nombre, @precio, @categoria)'
    );

    const insertMany = db.transaction((items) => {
        for (const item of items) insert.run(item);
    });

    insertMany(productos);

    console.log("Productos iniciales insertados correctamente");
}

module.exports = db;
