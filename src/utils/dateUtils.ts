import { addDays, isWeekend, format, parseISO, isSameDay } from 'date-fns';

export const FERIADOS_CHILE_2026 = [
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21',
  '2026-06-21', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18',
  '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08',
  '2026-12-25'
].map(d => parseISO(d));

export function isHoliday(date: Date): boolean {
  return FERIADOS_CHILE_2026.some(h => isSameDay(h, date));
}

export function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = startDate;
  let addedDays = 0;
  while (addedDays < days) {
    currentDate = addDays(currentDate, 1);
    if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
      addedDays++;
    }
  }
  return currentDate;
}

export interface Task {
  etapa: 'SOURCING' | 'ADJUDICACIÓN' | 'CONTRATO';
  tarea: string;
  duracion: number;
}

export const TASKS_TEMPLATE: Task[] = [
  { etapa: 'SOURCING', tarea: 'Definición de Alcance', duracion: 1 },
  { etapa: 'SOURCING', tarea: 'Elaboración de Bases', duracion: 2 },
  { etapa: 'SOURCING', tarea: 'Aprobación de Bases', duracion: 1 },
  { etapa: 'SOURCING', tarea: 'Invitación a Cotizar', duracion: 1 },
  { etapa: 'SOURCING', tarea: 'Período de Consultas', duracion: 3 },
  { etapa: 'SOURCING', tarea: 'Respuestas a Consultas', duracion: 2 },
  { etapa: 'SOURCING', tarea: 'Recepción de Ofertas', duracion: 5 },
  { etapa: 'SOURCING', tarea: 'Apertura de Ofertas', duracion: 1 },
  { etapa: 'ADJUDICACIÓN', tarea: 'Evaluación Técnica', duracion: 5 },
  { etapa: 'ADJUDICACIÓN', tarea: 'Evaluación Comercial', duracion: 3 },
  { etapa: 'ADJUDICACIÓN', tarea: 'Cuadro Comparativo', duracion: 2 },
  { etapa: 'ADJUDICACIÓN', tarea: 'Negociación Final', duracion: 2 },
  { etapa: 'ADJUDICACIÓN', tarea: 'Aprobación Minuta Adjudicación', duracion: 2 },
  { etapa: 'ADJUDICACIÓN', tarea: 'Firma Carta Adjudicación', duracion: 1 },
  { etapa: 'CONTRATO', tarea: 'Solicitud de Documentación Proveedor', duracion: 2 },
  { etapa: 'CONTRATO', tarea: 'Revisión Legal Contrato', duracion: 3 },
  { etapa: 'CONTRATO', tarea: 'Generación Orden de Servicio', duracion: 1 },
  { etapa: 'CONTRATO', tarea: 'Firma Orden de Servicio', duracion: 2 },
];

export function generateSchedule(startDate: Date) {
  let currentStart = startDate;
  return TASKS_TEMPLATE.map(task => {
    const start = currentStart;
    const end = addBusinessDays(start, task.duracion);
    currentStart = end; // Next task starts when this one ends
    return {
      ...task,
      fechaInicio: start.toISOString(),
      fechaFin: end.toISOString(),
      diasHabiles: task.duracion
    };
  });
}
