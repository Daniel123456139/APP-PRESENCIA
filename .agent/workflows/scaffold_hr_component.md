description: Crea un nuevo panel o módulo de gestión de RRHH conectado a los filtros globales y con la estructura visual estándar.



Generador de Módulos de RRHH



Sigue estos pasos para crear una nueva pestaña o vista en la aplicación.



1. Análisis de Requisitos



Pregunta: ¿Qué entidad gestiona este módulo? (Ej: "Horas Extras", "Formación").



Pregunta: ¿Necesita vista de tabla, calendario o formulario?



2\. Estructura de Archivos // turbo



Crea la carpeta en src/components/modules/\[NombreModulo]/.



Genera index.tsx (Vista principal) y use\[NombreModulo].ts (Lógica/Hooks).



3\. Conexión con Filtros Globales



Importa el contexto global: const { dateRange, selectedSection } = useGlobalFilters();.



Asegúrate de que el useEffect de carga de datos dependa de estas variables: \[dateRange, selectedSection].



4\. Implementación UI (Estándar)



Usa Tailwind CSS para mantener la estética.



Incluye un encabezado con el título y botones de acción a la derecha (Ej: "Exportar Excel", "Nuevo Registro").



Si es una tabla, usa componentes de tabla existentes para mantener el estilo de filas alternas y hover.



5\. Integración de Datos



Conecta con el servicio de Firebase correspondiente.



Implementa el manejo de estados: loading, error, data.



6\. Verificación de Identidad



Revisa: ¿Las acciones de creación/edición requieren employeeId? Si es así, asegúrate de que se pase correctamente.

