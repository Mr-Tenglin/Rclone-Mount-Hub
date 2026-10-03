# Rclone Mount Hub

> Una aplicación de escritorio para Windows 11 para gestionar montajes de rclone — nació de un script de PowerShell y creció hasta ser una GUI completa.

[![Plataforma](https://img.shields.io/badge/platform-Windows%2011%20x64-0078d4?logo=windows11&logoColor=white)](https://www.microsoft.com/windows/windows-11)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-ffc131?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/frontend-React%2019-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/backend-Rust-ce422b?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Versión](https://img.shields.io/badge/version-0.1.9-22c55e)](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases)
[![Licencia](https://img.shields.io/badge/license-AGPL--3.0-a855f7)](LICENSE)

> Este archivo es la traducción al español del README. El original en inglés: [README.md](README.md).

---

## Propósito

Rclone Mount Hub te permite montar almacenamiento remoto — NAS, Unraid, Nextcloud, SFTP, SMB, S3, FTP — como letras de unidad reales de Windows con un solo clic. Sin terminal, sin scripts, sin líos. Envuelve a [rclone](https://rclone.org) en una interfaz limpia y moderna, y gestiona conexiones, conmutación de red inteligente (LAN ↔ Tailscale), instalación de controladores, ajuste de rendimiento y autoactualizaciones, todo desde un solo sitio.

> **Esto comenzó como un simple script de PowerShell** que el autor usaba para desplegar montajes de rclone en su propia máquina y en las de su familia: instalaba rclone y WinFsp automáticamente, configuraba remotos WebDAV y establecía la autocompleción de Windows. A medida que la configuración se hizo más compleja y necesitaba funcionar para miembros de la casa no técnicos, ese script evolucionó hasta ser esta aplicación de escritorio completa.

**Solo Windows 11 (x64).** Rclone se monta como letra de unidad de Windows a través de [WinFsp](https://winfsp.dev), un driver de núcleo de Windows — sin soporte para macOS ni Linux.

---

## Contenido

- [Propósito](#propósito)
- [Características](#características)
  - [Montaje](#montaje)
  - [Red inteligente](#red-inteligente)
  - [Perfiles de rendimiento](#perfiles-de-rendimiento)
  - [Soporte de protocolos](#soporte-de-protocolos)
  - [Diagnóstico](#diagnóstico)
  - [Gestión](#gestión)
  - [Integración con Windows](#integración-con-windows)
- [Plataforma y requisitos](#plataforma-y-requisitos)
- [Comienzo rápido](#comienzo-rápido)
  - [Instalación](#instalación)
  - [Actualización](#actualización)
- [Tecnologías](#tecnologías)
  - [Capa de escritorio](#capa-de-escritorio)
  - [Frontend](#frontend)
  - [Plugins de Tauri](#plugins-de-tauri)
- [Compilar desde el código fuente](#compilar-desde-el-código-fuente)
- [Documentación](#documentación)
- [Actualizaciones del proyecto](#actualizaciones-del-proyecto)
- [La historia](#la-historia)
  - [La solución](#la-solución)
- [Contribución](#contribución)
- [Licencia](#licencia)

---

## Características

### Montaje
- Montaje / desmontaje con un clic de cualquier remoto como letra de unidad (D: – Z:)
- Gestión simultánea de múltiples conexiones
- Montaje automático al iniciar Windows
- El selector de letras de unidad solo muestra letras disponibles (libres)
- Bandeja del sistema con estado de montaje en vivo y acceso «Abrir en el Explorador»

### Red inteligente
- **Conmutación automática LAN / Tailscale** — usa la IP local en casa y la IP de Tailscale fuera
- Sobresalida manual por conexión (fijar solo LAN o solo Tailscale)
- Prueba de conexión por ping antes de guardar

### Perfiles de rendimiento

Tres conjuntos de flags de rclone preajustados, seleccionables por conexión:

|           | Velocidad máx. | Equilibrado | Bajo recurso |
| --------- | -------------- | ----------- | ------------ |
| Caché VFS | 50 GB          | 10 GB       | 2 GB         |
| Buffer    | 512 MB         | 256 MB      | 64 MB        |
| Transferencias | 16        | 8           | 4            |
| Ideal para | 10Gbps LAN / fibra | Uso diario | Batería / WiFi lento |

### Soporte de protocolos
- **WebDAV** — Unraid (Copyparty), Nextcloud, ownCloud, SharePoint
- **SFTP** — cualquier servidor SSH
- **SMB / Samba** — compartidos de Windows, NAS
- **S3** — AWS, MinIO, Backblaze B2, Wasabi
- **FTP** — servidores FTP clásicos

### Diagnóstico
- Prueba de velocidad de subida / bajada a cualquier unidad montada
- Detección de cuello de botella (red vs. disco local vs. rclone)
- Análisis de la ruta de red con descomposición de latencia
- Lanza la interfaz web de Rclone

### Gestión
- Exportar / importar todas las configuraciones de conexión como JSON
- Generar un script de PowerShell independiente para cualquier conexión
- Instalar, actualizar o desinstalar rclone y WinFsp desde la app
- Ruta de configuración de rclone configurable
- Comprador de actualizaciones integrado — descarga y aplica actualizaciones con un clic (Velopack)

### Integración con Windows
- Se instala en `%LocalAppData%` — **sin permisos de administrador**
- Arranque con Windows, arrancar minimizado, cerrar a la bandeja
- Notificaciones toast de Windows al montar / desmontar (con el nombre correcto de la app)
- Añadir al Meno Inicio / registrar AUMID para atribución correcta de notificaciones

---

## Plataforma y requisitos

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **SO**               | Windows 11 x64                                                     |
| **Controladores obligatorios** | rclone + WinFsp — la app instala ambos automáticamente al primer arranque |
| **macOS / Linux**    | No soportados                                                      |

---

## Comienzo rápido

### Instalación

Descarga la última `Rclone Mount Hub_x.x.x_x64-setup.exe` de [Releases](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases) y ejecútala. No necesita permisos de administrador.

Al primer arranque la app comprueba rclone y WinFsp y ofrece instalarlos.

### Actualización

Vuelve a ejecutar el instalador sobre la instalación existente (actualiza in situ) o usa **Configuración → Acerca de y actualizaciones → Buscar actualizaciones** dentro de la app.

---

## Tecnologías

### Capa de escritorio
|                                   |                                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| [Tauri 2](https://tauri.app)      | Capa de escritorio — backend Rust, frontend web, binario de ~5 MB |
| [Rust](https://www.rust-lang.org) | Backend: lanza rclone, detección de red, bandeja, integración del sistema |
| [Velopack](https://velopack.io)   | Marco de instalador y autoactualización |

### Frontend
|                                                 |                                                |
| ----------------------------------------------- | ---------------------------------------------- |
| [React 19](https://react.dev)                   | Marco de UI                                    |
| [TypeScript](https://www.typescriptlang.org)    | Seguridad de tipos                             |
| [Vite 7](https://vitejs.dev)                    | Herramientas de compilación |
| [Tailwind CSS v4](https://tailwindcss.com)      | Estilos utilitarios con tokens de diseño oscuro personalizados |
| [Zustand](https://zustand-demo.pmnd.rs)         | Estado del cliente persistido |
| [Radix UI](https://www.radix-ui.com)            | Primitivas accesibles sin cabecera |
| [Framer Motion](https://www.framer.com/motion/) | Animaciones |
| [dnd-kit](https://dndkit.com)                   | Reordenar por arrastrar y soltar |
| [Phosphor Icons](https://phosphoricons.com)     | Biblioteca de iconos |
| [sonner](https://sonner.emilkowal.ski)          | Notificaciones toast |

### Plugins de Tauri
|                             |                               |
| --------------------------- | ----------------------------- |
| `tauri-plugin-shell`        | Lanza procesos de rclone      |
| `tauri-plugin-store`        | Persiste las configuraciones en JSON |
| `tauri-plugin-autostart`    | Registro de arranque de Windows |
| `tauri-plugin-notification` | Notificaciones toast nativas del SO |
| `tauri-plugin-dialog`       | Selector de archivos / carpetas |

---

## Compilar desde el código fuente

Guía completa en **[docs/Building-Src.md](docs/Building-Src.md)**.

```bash
# Requisitos previos: Rust (stable), Node.js 18+, pnpm
pnpm install
pnpm tauri dev          # Desarrollo con recarga en caliente
pnpm tauri build --bundles nsis   # Instalador NSIS de producción
```

---

## Documentación

|                                              |                                               |
| -------------------------------------------- | --------------------------------------------- |
| [docs/Building-Src.md](docs/Building-Src.md)         | Compilar, empaquetar, distribuir, incrementar versión |
| [docs/Architecture.md](docs/Architecture.md) | Arquitectura completa, modelos de datos, sistema de diseño |
| [docs/Updater-System.md](docs/Updater-System.md) | Sistema de autoactualización de Velopack (usuario + desarrollador) |

---

## Actualizaciones del proyecto

Esta sección registra las actualizaciones notables aplicadas al proyecto, en orden cronológico inverso.

### v0.1.9 (actual)

#### Internacionalización (i18n)
- Se ha añadido un sistema i18n ligero (carpeta `i18n/` + `src/lib/i18n.ts`) que descubre
  automáticamente todos los paquetes de idioma mediante `import.meta.glob` de Vite.
- Nuevos paquetes de idioma: `i18n/en.json` (base), `i18n/zh-Hans.json`, `i18n/zh-Hant.json`,
  `i18n/ja.json`, `i18n/es.json`, `i18n/ru.json` — totalmente alineados por clave
  con el paquete base en inglés (498 claves en cada uno).
- Todas las cadenas de interfaz en cada página, toast, log y modal pasan ahora por
  `t("...")`. Las claves que faltan caen en inglés y, en último caso, en la ruta de la clave.
- **Configuración → Idioma** permite elegir **Sistema / English / 简体中文 / 繁體中文 /
  日本語 / Español / Русский** o seguir el idioma de visualización del sistema. La opción
  se persiste en el almacén de ajustes y se aplica al instante (sin reiniciar).

#### Instalación de drivers (Scoop)
- Rclone se instala a través de Scoop. Se añade una configuración de **fuente del
  bucket de Scoop** (Ajustes → «Fuente del bucket de Scoop»): **GitHub** (bucket
  principal oficial, por defecto) o **Gitee** (una copia sincronizada por la comunidad
  en la plataforma Gitee, para redes donde GitHub es lento o inaccesible). Gitee
  **no** es un espejo de GitHub: el contenido de su bucket se sincroniza por separado
  y puede estar desactualizado o faltarle paquetes.
- El proceso de arranque ahora **repara automáticamente un bucket `main` de Scoop
  dañado** (el fallo «Failed to remove local 'main' bucket» / «'main' bucket not
  found» visto con Scoop 0.6.0+) antes de instalar, en lugar de fallar en silencio.
- Corregido el que el indicador de estado de drivers no se actualizaba tras instalar
  rclone: la detección de rclone ahora se hace a través de `powershell`, de modo que
  un shim de Scoop recién instalado se encuentra de inmediato, aunque el PATH del
  proceso de la aplicación se cacheó al arrancar.

#### Alineación de dependencias y herramientas de compilación
- `@tauri-apps/api` ha sido actualizado a **2.12** y `@tauri-apps/plugin-dialog` /
  `@tauri-apps/plugin-store` se han alineado a versiones coincidentes para que los crates
  de Rust ya no informen de una incompatibilidad de versiones.
- Se ha eliminado `tauri-plugin-mcp-bridge`: todas las versiones publicadas (0.1.3–0.13.0)
  fijan `webview2-com 0.38`, incompatible con `webview2-com 0.39` de Tauri 2.12. El plugin
  solo se usaba bajo `#[cfg(debug_assertions)]` y no es necesario en compilaciones de producción.
- Las versiones de los crates Rust de `tauri` y de los plugins ahora se resuelven de forma
  coherente con los paquetes npm (todos 2.12.x).

#### Compilación y publicación
- El proyecto se compila en Windows 11 con la herramienta Rust + MSVC.
- `build-release.ps1` produce:
  - `Rclone Mount Hub_<ver>_x64-setup.exe` (instalador de Velopack, actualizaciones in situ)
  - `Rclone Mount Hub_<ver>_x64-Portable.exe` (fichero único, se ejecuta en cualquier sitio)
- URL de la fuente de actualizaciones: `https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases/latest/download`

---

## La historia

Todo empezó cuando conseguí mi primer NAS y descubrí lo «genial» que son las compartidas SMB (spoiler: lo más lejos posible de eso). Pero el pequeño Bristopher empezó a tener extraños problemas de credenciales...

> **Aviso:** Omite este párrafo si no quieres leer una diatriba; o sigue leyendo si Windows SMB también es tu pesadilla (en ese caso, abre una discusión en este repositorio y cuéntanos cuánto lo odias).

...resulta que estaba «conectado» pero en realidad... no lo estaba. Si intentaba mi usuario y contraseña, decía «incorrecto», pero forzó un cambio a una nueva contraseña y seguía siendo «incorrecto». ¿Limpié las credenciales de Windows? Siguen sin funcionar. Velocidades limitadas a 15 MB/s aunque mi red era WiFi 6E (Y mi NAS estaba por cable) y las pruebas de velocidad a mi NAS daban los habituales 150+ MB/s que da un disco mecánico.

¡Y no olvidemos abrir una compartida que pierde conexión temporalmente y hace que se tumbe el proceso completo del Explorador de Windows!! (¡Qué alegría, me encantan que todas mis instancias de VSCode y ventanas de navegador se reordenen al azar y todas mis ventanas del explorador desaparezcan en pleno copiado de archivos!!! Mi afición favorita). Queda claro que son errores antiguos bien conocidos y no soy un caso aislado sufriendo un «error de habilidad». En resumen: no solo fue una pesadilla para mí, sino también para cualquiera de mi casa que también lo usaba y que no es un demonio técnico como yo, sino un Joe normal.

### La solución

Tras tres años de infierno con SMB añadí una tarjeta x8 NVMe SSD PCIe (recomendado, mucha diversión, los discos mecánicos son para frikis :P) y seguía sin superar los 30 MB/s... hasta que por fin probé aquello que llevaba tiempo apuntando y que se integra bien con Windows: **WebDAV** (Copyparty en concreto).

Espera, espera, espera, sé lo que estás pensando: *«Pero Bristopher, WebDAV añade un montón de sobrecarga innecesaria y en realidad es lento, ay ay.»* Sí, tienes razón, pero oye, es fácil y «funciona de verdad», así que... me gustó mucho la idea de **RaiDrive** (hay que pagar el añadido de «unidad física» para superar los 30 MB/s, pero aun así mis velocidades no cambiaron y lo abandoné) y de **CloudMounter** (buen programa, pero un poco inestable al trabajar con el montaje).

Así que creé **Rclone Mount Hub** para gestionar fácilmente mis montajes de NAS e incluso montajes a otros PCs de la red local (como a mi portátil). Ahora mismo me peleo con las soluciones de sincronización, así que creo que este es mi camino porque Syncthing y Resilio Sync han sido pesadillas lentas y con fallos. Si tienes alguna solución mejor que te haya funcionado, ¡compártela en la sección de discusiones, gracias!!

---

## Contribución

Issues, peticiones de características y pull requests son bienvenidos. Si Windows SMB también te ha destrozado la vida, abre una discusión — el sufrimiento ama la compañía.

### Desarrollado con DeepSeek Harness

Este proyecto se mantiene y mejora activamente con ayuda de **DeepSeek Harness**, un agente de programación por IA. Las actualizaciones recientes — incluyendo el sistema i18n, la alineación de dependencias de Tauri 2.12 y el flujo de trabajo de empaquetado de Velopack — fueron creadas con ayuda de DeepSeek Harness y validadas mediante `tsc` / `vite build` / la compilación de producción de Tauri. Las contribuciones son bienvenidas tanto si están hechas a mano como generadas con DeepSeek Harness: abre un issue o un pull request describiendo qué ha cambiado y por qué.

---

## Licencia

Rclone Mount Hub es de código abierto bajo la **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**Qué significa esto:**
- Puedes usar, modificar y distribuir este software libremente
- Si distribuyes una versión modificada o la ofreces como servicio alojado, debes publicar tus cambios bajo la misma licencia
- No puedes tomar este código, cerrarlo y venderlo como producto privativo sin publicar tus cambios

**Licencia comercial:** Si tu organización necesita usar o construir sobre Rclone Mount Hub sin las obligaciones de AGPL (por ejemplo, en un producto privativo), está disponible una licencia comercial — abre un issue o contacta directamente.

Copyright © 2025 Bristopher. Todos los derechos reservados.
