# URLs independientes para las 3 apps (Firebase Hosting)

Objetivo: publicar cada app con su propia URL, manteniendo la misma base de datos compartida.

## Sitios recomendados

- APP PRESENCIA: `app-presencia`
  - URL: `https://app-presencia.web.app`
- APP TALENTO: `app-talento`
  - URL: `https://app-talento.web.app`
- APP GESTION TRABAJOS: `app-gestion-trabajos`
  - URL: `https://app-gestion-trabajos.web.app`

## Paso 1: crear sitios en Firebase (una vez)

```bash
firebase login --reauth
firebase hosting:sites:create app-talento --project app-presencia
firebase hosting:sites:create app-gestion-trabajos --project app-presencia
firebase hosting:sites:list --project app-presencia
```

## Paso 2: ajustar firebase.json por app

### APP PRESENCIA

En `firebase.json`:

```json
{
  "hosting": {
    "site": "app-presencia",
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### APP TALENTO

En `firebase.json`:

```json
{
  "hosting": {
    "site": "app-talento",
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### APP GESTION TRABAJOS

En `firebase.json`:

```json
{
  "hosting": {
    "site": "app-gestion-trabajos",
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

## Paso 3: desplegar cada app de forma independiente

Desde cada proyecto:

```bash
npm run build
firebase deploy --only hosting --project app-presencia
```

## Paso 4 (opcional): dominios personalizados

En Firebase Console > Hosting > cada sitio > "Add custom domain".
