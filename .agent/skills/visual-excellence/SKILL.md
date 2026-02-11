---
name: visual-excellence
description: Analiza y mejora visualmente aplicaciones web. Aplica tendencias modernas (glassmorphism, micro-animaciones) para elevar el look-and-feel a un nivel premium.
---

# Visual Excellence: Optimizador de UI/UX Premium (v3.0 Enterprise)

Esta habilidad convierte interfaces funcionales pero básicas en experiencias visuales de alto impacto (WOW Factor), asegurando accesibilidad, consistencia móvil y rendimiento.

## Cuándo usar esta habilidad

- Cuando el usuario pida "mejorar el diseño" o "hacerlo más profesional".
- Para implementar "Mobile-First Design" en aplicaciones legacy.
- Para unificar el diseño bajo un "Design System" coherente.

## Cómo usar esta habilidad (Protocolo)

### 1. Recetas Premium (Code Snippets)
Usa estos patrones de estilo para una mejora instantánea:
- **Glassmorphism:**
  ```css
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  ```
- **Motion Physics (Spring):**
  Evita `ease-in-out` genérico. Usa curvas de resorte para naturalidad:
  ```css
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  ```

### 2. Auditoría y Ejecución
1.  **Responsive Check:** Verifica layouts en resoluciones móviles (375px).
    - *Regla de Oro:* Ningún elemento debe hacer scroll horizontal accidental en móvil.
    - *Touch Targets:* Botones e inputs deben tener al menos 44px de altura.
2.  **Reusabilidad:** Antes de crear una clase nueva, busca en `tailwind.config.js` o en la librería de componentes si ya existe algo similar.
3.  **Color:** Sustituye el azul/rojo/verde puro por versiones HSL refinadas.

### 3. Verificación de Excelencia
- [ ] ¿Pasa el test de "Primera Impresión" (WOW Factor)?
- [ ] ¿Es totalmente responsive sin elementos rotos en móvil?
- [ ] ¿Cumple con criterios de accesibilidad WCAG AA (contraste 4.5:1)?

## Mejores Prácticas y Restricciones
- **Do:** Usar variables de CSS (`--primary`, `--bg`) para mantener la consistencia.
- **Do:** Buscar inspiración en internet antes de proponer un cambio masivo.
- **Don't:** Usar valores arbitrarios (ej: `top: 13px`). Usa el sistema de escala (ej: `top: 1rem`).
- **Don't:** Animaciones que duren más de 300ms para interacciones simples (hover/click).
