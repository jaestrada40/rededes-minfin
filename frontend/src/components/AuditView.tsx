import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Pagination } from './Pagination';
import {
  ShieldAlert, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Calendar, 
  User, 
  Laptop, 
  Copy, 
  Check,
  ShieldCheck,
  Lock,
  Eye,
  Sliders
} from 'lucide-react';
import { AuditLogEntry, UserRole } from '../types';

export const AuditView: React.FC = () => {
  const { auditLogs, user, showNotification } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.feedAffected && log.feedAffected.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.portalAffected && log.portalAffected.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    const matchesResult = resultFilter === 'all' || log.result === resultFilter;

    return matchesSearch && matchesModule && matchesResult;
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha_Hora', 'Usuario', 'Correo', 'Rol', 'Accion', 'Modulo', 'Feed_Afectado', 'Portal_Afectado', 'IP', 'Resultado', 'Detalles'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.userName}"`,
      `"${l.userEmail}"`,
      `"${l.userRole}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.feedAffected || ''}"`,
      `"${l.portalAffected || ''}"`,
      `"${l.ipAddress}"`,
      `"${l.result}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `minfin_auditoria_redes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Reporte de auditoría exportado a archivo CSV.', 'success');
  };

  const handlePrintReport = () => {
    window.print();
  };

  const roleDefinitions = [
    {
      role: 'admin' as UserRole,
      title: 'Administrador DTI',
      description: 'Acceso total a la creación/edición de feeds, asignación de portales, gestión de cuentas y auditoría.',
      permissions: ['Crear/Editar Feeds', 'Agregar/Eliminar Publicaciones', 'Asignar a Portales', 'Configuración de Servidor', 'Ver y Exportar Auditoría']
    },
    {
      role: 'editor' as UserRole,
      title: 'Gestor de Contenido',
      description: 'Permiso para registrar publicaciones, validar IDs y asociar contenido a feeds existentes.',
      permissions: ['Agregar/Eliminar Publicaciones', 'Reordenar Publicaciones', 'Vista Previa de Feeds', 'Consulta de Portales']
    },
    {
      role: 'auditor' as UserRole,
      title: 'Auditor de Control Interno (UDAI)',
      description: 'Monitoreo de trazabilidad, cumplimiento de normativas de comunicación y descarga de bitácoras.',
      permissions: ['Ver Todos los Feeds y Portales', 'Auditoría Completa', 'Exportación de Reportes Forenses']
    },
    {
      role: 'viewer' as UserRole,
      title: 'Consulta Institucional',
      description: 'Solo lectura para dependencias técnicas y consulta de shortcodes disponibles.',
      permissions: ['Ver Feeds', 'Consultar Shortcodes', 'Vista Previa']
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Seguridad y Control Gubernamental
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Registros inmutables DTI
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#003876] mt-1">
            Auditoría, Trazabilidad y Gestión de Roles
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Registro cronológico y detallado de todas las operaciones realizadas sobre los feeds, publicaciones y sincronizaciones con los portales WordPress.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Imprimir Informe Oficial</span>
          </button>
        </div>
      </div>

      {/* Role Matrix Collapsible / Info Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex items-center gap-2 font-bold text-xs uppercase text-[#003876] border-b border-slate-100 pb-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#003876]" />
          <span>Matriz de Roles y Permisos de Acceso</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {roleDefinitions.map((rd) => (
            <div 
              key={rd.role}
              className={`p-3 rounded-lg border flex flex-col justify-between ${
                user.role === rd.role ? 'bg-blue-50/80 border-[#003876]/40 shadow-xs' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{rd.title}</span>
                  {user.role === rd.role && (
                    <span className="text-[10px] bg-[#003876] text-white px-1.5 py-0.2 rounded font-mono font-bold">
                      Su Rol Activo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  {rd.description}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1">
                {rd.permissions.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-700">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Buscar por usuario, acción, portal..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] focus:bg-white"
            />
          </div>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:border-[#003876] cursor-pointer"
          >
            <option value="all">Todos los Módulos</option>
            <option value="Feeds">Feeds</option>
            <option value="Publicaciones">Publicaciones</option>
            <option value="Portales">Portales WordPress</option>
            <option value="Seguridad">Seguridad & Sesión</option>
            <option value="Configuración">Configuración</option>
            <option value="MFA">MFA (2 Factores)</option>
          </select>

          {/* Result Filter */}
          <select
            value={resultFilter}
            onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:border-[#003876] cursor-pointer"
          >
            <option value="all">Todos los Resultados</option>
            <option value="Exitoso">Exitoso</option>
            <option value="Advertencia">Advertencia</option>
            <option value="Fallido">Fallido</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Mostrando <strong>{filteredLogs.length}</strong> eventos registrados
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003876] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold">Fecha / Hora (GTM-6)</th>
                <th className="py-3 px-4 font-bold">Usuario Responsable</th>
                <th className="py-3 px-4 font-bold">Acción Realizada</th>
                <th className="py-3 px-4 font-bold">Módulo</th>
                <th className="py-3 px-4 font-bold">Feed / Portales Afectados</th>
                <th className="py-3 px-4 font-bold">Dirección IP</th>
                <th className="py-3 px-4 font-bold text-center">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No se encontraron registros de auditoría con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* User */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs">
                        {log.userName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {log.userEmail}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {log.action}
                      </div>
                      {log.details && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {log.details}
                        </div>
                      )}
                    </td>

                    {/* Module */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.module}
                      </span>
                    </td>

                    {/* Affected Object */}
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-xs">
                      {log.feedAffected && (
                        <div className="font-medium text-blue-900 truncate">
                          Feed: {log.feedAffected}
                        </div>
                      )}
                      {log.portalAffected && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {log.portalAffected}
                        </div>
                      )}
                      {!log.feedAffected && !log.portalAffected && (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* IP */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {log.ipAddress}
                    </td>

                    {/* Result */}
                    <td className="py-3 px-4 text-center">
                      {log.result === 'Exitoso' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Exitoso
                        </span>
                      )}
                      {log.result === 'Advertencia' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Aviso
                        </span>
                      )}
                      {log.result === 'Fallido' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                          <XCircle className="w-3 h-3 text-red-600" />
                          Fallido
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredLogs.length} onPageChange={setPage} />
      </div>
    </div>
  );
};
