# e.firma Segura

![e.firma Segura](/assets/store.png)

e.firma Segura te permite almacenar y autocompletar tus credenciales de e.firma del SAT de forma segura. Guarda tus
archivos .cer, .key y contraseña de llave privada en una bóveda cifrada con AES-256 protegida por una contraseña
maestra.

Al ingresar al portal del SAT, un botón de "Autocompletar" aparece directamente en el formulario de acceso con e.firma,
permitiéndote llenar todos los campos con un solo clic.

Ideal para contadores, empresarios y cualquier persona que accede frecuentemente al SAT con múltiples e.firmas.

Toda tu información se almacena localmente en tu dispositivo. La sincronización segura con cifrado de extremo a extremo
está disponible opcionalmente.

## Instalación

Descarga e.firma Segura desde la [Chrome Web Store](https://chromewebstore.google.com/detail/efirma-segura/ffhifkllfkjhcbihlfjhojbidgdbmjcd) o descarga el [último release](https://github.com/openclinic-mx/efirma-segura-extension/releases/latest) como archivo .zip y cárgalo manualmente en [chrome://extensions](chrome://extensions) con el modo de desarrollador activado.

Para cargar la extensión manualmente en modo desarrollo, consulta la sección de [Desarrollo Local](#desarrollo-local).

## Seguridad y Privacidad

Obtener permisos para mejorar tu experiencia en sat.gob.mx y almacenar tus e.firmas puede plantear serias preocupaciones
de seguridad y privacidad.

En búsqueda de ser la solución más confiable para administrar tus credenciales en tu operación contable y fiscal,
e.firma Segura publica su código fuente.

Puedes descargar y auditar el código fuente en https://github.com/openclinic-mx/efirma-segura-extension

## Estructura del proyecto

Esta extensión está construida con [WXT](https://wxt.dev/) y [Nuxt UI](https://ui.nuxt.com/) en TypeScript.

Dependencias clave:

- **[kdbxweb](https://github.com/nicholasgasior/kdbxweb)** — Manejo de la bóveda cifrada
- **[@nodecfdi/credentials](https://github.com/nodecfdi/credentials)** — Lectura y validación de archivos .cer y .key de
  e.firma

## Desarrollo Local

Requisitos: [Node.js](https://nodejs.org/) (v22+)

```bash
git clone https://github.com/openclinic-mx/efirma-segura-extension.git
cd efirma-segura-extension
npm install
npm run dev
```

Para la lista completa de comandos disponibles, consulta nuestro [package.json](/package.json), así como la [documentación de WXT](https://wxt.dev/api/cli/wxt.html).

## Licencia

Este proyecto está licenciado bajo [Business Source License 1.1](./LICENSE.md).

**¿Qué significa esto?**

- Puedes copiar, modificar y redistribuir el código libremente.
- **El uso en producción requiere una licencia comercial** hasta la Fecha de Cambio (1 de marzo de 2030).
- El uso fuera de producción (desarrollo, pruebas, proyectos personales) está permitido sin costo.
- A partir del 1 de marzo de 2030, esta versión se convierte a
  la [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).

Para consultas sobre licenciamiento comercial, contáctanos en hola@openclinic.mx.

> **Nota:** La Business Source License no es una licencia de Código Abierto según la definición de la
> [Open Source Initiative](https://opensource.org/osd). Sin embargo, el Trabajo Licenciado estará
> disponible bajo una licencia aprobada por la OSI (AGPL v3.0) a partir de la Fecha de Cambio.
