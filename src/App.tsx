/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ListFilter, 
  Calendar, 
  Search, 
  Bell, 
  Cloud, 
  ChevronRight, 
  ChevronDown, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Users,
  PieChart,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateSchedule, isHoliday } from './utils/dateUtils';
import { summarizeLog } from './services/geminiService';

// --- Types ---
interface BitacoraEntry {
  text: string;
  date: string;
  user: string;
}

interface Proceso {
  id: string;
  solped: string;
  nombreOt: string;
  montoUsd: number;
  gestor: string;
  tipoContratacion: string;
  tiempoEstandar: number;
  status: string;
  fechaAsignacion: any;
  bitacora: BitacoraEntry[];
  cronograma: any[];
  createdAt: any;
}

// --- Components ---

const Sidebar = ({ vistaActual, setVistaActual }: { vistaActual: string, setVistaActual: (v: string) => void }) => {
  const menuItems = [
    { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'Nuevo Proceso', icon: PlusCircle, label: 'Registrar Proceso' },
    { id: 'Ver Pipeline', icon: ListFilter, label: 'Ver Pipeline' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#002040] text-white flex flex-col z-50">
      <div className="p-8">
        <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
          <Cloud className="text-blue-400" />
          SupplyNet Control
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setVistaActual(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              vistaActual === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon size={20} />
            <span className="font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-white/10">
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Usuario</p>
          <p className="font-bold text-sm">Admin Control</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-400">Sistema Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

const Header = ({ title }: { title: string }) => (
  <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-40">
    <div className="flex items-center gap-3">
      <Calendar className="text-blue-600" size={20} />
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    </div>
    <div className="flex items-center gap-4">
      <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
        <Bell size={20} />
      </button>
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
        CC
      </div>
    </div>
  </header>
);

const KPI = ({ label, value, icon: Icon, color }: any) => (
  <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${color} flex flex-col justify-between h-32`}>
    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">{label}</span>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-black text-slate-900">{value}</span>
      <Icon className="opacity-10" size={40} />
    </div>
  </div>
);

const Dashboard = ({ procesos, setVistaActual, setProcesoSeleccionado }: any) => {
  const stats = useMemo(() => {
    const total = procesos.length;
    const monto = procesos.reduce((acc: number, p: any) => acc + (p.montoUsd || 0), 0);
    const enProceso = procesos.filter((p: any) => p.status !== 'Adjudicado').length;
    const actualizaciones = procesos.reduce((acc: number, p: any) => acc + (p.bitacora?.length || 0), 0);
    
    return { total, monto, enProceso, actualizaciones };
  }, [procesos]);

  const alerts = useMemo(() => {
    const now = new Date();
    return procesos.map((p: any) => {
      const recepcionOfertas = p.cronograma?.find((t: any) => t.tarea === 'Recepción de Ofertas');
      if (!recepcionOfertas) return null;
      
      const fechaFin = parseISO(recepcionOfertas.fechaFin);
      const diff = differenceInDays(fechaFin, now);
      
      if (diff < 0) return { id: p.id, type: 'vencida', text: `VENCIDA: ${p.nombreOt} (Recepción de Ofertas)`, color: 'bg-red-50 border-red-500 text-red-700' };
      if (diff <= 3) return { id: p.id, type: 'urgente', text: `URGENTE: ${p.nombreOt} vence en ${diff} días`, color: 'bg-amber-50 border-amber-500 text-amber-700' };
      if (diff <= 15) return { id: p.id, type: 'proxima', text: `PRÓXIMA: ${p.nombreOt} vence en ${diff} días`, color: 'bg-blue-50 border-blue-500 text-blue-700' };
      return null;
    }).filter(Boolean);
  }, [procesos]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI label="Total Solpeds" value={stats.total} icon={ListFilter} color="border-blue-600" />
        <KPI label="Monto Total USD" value={`$${(stats.monto / 1000000).toFixed(1)}M`} icon={DollarSign} color="border-emerald-500" />
        <KPI label="En Proceso" value={stats.enProceso} icon={Clock} color="border-orange-500" />
        <KPI label="Actualizaciones" value={stats.actualizaciones} icon={TrendingUp} color="border-purple-500" />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} />
                Centro de Alertas
              </h3>
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Inteligente</span>
            </div>
            <div className="p-6 space-y-4">
              {alerts.length > 0 ? alerts.map((alert: any, i: number) => (
                <div key={i} className={`p-4 border-l-4 rounded-xl ${alert.color} text-xs font-semibold flex items-start gap-3`}>
                  <AlertTriangle size={16} className="shrink-0" />
                  <p>{alert.text}</p>
                </div>
              )) : (
                <p className="text-center text-slate-400 text-sm py-4 italic">No hay alertas críticas hoy.</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-6">Categorías de Gasto</h3>
            <div className="space-y-4">
              {['IT & Hardware', 'Servicios', 'Logística'].map((cat, i) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{cat}</span>
                    <span>{45 - i * 10}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                      style={{ width: `${45 - i * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-6 w-full">Distribución de Montos</h3>
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="50" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                <circle cx="64" cy="64" r="50" fill="transparent" stroke="#2563eb" strokeWidth="12" strokeDasharray="314" strokeDashoffset="100" />
                <circle cx="64" cy="64" r="50" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray="314" strokeDashoffset="250" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black">$2.4M</span>
                <span className="text-[8px] uppercase font-bold text-slate-400">Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Formulario = ({ setVistaActual }: any) => {
  const [formData, setFormData] = useState({
    solped: '',
    nombreOt: '',
    montoUsd: '',
    gestor: 'Carlos Chozas',
    tipoContratacion: 'Licitación Abierta',
    tiempoEstandar: '39',
    status: 'En Análisis',
    observacion: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const schedule = generateSchedule(now);
    
    const docData = {
      ...formData,
      montoUsd: parseFloat(formData.montoUsd),
      tiempoEstandar: parseInt(formData.tiempoEstandar),
      fechaAsignacion: serverTimestamp(),
      createdAt: serverTimestamp(),
      bitacora: [{
        text: formData.observacion || 'Proceso registrado en el sistema.',
        date: now.toISOString(),
        user: 'Admin'
      }],
      cronograma: schedule
    };

    try {
      await addDoc(collection(db, 'procesos'), docData);
      setVistaActual('Ver Pipeline');
    } catch (error) {
      console.error("Error saving process:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-600 mb-2">Nuevo Registro</p>
        <h2 className="text-3xl font-black text-slate-900">Configuración de Pipeline</h2>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">SOLPED</label>
            <input 
              required
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20"
              placeholder="Ej: 10002456"
              value={formData.solped}
              onChange={e => setFormData({...formData, solped: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Nombre OT</label>
            <input 
              required
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20"
              placeholder="Adquisición de Servidores"
              value={formData.nombreOt}
              onChange={e => setFormData({...formData, nombreOt: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Monto USD</label>
              <input 
                required
                type="number"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20"
                placeholder="0.00"
                value={formData.montoUsd}
                onChange={e => setFormData({...formData, montoUsd: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Tiempo Estándar</label>
              <input 
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20"
                value={formData.tiempoEstandar}
                onChange={e => setFormData({...formData, tiempoEstandar: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Gestor Asignado</label>
            <select 
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20"
              value={formData.gestor}
              onChange={e => setFormData({...formData, gestor: e.target.value})}
            >
              {['Carlos Chozas', 'Javier Fuentealba', 'Karen Moyano', 'Tammy Varas'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Tipo Contratación</label>
            <select 
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20"
              value={formData.tipoContratacion}
              onChange={e => setFormData({...formData, tipoContratacion: e.target.value})}
            >
              <option>Licitación Abierta</option>
              <option>Adjudicación Directa</option>
              <option>Cotización</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Observación Inicial</label>
            <textarea 
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20 h-24 resize-none"
              placeholder="Detalles del proceso..."
              value={formData.observacion}
              onChange={e => setFormData({...formData, observacion: e.target.value})}
            />
          </div>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button 
            type="submit"
            className="bg-[#002040] text-white px-10 py-4 rounded-xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-900/20"
          >
            <PlusCircle size={20} />
            REGISTRAR PROCESO
          </button>
        </div>
      </form>
    </div>
  );
};

const Pipeline = ({ procesos, setVistaActual, setProcesoSeleccionado }: any) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<string | null>(null);
  const [newLogText, setNewLogText] = useState('');

  const handleSummarize = async (proceso: Proceso) => {
    setLoadingAi(proceso.id);
    const summary = await summarizeLog(proceso.bitacora);
    setAiSummaries(prev => ({ ...prev, [proceso.id]: summary }));
    setLoadingAi(null);
  };

  const handleAddLog = async (proceso: Proceso) => {
    if (!newLogText.trim()) return;
    const newEntry = {
      text: newLogText,
      date: new Date().toISOString(),
      user: 'Admin'
    };
    const updatedBitacora = [newEntry, ...proceso.bitacora];
    await updateDoc(doc(db, 'procesos', proceso.id), {
      bitacora: updatedBitacora
    });
    setNewLogText('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-widest">
          <tr>
            <th className="px-6 py-4">SOLPED / Nombre</th>
            <th className="px-6 py-4">Monto USD</th>
            <th className="px-6 py-4">Gestor</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {procesos.map((p: Proceso) => (
            <React.Fragment key={p.id}>
              <tr 
                className="hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-blue-600 rounded-full" />
                    <div>
                      <p className="text-[10px] font-bold text-blue-600">#{p.solped}</p>
                      <p className="font-bold text-slate-900">{p.nombreOt}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 font-bold text-slate-700">
                  ${p.montoUsd.toLocaleString()}
                </td>
                <td className="px-6 py-5 text-sm text-slate-500">
                  {p.gestor}
                </td>
                <td className="px-6 py-5">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    p.status === 'Adjudicado' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setProcesoSeleccionado(p);
                        setVistaActual('Cronograma');
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Calendar size={18} />
                    </button>
                    <ChevronDown className={`text-slate-300 transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} size={18} />
                  </div>
                </td>
              </tr>
              <AnimatePresence>
                {expandedId === p.id && (
                  <motion.tr
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <td colSpan={5} className="bg-slate-50/50 px-8 py-8 border-t border-slate-100">
                      <div className="grid grid-cols-12 gap-8">
                        <div className="col-span-12 lg:col-span-7 space-y-6">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 flex items-center gap-2">
                              <ListFilter size={16} />
                              Bitacora Sincronizada
                            </h4>
                            <button 
                              onClick={() => handleSummarize(p)}
                              disabled={loadingAi === p.id}
                              className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50"
                            >
                              <Sparkles size={12} />
                              {loadingAi === p.id ? 'ANALIZANDO...' : 'RESUMEN IA'}
                            </button>
                          </div>

                          {aiSummaries[p.id] && (
                            <div className="bg-blue-600 text-white p-4 rounded-2xl text-xs leading-relaxed shadow-lg shadow-blue-900/20 relative overflow-hidden">
                              <Sparkles className="absolute -right-2 -bottom-2 opacity-20" size={40} />
                              <p className="relative z-10 italic">"{aiSummaries[p.id]}"</p>
                            </div>
                          )}

                          <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {p.bitacora.map((entry, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {entry.user[0]}
                                </div>
                                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex-1">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-[10px] font-bold text-slate-900">{entry.user}</span>
                                    <span className="text-[10px] text-slate-400">{format(parseISO(entry.date), 'dd MMM, HH:mm', { locale: es })}</span>
                                  </div>
                                  <p className="text-xs text-slate-600">{entry.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="relative">
                            <input 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600/20 pr-12"
                              placeholder="Añadir actualización..."
                              value={newLogText}
                              onChange={e => setNewLogText(e.target.value)}
                              onKeyPress={e => e.key === 'Enter' && handleAddLog(p)}
                            />
                            <button 
                              onClick={() => handleAddLog(p)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Send size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="col-span-12 lg:col-span-5 space-y-6">
                          <h4 className="font-bold text-slate-900">Detalles del Proceso</h4>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Tipo</p>
                                <p className="text-xs font-bold">{p.tipoContratacion}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Tiempo Est.</p>
                                <p className="text-xs font-bold">{p.tiempoEstandar} días hábiles</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400">Fecha Asignación</p>
                              <p className="text-xs font-bold">
                                {p.fechaAsignacion instanceof Timestamp 
                                  ? format(p.fechaAsignacion.toDate(), 'PPP', { locale: es })
                                  : 'Pendiente'}
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                setProcesoSeleccionado(p);
                                setVistaActual('Cronograma');
                              }}
                              className="w-full bg-slate-50 text-slate-900 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
                            >
                              VER CRONOGRAMA COMPLETO
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Cronograma = ({ proceso }: { proceso: Proceso }) => {
  if (!proceso) return <div className="text-center p-20 text-slate-400 italic">Seleccione un proceso del pipeline para ver su cronograma.</div>;

  const getEtapaColor = (etapa: string) => {
    switch (etapa) {
      case 'SOURCING': return 'text-blue-600 border-blue-600';
      case 'ADJUDICACIÓN': return 'text-amber-600 border-amber-600';
      case 'CONTRATO': return 'text-emerald-600 border-emerald-600';
      default: return 'text-slate-600 border-slate-600';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-600 mb-2">Detalle de Ruta Crítica</p>
          <h2 className="text-3xl font-black text-slate-900">{proceso.nombreOt}</h2>
          <p className="text-sm text-slate-500 mt-1">SOLPED: #{proceso.solped} • Gestor: {proceso.gestor}</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 text-right">
          <p className="text-[10px] uppercase font-bold text-slate-400">Tiempo Total</p>
          <p className="text-xl font-black text-slate-900">{proceso.tiempoEstandar} Días Hábiles</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="px-6 py-4">Etapa</th>
              <th className="px-6 py-4">Tarea</th>
              <th className="px-6 py-4">Duración</th>
              <th className="px-6 py-4">Inicio</th>
              <th className="px-6 py-4">Fin</th>
              <th className="px-6 py-4 text-center">Días Hábiles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {proceso.cronograma.map((task, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold border-l-4 pl-2 ${getEtapaColor(task.etapa)}`}>
                    {task.etapa}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  {task.tarea}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  {task.duracion} d
                </td>
                <td className="px-6 py-4 text-xs font-mono text-slate-500">
                  {format(parseISO(task.fechaInicio), 'dd/MM/yyyy')}
                </td>
                <td className="px-6 py-4 text-xs font-mono text-slate-500">
                  {format(parseISO(task.fechaFin), 'dd/MM/yyyy')}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold">
                    {task.diasHabiles}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [vistaActual, setVistaActual] = useState('Dashboard');
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<Proceso | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'procesos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Proceso[];
        setProcesos(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore listening error:", error);
        setLoading(false); // Enable UI even if restricted
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar vistaActual={vistaActual} setVistaActual={setVistaActual} />
      
      <main className="flex-1 ml-64">
        <Header title={vistaActual} />
        
        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={vistaActual}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {vistaActual === 'Dashboard' && (
                  <Dashboard 
                    procesos={procesos} 
                    setVistaActual={setVistaActual} 
                    setProcesoSeleccionado={setProcesoSeleccionado} 
                  />
                )}
                {vistaActual === 'Nuevo Proceso' && (
                  <Formulario setVistaActual={setVistaActual} />
                )}
                {vistaActual === 'Ver Pipeline' && (
                  <Pipeline 
                    procesos={procesos} 
                    setVistaActual={setVistaActual} 
                    setProcesoSeleccionado={setProcesoSeleccionado} 
                  />
                )}
                {vistaActual === 'Cronograma' && (
                  <Cronograma proceso={procesoSeleccionado!} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
