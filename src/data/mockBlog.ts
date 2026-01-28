
import { BlogPost } from '../types';

export const MOCK_BLOG_POSTS: BlogPost[] = [
    {
        id: 1,
        title: '¡Bienvenida a la nueva Suite de RRHH!',
        author: 'Ana García (RRHH)',
        date: '2023-10-01',
        summary: 'Estamos emocionados de lanzar nuestra nueva plataforma interna para mejorar la comunicación y la gestión de recursos humanos.',
        content: `### Un nuevo comienzo

Hoy marca un hito importante para nuestra empresa. Con el lanzamiento de la **Suite de RRHH Pro**, damos un paso adelante en la modernización de nuestros procesos internos. Esta herramienta ha sido diseñada pensando en ti, para que tengas acceso fácil y rápido a tu información laboral, calendarios, y comunicaciones importantes.

### ¿Qué puedes encontrar?

- **Tu Panel Personal:** Un resumen de tus horas, vacaciones y permisos.
- **Calendario Interactivo:** Visualiza tus ausencias y los eventos de la empresa.
- **Noticias y Anuncios:** Mantente al día con todo lo que sucede en la compañía.

¡Explora la herramienta y no dudes en darnos tu feedback!`,
        tags: ['anuncio', 'empresa', 'nuevo'],
        imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c2236033?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
        id: 2,
        title: 'Recordatorio: Cierre de la empresa en Agosto',
        author: 'Dirección',
        date: '2023-09-15',
        summary: 'Como es habitual, la empresa permanecerá cerrada por vacaciones del 1 al 21 de agosto. Por favor, planificad vuestras tareas en consecuencia.',
        content: `Estimados compañeros,

Les recordamos que, como cada año, la empresa realizará su cierre anual por vacaciones durante el mes de agosto. Las fechas de este año son:

- **Último día de trabajo:** 31 de Julio
- **Periodo de cierre:** Del 1 de Agosto al 21 de Agosto (ambos inclusive)
- **Reincorporación:** 22 de Agosto

Durante este periodo, se descontarán 10 días de vacaciones del total anual. Los días restantes se consideran festivos de convenio o a cuenta de la empresa.

Agradecemos vuestra planificación para dejar todos los proyectos importantes cerrados antes de las vacaciones.

¡Que disfrutéis de un merecido descanso!`,
        tags: ['vacaciones', 'planificación', 'recordatorio'],
        imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    },
    {
        id: 3,
        title: 'Nuevas Medidas de Seguridad en Planta',
        author: 'Javier Fernandez (Dirección)',
        date: '2023-09-05',
        summary: 'Se implementarán nuevas señalizaciones y protocolos de seguridad en la zona de soldadura a partir de la próxima semana.',
        content: `La seguridad de nuestros empleados es nuestra máxima prioridad. Por ello, a partir del próximo lunes, se implementarán una serie de mejoras en la seguridad de la planta, con especial atención al departamento de soldadura.

Las medidas incluyen:
1.  **Nueva señalización de áreas de riesgo:** Se han instalado carteles más visibles y claros.
2.  **Uso obligatorio de nuevas pantallas de protección facial:** Se repartirá el nuevo equipo a todo el personal afectado.
3.  **Protocolo de acceso restringido:** Solo el personal autorizado podrá acceder a ciertas zonas de maquinaria pesada.

Habrá una breve sesión formativa obligatoria para todo el personal de planta el viernes a las 14:00h.

Contamos con vuestra colaboración para mantener un entorno de trabajo seguro para todos.`,
        tags: ['seguridad', 'planta', 'protocolos'],
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
    }
];
