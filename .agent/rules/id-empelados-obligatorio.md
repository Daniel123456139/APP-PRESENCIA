---
trigger: always_on
---

009 INTEGRIDAD REFERENCIAL

description: Regla de integridad referencial. Prohíbe la creación de datos de RRHH sin un ID de empleado válido. globs: ["src/types//*", "src/services//", "src/components/**/"]

Protocolo de Identidad: El ID es Sagrado

En "APP - PRESENCIA BUENA", un dato sin dueño es un dato perdido.

1. Definición de Tipos

Todas las interfaces de datos (Incidencia, Baja, Vacación) DEBEN extender de una interfaz base que incluya employeeId.

Ejemplo TypeScript:

interface BaseRecord {
  id: string;
  employeeId: string; // OBLIGATORIO
  createdAt: Date;
}


2. Validación en Servicios

Antes de guardar cualquier registro en Firebase/Supabase, verifica que employeeId no sea null, undefined o una cadena vacía.

Si falta el ID, lanza un error bloqueante: throw new Error("Violación de Integridad: Falta employeeId").

3. UI/UX

Al crear formularios de "Nueva Incidencia" o "Nueva Baja", el campo de selección de empleado debe ser el primero y estar marcado como requerido.

No permitas que el botón "Guardar" se habilite si no hay un empleado seleccionado.

4. Contexto Global

Usa el useGlobalContext (o equivalente) para obtener el empleado seleccionado actualmente en el Sidebar si el formulario no tiene un selector explícito.