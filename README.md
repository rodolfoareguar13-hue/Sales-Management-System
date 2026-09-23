# Sistema de Ventas - Pupusería Salvadoreña

Sistema de registro de ventas rápido y eficiente para pupusería, con reportes, metas semanales y exportación a PDF/Excel.

## Características

- Registro rápido de ventas con autocompletar de productos
- Base de datos SQLite local y confiable
- Reportes de ventas con filtros por fecha y método de pago
- Sistema de metas semanales con progreso visual
- Gráficos de ventas diarias
- Exportación a PDF y Excel
- Interfaz web simple y funcional
- Empaquetado como .exe para instalación fácil

## Instalación y Uso

### Desarrollo

1. Instalar dependencias:
```bash
npm install
```

2. Ejecutar en modo desarrollo:
```bash
npm start
```

### Generar .exe Instalable

Para crear el ejecutable instalable:

```bash
npm run build-win
```

El archivo .exe se generará en la carpeta `dist/`.

## Estructura del Proyecto

```
├── main.js              # Proceso principal de Electron
├── preload.js           # Script de preload
├── package.json         # Configuración del proyecto
├── server/
│   ├── database.js      # Configuración de SQLite
│   ├── routes.js        # Rutas de la API
│   ├── pdfGenerator.js  # Generador de PDFs
│   └── excelGenerator.js # Generador de Excel
├── public/
│   ├── index.html       # Interfaz principal
│   ├── styles.css       # Estilos
│   └── app.js           # Lógica del frontend
└── data/                # Base de datos SQLite (se crea automáticamente)
```

## Funcionalidades

### Registro de Ventas
- Búsqueda rápida de productos con autocompletar
- Agregar múltiples productos con cantidades
- Métodos de pago: Efectivo, Tarjeta, Simple Móvil
- Observaciones opcionales

### Reportes
- Filtros por fecha y método de pago
- Estadísticas de totales y cantidad de ventas
- Exportación a PDF y Excel

### Metas
- Meta semanal configurable (por defecto ₡600,000)
- Progreso visual con barra
- Gráfico de ventas diarias de la semana
- Exportación de reportes de meta

## Base de Datos

La base de datos SQLite se crea automáticamente en `data/ventas.db` con las siguientes tablas:

- `productos`: Catálogo de productos
- `ventas`: Registro de ventas
- `venta_items`: Items de cada venta
- `metas`: Configuración de metas semanales

## Notas

- Los productos del menú se cargan automáticamente al iniciar por primera vez
- La meta semanal se calcula de lunes a domingo
- Todos los precios incluyen I.V.A.

## Cómo generar el instalador (.exe) en Windows

Para compilar `sqlite3` y crear el instalador necesitas las herramientas de compilación de Visual Studio. Sigue estos pasos:

1. **Instalar Visual Studio Build Tools 2022**  
   - Abre el *Visual Studio Installer* y selecciona **Visual Studio Build Tools 2022**.  
   - Marca el *workload* **“Desarrollo para el escritorio con C++”**.  
   - Asegúrate de que estén seleccionados los componentes:  
     - *MSVC v143 - VS 2022 C++ x64/x86 build tools*  
     - *Windows 11 SDK (10.0.22621)* o *Windows 10 SDK (10.0.19041)*  
     - *Herramientas de CMake en C++ para Windows* (opcional pero recomendado)

2. **Instalar Pip y Setuptools en Python (para node-gyp)**  
   ```powershell
   python -m ensurepip --upgrade
   python -m pip install --upgrade pip setuptools
   ```

3. **Usar la consola de herramientas nativas**  
   - Abre el acceso directo **“x64 Native Tools Command Prompt for VS 2022”** (mejor si es *Build Tools*).  
   - En esa consola navega al proyecto:
     ```cmd
     cd C:\Users\pupus\Desktop\Pupuseria
     ```

4. **Forzar la recompilación de sqlite3**  
   ```cmd
   npm rebuild sqlite3
   ```

5. **Generar el instalador**  
   ```cmd
   npm run build-win
   ```

6. **Solución de problemas comunes**  
   - *“Cannot create symbolic link”*: ejecuta la consola como Administrador o habilita el “Modo desarrollador” en Windows.  
   - *Errores de `distutils`*: asegúrate de haber instalado `pip` y `setuptools` en tu versión de Python.  
   - *Errores de SDK*: confirma que al menos un Windows SDK esté marcado en el instalador de Visual Studio.

El instalador quedará disponible en la carpeta `dist/` con el nombre `Sistema de Ventas - Pupusería Setup 1.0.0.exe`.

