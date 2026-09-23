# Instrucciones de Instalación y Uso

## Primera Instalación

1. **Instalar Node.js** (si no lo tienes):
   - Descargar desde https://nodejs.org/
   - Versión recomendada: 18.x o superior

2. **Instalar dependencias del proyecto**:
   ```bash
   npm install
   ```

3. **Probar el sistema**:
   ```bash
   npm start
   ```

## Generar el .exe Instalable

Para crear el archivo ejecutable que puedes instalar en otros equipos:

```bash
npm run build-win
```

Esto generará un instalador en la carpeta `dist/` que puedes distribuir.

**Nota**: La primera vez que ejecutes el build puede tardar varios minutos ya que descarga todas las dependencias de Electron.

## Icono de la Aplicación

El sistema está configurado para usar un archivo `icon.ico` en la raíz del proyecto. Si quieres personalizar el icono:

1. Crea o consigue un archivo `.ico` (formato de icono de Windows)
2. Nómbralo `icon.ico`
3. Colócalo en la raíz del proyecto (mismo nivel que `package.json`)

Si no proporcionas un icono, Electron usará el icono por defecto.

## Primera Ejecución

Cuando ejecutes el sistema por primera vez:

1. Se creará automáticamente la carpeta `data/` con la base de datos
2. Se cargarán todos los productos del menú automáticamente
3. Se creará una meta semanal por defecto de ₡600,000

## Uso del Sistema

### Registrar una Venta

1. Ve a la pestaña "Ventas"
2. Escribe el nombre del producto en el buscador
3. Selecciona el producto de las sugerencias
4. Ajusta cantidad y precio si es necesario
5. Selecciona el método de pago
6. Agrega observaciones si lo deseas
7. Haz clic en "Guardar Venta"

### Ver Reportes

1. Ve a la pestaña "Reportes"
2. Selecciona las fechas de inicio y fin (opcional)
3. Filtra por método de pago si lo deseas
4. Haz clic en "Buscar"
5. Puedes exportar a PDF o Excel

### Gestionar Metas

1. Ve a la pestaña "Metas"
2. Verás el progreso de la semana actual
3. Para cambiar la meta, edita el valor y haz clic en "Actualizar Meta"
4. El gráfico muestra las ventas diarias de la semana
5. Puedes exportar reportes de meta a PDF o Excel

## Resolución de Problemas

### El servidor no inicia
- Verifica que el puerto 3000 no esté en uso
- Cierra otras aplicaciones que puedan estar usando ese puerto

### Error al generar el .exe
- Asegúrate de tener todas las dependencias instaladas: `npm install`
- Verifica que tengas espacio suficiente en disco (Electron ocupa bastante espacio)

### La base de datos no se crea
- Verifica que tengas permisos de escritura en la carpeta del proyecto
- La carpeta `data/` se crea automáticamente

## Estructura de Datos

La base de datos se guarda en `data/ventas.db`. Puedes hacer respaldos copiando este archivo.

**Importante**: No elimines la carpeta `data/` mientras el sistema esté en uso.

