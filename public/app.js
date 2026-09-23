// Variables globales
let productos = [];
let itemsVenta = [];
let graficoVentas = null;

document.addEventListener('DOMContentLoaded', async () => {
    inicializarNavegacion();
    await cargarProductos();
    inicializarVentas();
    inicializarReportes();
    inicializarMetas();
    inicializarImportacion();
});

// Navegación entre páginas
function inicializarNavegacion() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = btn.dataset.page;
            
            navButtons.forEach(b => b.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`page-${targetPage}`).classList.add('active');

            if (targetPage === 'metas') {
                cargarMeta();
                cargarGraficoVentas();
            } else if (targetPage === 'reportes') {
                buscarVentas();
            }
        });
    });
}

// Cargar productos
async function cargarProductos() {
    try {
        const response = await fetch('/api/productos');
        const data = await response.json();
        productos = Array.isArray(data) ? data : [];
        if (!response.ok) {
            console.error('Error API productos:', data);
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
        productos = [];
    }
}

let debounceSugerencias = null;

/** Sugerencias siempre desde la API (lee la BD actual); respaldo local solo si falla la red. */
async function actualizarSugerenciasProductos(query) {
    const sugerenciasDiv = document.getElementById('sugerencias-productos');
    try {
        const url = new URL('/api/productos/buscar', window.location.origin);
        url.searchParams.set('q', query);
        const res = await fetch(url.toString());
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            mostrarSugerencias(filtrarProductosLocales(query));
            return;
        }
        if (Array.isArray(data)) {
            mostrarSugerencias(data);
            return;
        }
        mostrarSugerencias(filtrarProductosLocales(query));
    } catch {
        await cargarProductos();
        mostrarSugerencias(filtrarProductosLocales(query));
    }
}

function filtrarProductosLocales(query) {
    const q = query.toLowerCase();
    const lista = Array.isArray(productos) ? productos : [];
    return lista
        .filter((p) => {
            const n = (p.nombre != null ? String(p.nombre) : '').toLowerCase();
            const c = (p.categoria != null ? String(p.categoria) : '').toLowerCase();
            const id = String(p.id != null ? p.id : '');
            return n.includes(q) || c.includes(q) || id.includes(q);
        })
        .slice(0, 15);
}

// Inicializar página de ventas
function inicializarVentas() {
    const buscarInput = document.getElementById('buscar-producto');
    const sugerenciasDiv = document.getElementById('sugerencias-productos');
    const btnGuardar = document.getElementById('btn-guardar-venta');

    buscarInput.addEventListener('input', (e) => {
        if (e.isComposing) return;
        const query = e.target.value.trim();
        if (debounceSugerencias) {
            clearTimeout(debounceSugerencias);
        }
        if (!query.length) {
            sugerenciasDiv.style.display = 'none';
            sugerenciasDiv.innerHTML = '';
            return;
        }
        debounceSugerencias = setTimeout(() => {
            debounceSugerencias = null;
            void actualizarSugerenciasProductos(query);
        }, 90);
    });

    buscarInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && sugerenciasDiv.style.display !== 'none') {
            const primera = sugerenciasDiv.querySelector('.sugerencia-item');
            if (primera) {
                primera.click();
            }
        }
    });

    btnGuardar.addEventListener('click', guardarVenta);
}

function mostrarSugerencias(sugerencias) {
    const sugerenciasDiv = document.getElementById('sugerencias-productos');
    sugerenciasDiv.innerHTML = '';

    if (sugerencias.length === 0) {
        sugerenciasDiv.style.display = 'none';
        return;
    }

    sugerencias.forEach(producto => {
        const item = document.createElement('div');
        item.className = 'sugerencia-item';
        const precio = Number(producto.precio);
        const precioTxt = Number.isFinite(precio)
            ? precio.toLocaleString('es-CR', { minimumFractionDigits: 2 })
            : '0,00';
        const etiqueta =
            producto.categoria && String(producto.nombre || '').match(/^\d+$/)
                ? `${producto.categoria} · ${producto.nombre}`
                : (producto.nombre || 'Producto');
        item.textContent = `${etiqueta} - ₡${precioTxt}`;
        item.addEventListener('click', () => {
            agregarItemVenta(producto);
            document.getElementById('buscar-producto').value = '';
            sugerenciasDiv.style.display = 'none';
        });
        sugerenciasDiv.appendChild(item);
    });

    sugerenciasDiv.style.display = 'block';
}

function agregarItemVenta(producto) {
    const pu = Number(producto.precio);
    const nombreLinea =
        producto.categoria && String(producto.nombre || '').match(/^\d+$/)
            ? `${producto.categoria} · ${producto.nombre}`
            : (producto.nombre || '');
    const item = {
        id: Date.now(),
        producto: nombreLinea,
        cantidad: 1,
        precio_unitario: Number.isFinite(pu) ? pu : 0
    };
    
    itemsVenta.push(item);
    actualizarItemsVenta();
}

function actualizarItemsVenta() {
    const container = document.getElementById('items-venta');
    const header = container.querySelector('.item-header');
    container.innerHTML = '';
    container.appendChild(header);

    itemsVenta.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-venta';
        div.innerHTML = `
            <span>${item.producto}</span>
            <input type="number" value="${item.cantidad}" min="1" data-id="${item.id}" class="cantidad-input">
            <input type="number" value="${item.precio_unitario}" min="0" step="0.01" data-id="${item.id}" class="precio-input">
            <span class="subtotal">₡${(item.cantidad * item.precio_unitario).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
            <button class="btn-eliminar" data-id="${item.id}">×</button>
        `;
        container.appendChild(div);
    });

    // Event listeners
    container.querySelectorAll('.cantidad-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            const item = itemsVenta.find(i => i.id === id);
            if (item) {
                item.cantidad = parseInt(e.target.value) || 1;
                actualizarItemsVenta();
            }
        });
    });

    container.querySelectorAll('.precio-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            const item = itemsVenta.find(i => i.id === id);
            if (item) {
                item.precio_unitario = parseFloat(e.target.value) || 0;
                actualizarItemsVenta();
            }
        });
    });

    container.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            itemsVenta = itemsVenta.filter(i => i.id !== id);
            actualizarItemsVenta();
        });
    });

    actualizarTotal();
}

function actualizarTotal() {
    const total = itemsVenta.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
    document.getElementById('total-venta').textContent = 
        `₡${total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
}

async function guardarVenta() {
    const metodoPago = document.getElementById('metodo-pago').value;
    const observaciones = document.getElementById('observaciones').value;
    
    // Referencias para mensajes visuales
    const titulo = document.querySelector('.venta-form h3');
    const textoOriginal = "Productos"; // O puedes usar titulo.innerText antes de cambiarlo

    // --- VALIDACIÓN 1: Sin productos ---
    if (itemsVenta.length === 0) {
        // Mensaje de error visual
        titulo.innerText = "¡FALTA AGREGAR PRODUCTOS!";
        titulo.style.color = "red";
        
        // Regresar a la normalidad en 2 seg
        setTimeout(() => {
            titulo.innerText = textoOriginal;
            titulo.style.color = "";
        }, 2000);

        // Poner el cursor en buscar para que agregue rápido
        document.getElementById('buscar-producto').focus();
        return;
    }

    // --- VALIDACIÓN 2: Sin método de pago ---
    if (!metodoPago) {
        titulo.innerText = "¡SELECCIONA MÉTODO PAGO!";
        titulo.style.color = "red";
        
        setTimeout(() => {
            titulo.innerText = textoOriginal;
            titulo.style.color = "";
        }, 2000);

        // Abrir/Enfocar el select de pago
        document.getElementById('metodo-pago').focus();
        return;
    }

    try {
        const response = await fetch('/api/ventas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: itemsVenta.map(i => ({
                    producto: i.producto,
                    cantidad: i.cantidad,
                    precio_unitario: i.precio_unitario
                })),
                metodo_pago: metodoPago,
                observaciones: observaciones || null
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // --- AVISO DE ÉXITO ---
            titulo.innerText = "¡VENTA GUARDADA!";
            titulo.style.color = "#27ae60"; // Verde
            titulo.style.transition = "all 0.3s";

            setTimeout(() => {
                titulo.innerText = textoOriginal;
                titulo.style.color = "";
            }, 2000);

            // --- LIMPIEZA DE DATOS ---
            itemsVenta = [];
            actualizarItemsVenta();
            document.getElementById('metodo-pago').value = '';
            document.getElementById('observaciones').value = '';

            // --- LIMPIEZA DE UI ---
            const inputBusqueda = document.getElementById('buscar-producto');
            const sugerenciasDiv = document.getElementById('sugerencias-productos');
            
            inputBusqueda.value = '';
            sugerenciasDiv.style.display = 'none';
            sugerenciasDiv.innerHTML = '';

            // --- RECUPERAR EL FOCO ---
            setTimeout(() => {
                if(inputBusqueda) {
                    inputBusqueda.disabled = false;
                    inputBusqueda.focus();
                    inputBusqueda.select(); 
                }
            }, 50);

        } else {
            // Manejo de error del servidor
            const error = await response.json();
            console.error('Error:', error);
            
            titulo.innerText = "¡ERROR AL GUARDAR!";
            titulo.style.color = "red";
            setTimeout(() => {
                titulo.innerText = textoOriginal;
                titulo.style.color = "";
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error guardando venta:', error);
        
        // Error de red
        titulo.innerText = "¡ERROR DE CONEXIÓN!";
        titulo.style.color = "red";
        setTimeout(() => {
            titulo.innerText = textoOriginal;
            titulo.style.color = "";
        }, 2000);
    }
}

// Inicializar reportes
function inicializarReportes() {
    document.getElementById('btn-buscar').addEventListener('click', buscarVentas);
    document.getElementById('btn-exportar-pdf').addEventListener('click', () => exportarPDF('ventas'));
    document.getElementById('btn-exportar-excel').addEventListener('click', () => exportarExcel('ventas'));
}

async function buscarVentas() {
    const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
    const fechaFin = document.getElementById('filtro-fecha-fin').value;
    const metodoPago = document.getElementById('filtro-metodo-pago').value;

    const params = new URLSearchParams();
    if (fechaInicio) params.append('fecha_inicio', fechaInicio);
    if (fechaFin) params.append('fecha_fin', fechaFin);
    if (metodoPago) params.append('metodo_pago', metodoPago);

    try {
        const [ventasResponse, statsResponse] = await Promise.all([
            fetch(`/api/ventas?${params}`),
            fetch(`/api/ventas/estadisticas?${params}`)
        ]);

        const ventas = await ventasResponse.json();
        const stats = await statsResponse.json();

        mostrarVentas(ventas);
        mostrarEstadisticas(stats);
    } catch (error) {
        console.error('Error buscando ventas:', error);
    }
}

function mostrarVentas(ventas) {
    const tbody = document.querySelector('#tabla-reportes tbody');
    tbody.innerHTML = '';

    ventas.forEach(venta => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${venta.id}</td>
            <td>${new Date(venta.fecha_hora).toLocaleString('es-CR')}</td>
            <td>₡${venta.total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
            <td>${venta.metodo_pago}</td>
            <td>${venta.items || ''}</td>
            <td>${venta.observaciones || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

function mostrarEstadisticas(stats) {
    document.getElementById('stat-total').textContent = 
        `₡${stats.total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
    document.getElementById('stat-cantidad').textContent = stats.cantidad;
}

function exportarPDF(tipo) {
    const fechaInicio = document.getElementById('filtro-fecha-inicio')?.value || '';
    const fechaFin = document.getElementById('filtro-fecha-fin')?.value || '';
    
    const params = new URLSearchParams();
    if (fechaInicio) params.append('fecha_inicio', fechaInicio);
    if (fechaFin) params.append('fecha_fin', fechaFin);
    params.append('tipo', tipo);

    window.open(`/api/exportar/pdf?${params}`, '_blank');
}

function exportarExcel(tipo) {
    const fechaInicio = document.getElementById('filtro-fecha-inicio')?.value || '';
    const fechaFin = document.getElementById('filtro-fecha-fin')?.value || '';
    
    const params = new URLSearchParams();
    if (fechaInicio) params.append('fecha_inicio', fechaInicio);
    if (fechaFin) params.append('fecha_fin', fechaFin);
    params.append('tipo', tipo);

    window.open(`/api/exportar/excel?${params}`, '_blank');
}

// Inicializar metas
function inicializarMetas() {
    document.getElementById('btn-guardar-meta').addEventListener('click', guardarMeta);
    document.getElementById('btn-exportar-meta-pdf').addEventListener('click', () => exportarPDF('meta'));
    document.getElementById('btn-exportar-meta-excel').addEventListener('click', () => exportarExcel('meta'));
}

async function cargarMeta() {
    try {
        const response = await fetch('/api/meta');
        const meta = await response.json();

        document.getElementById('meta-semanal').value = meta.meta_semanal;
        document.getElementById('meta-valor').textContent = 
            `₡${meta.meta_semanal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
        document.getElementById('meta-vendido').textContent = 
            `₡${meta.total_vendido.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
        document.getElementById('meta-restante').textContent = 
            `₡${meta.restante.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
        document.getElementById('meta-porcentaje').textContent = `${meta.porcentaje}%`;
        document.getElementById('semana-rango').textContent = 
            `${meta.fecha_inicio} - ${meta.fecha_fin}`;

        const porcentaje = parseFloat(meta.porcentaje);
        const barraFill = document.getElementById('barra-progreso-fill');
        barraFill.style.width = `${Math.min(porcentaje, 100)}%`;
        barraFill.textContent = `${meta.porcentaje}%`;
    } catch (error) {
        console.error('Error cargando meta:', error);
    }
}

async function guardarMeta() {
    const metaSemanal = parseFloat(document.getElementById('meta-semanal').value);

    if (!metaSemanal || metaSemanal <= 0) {
        alert('La meta debe ser un número positivo');
        return;
    }

    try {
        const response = await fetch('/api/meta', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ meta_semanal: metaSemanal })
        });

        if (response.ok) {
            alert('Meta actualizada correctamente');
            cargarMeta();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error guardando meta:', error);
        alert('Error al guardar la meta');
    }
}

async function cargarGraficoVentas() {
    try {
        // Obtener inicio de semana
        const metaResponse = await fetch('/api/meta');
        const meta = await metaResponse.json();
        
        const response = await fetch(
            `/api/ventas/por-dia?fecha_inicio=${meta.fecha_inicio}&fecha_fin=${meta.fecha_fin}`
        );
        const datos = await response.json();

        const ctx = document.getElementById('grafico-ventas').getContext('2d');
        
        if (graficoVentas) {
            graficoVentas.destroy();
        }

        graficoVentas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.map(d => new Date(d.fecha).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Ventas Diarias (₡)',
                    data: datos.map(d => d.total),
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₡' + value.toLocaleString('es-CR');
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '₡' + context.parsed.y.toLocaleString('es-CR', { minimumFractionDigits: 2 });
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error cargando gráfico:', error);
    }
}

// ==========================================
//  IMPORTACIÓN DE VENTAS
// ==========================================

let datosImportacion = [];

function inicializarImportacion() {
    const btnSelectFile = document.getElementById('btn-select-file');
    const fileInput = document.getElementById('excel-file');
    const btnPreview = document.getElementById('btn-preview-import');
    const btnConfirm = document.getElementById('btn-confirm-import');

    btnSelectFile.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('file-name').textContent = file.name;
            leerArchivoExcel(file);
        }
    });

    btnPreview.addEventListener('click', mostrarPrevisualizacion);
    btnConfirm.addEventListener('click', confirmarImportacion);
}

function leerArchivoExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            procesarDatosExcel(jsonData);
        } catch (error) {
            console.error('Error leyendo archivo Excel:', error);
            alert('Error al leer el archivo Excel. Verifique el formato.');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function procesarDatosExcel(filas) {
    datosImportacion = [];
    
    for (let i = 1; i < filas.length; i++) { // Empezar desde la fila 1 (saltar encabezados)
        const fila = filas[i];
        if (!fila[1] && !fila[2] && !fila[3]) continue; // Saltar filas vacías
        
        try {
            // Formato real: A=ID, B=Fecha/Hora, C=Total, D=Método, E=Items, F=Observaciones
            const venta = {
                fila: i + 1,
                id: fila[0] || '', // Columna A - ID
                fecha_hora: convertirFecha(fila[1]), // Columna B
                total: 0,
                metodo_pago: fila[3] || '', // Columna D
                items: [],
                observaciones: fila[5] || '' // Columna F - Observaciones generales
            };
            
            // Procesar el total (Columna C) - manejar diferentes formatos
            const totalStr = String(fila[2] || '0');
            const totalLimpio = totalStr.replace(/[^\d.,]/g, ''); // Mantener solo números, puntos y comas
            const totalConvertido = totalLimpio.replace(/,/g, '.'); // Convertir comas a puntos
            venta.total = parseFloat(totalConvertido) || 0;
            
            // Extraer productos de la columna 'Items' (Columna E)
            if (fila[4]) { // Columna E contiene los items
                venta.items = extraerProductosDeObservaciones(fila[4], venta.total);
            }
            
            // Si no se encontraron productos de la columna E, y hay total, crear un item genérico
            if (venta.items.length === 0 && venta.total > 0) {
                venta.items.push({
                    producto: 'Venta importada',
                    cantidad: 1,
                    precio_unitario: venta.total,
                    subtotal: venta.total
                });
            }
            
            // Debug: mostrar datos extraídos para verificar
            console.log(`Fila ${i + 1}:`, {
                id: venta.id,
                fecha_hora: venta.fecha_hora,
                total: venta.total,
                metodo_pago: venta.metodo_pago,
                observaciones: venta.observaciones,
                items: venta.items
            });
            
            datosImportacion.push(venta);
        } catch (error) {
            console.error(`Error procesando fila ${i + 1}:`, error);
            // Continuar con la siguiente fila incluso si hay error
        }
    }
    
    // Habilitar botones si hay datos
    document.getElementById('btn-preview-import').disabled = datosImportacion.length === 0;
    document.getElementById('btn-confirm-import').disabled = datosImportacion.length === 0;
}

function extraerProductosDeObservaciones(observaciones, totalVenta) {
    const items = [];
    const productosConocidos = [
        // Pupusas de Carnes
        'Mixta', 'Pollo con Queso', 'Chicharrón con Queso', 'Jamón con Queso', 
        'Carne Mechada con Queso', 'Solo Chicharrón', 'Frijol y Chicharrón', 
        'Super Loca', 'Hawaiana',
        // Vegetarianas
        'Frijol con Queso', 'Espinaca con Queso', 'Queso con Hongos', 
        'Jalapeño con Queso', 'Ayote Tierno con Queso', 'Chile Dulce con Queso',
        'Queso con Ajo', 'Albahaca con Queso', 'Solo Queso', 'Solo Frijol',
        // Especiales
        'Pupusas Veganas', 'Super Pupusa Loca', 'Pupusas Keto',
        // Comidas Rápidas
        'Hamburguesas Sencilla', 'Hamburguesa Doble', 'Hot Dogs', 'Tacos',
        'Sandwich de Carne Mechada', 'Salchipapas', 'Papas Fritas', 
        'Empanadas de Maduro', 'Quesadilla Salvadoreña',
        // Bebidas
        'Horchata', 'Té Frío', 'Cebada', 'Kolashanpan',
        // Promociones
        'Promo Compra 4 Lleva 5', 'Six Pack', '10 Family Pack'
    ];
    
    // Si no hay observaciones, devolver array vacío
    if (!observaciones || typeof observaciones !== 'string') {
        return items;
    }
    
    // Dividir por punto y coma o coma para manejar múltiples items
    const itemsStr = observaciones.split(/[;,]/);
    
    itemsStr.forEach(itemStr => {
        if (!itemStr || !itemStr.trim()) return;
        
        itemStr = itemStr.trim();
        
        // Patrones para extraer producto y cantidad
        let producto = '';
        let cantidad = 1;
        
        // Patrón 1: "Mixta (Chicharrón, Frijol y Queso) x44"
        const match1 = itemStr.match(/(.+?)\s*\([^)]*\)\s*x\s*(\d+)/);
        if (match1) {
            producto = match1[1].trim();
            cantidad = parseInt(match1[2]);
        }
        
        // Patrón 2: "Mixta x44" o "Cebada x2"
        else if (!match1) {
            const match2 = itemStr.match(/(.+?)\s*x\s*(\d+)/);
            if (match2) {
                producto = match2[1].trim();
                cantidad = parseInt(match2[2]);
            }
        }
        
        // Patrón 3: "44 Mixta" 
        else if (!match1 && !match2) {
            const match3 = itemStr.match(/(\d+)\s*(.+)/);
            if (match3) {
                cantidad = parseInt(match3[1]);
                producto = match3[2].trim();
            }
        }
        
        // Si no se encontró patrón, usar el texto completo como producto
        else if (!producto) {
            producto = itemStr;
            cantidad = 1;
        }
        
        // Validar que cantidad sea un número válido
        if (isNaN(cantidad) || cantidad <= 0) {
            cantidad = 1;
        }
        
        // Limpiar el nombre del producto
        producto = producto.replace(/\([^)]*\)/g, '').trim(); // Eliminar paréntesis
        producto = producto.replace(/pupusas?$/gi, '').trim(); // Eliminar "pupusas" al final
        
        // Buscar producto conocido similar
        let productoFinal = producto;
        const productoEncontrado = productosConocidos.find(p => 
            p.toLowerCase().includes(producto.toLowerCase()) || 
            producto.toLowerCase().includes(p.toLowerCase())
        );
        
        if (productoEncontrado) {
            productoFinal = productoEncontrado;
        }
        
        // Solo agregar si el producto tiene sentido
        if (productoFinal && productoFinal.length > 1) {
            items.push({
                producto: productoFinal,
                cantidad: cantidad,
                precio_unitario: 0,
                subtotal: 0
            });
        }
    });
    
    // Calcular precios distribuyendo el total
    if (items.length > 0 && totalVenta > 0 && !isNaN(totalVenta)) {
        const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);
        const precioUnitarioPromedio = totalVenta / totalItems;
        
        items.forEach(item => {
            item.precio_unitario = precioUnitarioPromedio;
            item.subtotal = item.cantidad * precioUnitarioPromedio;
        });
    }
    
    return items;
}

function convertirFecha(excelDate) {
    if (typeof excelDate === 'number') {
        // Si es un número, es un número de serie de Excel
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return date.toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' }); // Formato YYYY-MM-DD HH:MM:SS
    } else if (typeof excelDate === 'string') {
        // Si es un string, intentar parsear directamente
        // Asumiendo formato DD/MM/YYYY HH:MM:SS o similar
        const parts = excelDate.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
        if (parts) {
            const day = parseInt(parts[1], 10);
            const month = parseInt(parts[2], 10) - 1; // Meses son 0-index
            const year = parseInt(parts[3], 10);
            const hour = parseInt(parts[4] || '0', 10);
            const minute = parseInt(parts[5] || '0', 10);
            const second = parseInt(parts[6] || '0', 10);
            
            const date = new Date(year, month, day, hour, minute, second);
            return date.toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' });
        } else {
            // Si no coincide con el patrón, intentar con Date.parse
            try {
                const date = new Date(excelDate);
                if (!isNaN(date)) {
                    return date.toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' });
                }
            } catch (e) {
                console.error("Error al parsear fecha string: ", excelDate, e);
            }
        }
    }
    return excelDate; // Devolver original si no se puede convertir
}

function mostrarPrevisualizacion() {
    if (datosImportacion.length === 0) return;
    
    const previewSection = document.getElementById('preview-section');
    const tbody = document.querySelector('#preview-table-content tbody');
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    let totalGeneral = 0;
    
    datosImportacion.forEach(venta => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${venta.id || ''}</td>
            <td>${venta.fecha_hora}</td>
            <td>₡${venta.total.toFixed(2)}</td>
            <td>${venta.metodo_pago}</td>
            <td>${venta.items.map(item => `${item.producto} x${item.cantidad}`).join(', ')}</td>
            <td>${venta.observaciones}</td>
        `;
        tbody.appendChild(tr);
        totalGeneral += venta.total;
    });
    
    document.getElementById('preview-count').textContent = datosImportacion.length;
    document.getElementById('preview-total').textContent = `₡${totalGeneral.toFixed(2)}`;
    
    previewSection.style.display = 'block';
}

async function confirmarImportacion() {
    if (datosImportacion.length === 0) return;
    
    if (!confirm(`¿Está seguro de importar ${datosImportacion.length} ventas? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/importar/ventas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ventas: datosImportacion })
        });
        
        const resultado = await response.json();
        
        if (!response.ok) {
            throw new Error(resultado.error || 'Error en la importación');
        }
        
        mostrarResultados(resultado.resultados);
        
    } catch (error) {
        console.error('Error en importación:', error);
        alert('Error al importar las ventas: ' + error.message);
    }
}

function mostrarResultados(resultados) {
    const resultsSection = document.getElementById('import-results');
    const successCount = document.getElementById('success-count');
    const errorCount = document.getElementById('error-count');
    const errorDetails = document.getElementById('error-details');
    
    successCount.textContent = resultados.exitosos;
    errorCount.textContent = resultados.errores;
    
    // Mostrar detalles de errores si existen
    if (resultados.errores > 0) {
        errorDetails.innerHTML = '<h4>Detalles de errores:</h4>';
        const ul = document.createElement('ul');
        
        resultados.detalles.forEach(detalle => {
            if (!detalle.exito) {
                const li = document.createElement('li');
                li.textContent = `Fila ${detalle.fila}: ${detalle.error}`;
                ul.appendChild(li);
            }
        });
        
        errorDetails.appendChild(ul);
        errorDetails.style.display = 'block';
    } else {
        errorDetails.style.display = 'none';
    }
    
    resultsSection.style.display = 'block';
    
    // Limpiar formulario
    document.getElementById('excel-file').value = '';
    document.getElementById('file-name').textContent = 'Ningún archivo seleccionado';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('btn-preview-import').disabled = true;
    document.getElementById('btn-confirm-import').disabled = true;
    
    datosImportacion = [];
}

