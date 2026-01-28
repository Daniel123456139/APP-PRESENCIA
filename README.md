# 📂 Estructura del Proyecto

Este proyecto sigue una estructura organizada y modular para facilitar el mantenimiento y desarrollo.

## 📁 Directorios Principales

```
APP PRESENCIA V2/
├── 📄 START.bat                    # Script de inicio rápido
├── 📋 README.md                    # Documentación general
├── 📋 package.json                 # Dependencias del proyecto
├── ⚙️ vite.config.ts               # Configuración de Vite
├── ⚙️ tsconfig.json                # Configuración de TypeScript
├── 🔒 .env.local                   # Variables de entorno (no commitear)
├── 🚫 .gitignore                   # Archivos ignorados por Git
├── 
├── 📂 src/                         # 🎯 CÓDIGO FUENTE
│   ├── index.html                  # Punto de entrada HTML
│   ├── index.tsx                   # Punto de entrada de React
│   ├── App.tsx                     # Componente principal
│   ├── types.ts                    # Definiciones de tipos TypeScript
│   ├── constants.ts                # Constantes globales
│   ├── firebaseConfig.ts           # Configuración de Firebase
│   │
│   ├── 📂 components/              # Componentes de React
│   │   ├── core/                   # Componentes fundamentales
│   │   ├── hr/                     # Componentes de RRHH
│   │   └── shared/                 # Componentes compartidos
│   │
│   ├── 📂 hooks/                   # Custom hooks de React
│   ├── 📂 services/                # Servicios y lógica de negocio
│   ├── 📂 store/                   # Estado global (Zustand)
│   ├── 📂 utils/                   # Utilidades y helpers
│   ├── 📂 workers/                 # Web Workers
│   ├── 📂 data/                    # Datos mock y estáticos
│   └── 📂 config/                  # Configuraciones específicas
│
├── 📂 docs/                        # 📚 DOCUMENTACIÓN
│   ├── DEFINICION DEL PROYECTO.md  # Arquitectura y especificaciones
│   └── AUDIT_REPORT.md             # Reportes de auditoría
│
├── 📂 scripts/                     # 🔧 SCRIPTS ÚTILES
│   ├── INICIAR APP.bat             # Script original de inicio
│   └── testErpApi.mjs              # Tests de API ERP
│
├── 📂 .agent/                      # Configuración del agente AI
├── 📂 node_modules/                # Dependencias (generado)
└── 📂 dist/                        # Build de producción (generado)
```

## 🚀 Inicio Rápido

### Opción 1: Script de inicio 
```bash
START.bat
```

### Opción 2: Comandos npm
```bash
npm install          # Instalar dependencias
npm run dev          # Desarrollo
npm run build        # Producción
```

## 📝 Convenciones

- **src/**: Todo el código fuente de la aplicación
- **docs/**: Documentación técnica y especificaciones
- **scripts/**: Utilidades y scripts de desarrollo
- **Raíz**: Solo archivos de configuración del proyecto

## 🔧 Archivos de Configuración

| Archivo | Propósito |
|---------|-----------|
| `vite.config.ts` | Configuración del bundler |
| `tsconfig.json` | Configuración de TypeScript |
| `package.json` | Dependencias y scripts npm |
| `.env.local` | Variables de entorno |

## 📦 Builds

- **Desarrollo**: `npm run dev` → Servidor en `localhost:3000`
- **Producción**: `npm run build` → Output en `dist/`
