import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const ROLE_NAMES = ['admin', 'editor', 'auditor', 'viewer'] as const;

const PORTALS = [
  { name: 'Portal Principal MINFIN', domain: 'minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.10', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Portal web matriz y oficial del Ministerio de Finanzas Públicas de Guatemala.' },
  { name: 'Portal de Transparencia Fiscal', domain: 'transparencia.minfin.gob.gt', category: 'Transparencia', ipAddress: '190.85.120.11', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Plataforma ciudadana de rendición de cuentas, ejecución presupuestaria y compras.' },
  { name: 'Portal Presupuesto Abierto', domain: 'presupuestoabierto.minfin.gob.gt', category: 'Finanzas', ipAddress: '190.85.120.12', wpVersion: '6.7.1', pluginVersion: 'v2.4.1', description: 'Talleres, metodologías y formulación presupuestaria abierta con la sociedad civil.' },
  { name: 'Guatecompras (Portal Informativo)', domain: 'info.guatecompras.gt', category: 'Sistemas', ipAddress: '190.85.120.15', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Sección informativa y comunicados del Sistema de Contrataciones y Adquisiciones del Estado.' },
  { name: 'Sistema SICOIN Web Info', domain: 'sicoin.minfin.gob.gt', category: 'Sistemas', ipAddress: '190.85.120.16', wpVersion: '6.6.3', pluginVersion: 'v2.4.0', description: 'Manuales, avisos de mantenimiento y normativas del Sistema de Contabilidad Integrada.' },
  { name: 'Portal de Datos Abiertos MINFIN', domain: 'datos.minfin.gob.gt', category: 'Transparencia', ipAddress: '190.85.120.18', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Catálogos de datos abiertos en formatos interoperables (CSV, JSON, XML).' },
  { name: 'Registro General de Proveedores del Estado (RGL)', domain: 'rgl.minfin.gob.gt', category: 'Sistemas', ipAddress: '190.85.120.20', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Información institucional, requisitos de habilitación y precalificación de contratistas.' },
  { name: 'Dirección Técnica del Presupuesto (DTP)', domain: 'dtp.minfin.gob.gt', category: 'Direcciones', ipAddress: '190.85.120.22', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Guías de formulación, techos presupuestarios y clasificadores del gasto público.' },
  { name: 'Dirección de Crédito Público (DCP)', domain: 'creditopublico.minfin.gob.gt', category: 'Direcciones', ipAddress: '190.85.120.25', wpVersion: '6.7.1', pluginVersion: 'v2.4.1', description: 'Estadísticas de deuda pública, colocación de Eurobonos y Bonos del Tesoro de Guatemala.' },
  { name: 'Portal de Capacitaciones DTI - MINFIN', domain: 'capacitacion.minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.30', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Cursos virtuales sobre SIGES, SICOIN, Guatecompras y gestión fiscal.' },
  { name: 'Dirección de Contabilidad del Estado (DCE)', domain: 'contabilidad.minfin.gob.gt', category: 'Direcciones', ipAddress: '190.85.120.32', wpVersion: '6.7.0', pluginVersion: 'v2.4.1', description: 'Liquidaciones presupuestarias anuales, estados financieros del Estado y balance general.' },
  { name: 'Dirección de Bienes del Estado (DBE)', domain: 'bienesdelestado.minfin.gob.gt', category: 'Direcciones', ipAddress: '190.85.120.35', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Registro de bienes inmuebles del Estado, desadscripciones y trámites de terrenos.' },
  { name: 'Dirección de Asistencia a la Administración Financiera (DAAFIM)', domain: 'daafim.minfin.gob.gt', category: 'Direcciones', ipAddress: '190.85.120.40', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Asesoría y acompañamiento a municipalidades y entidades descentralizadas.' },
  { name: 'Portal Normativo Fiscal y Leyes', domain: 'normativa.minfin.gob.gt', category: 'Transparencia', ipAddress: '190.85.120.42', wpVersion: '6.7.1', pluginVersion: 'v2.4.1', description: 'Acuerdos ministeriales, decretos, reglamentos tributarios y manuales vigentes.' },
  { name: 'Dirección de Fideicomisos', domain: 'fideicomisos.minfin.gob.gt', category: 'Finanzas', ipAddress: '190.85.120.45', wpVersion: '6.6.4', pluginVersion: 'v2.4.0', description: 'Auditorías, estados de cuenta e informes trimestrales de fideicomisos públicos.' },
  { name: 'Portal de Becas y Cooperación Financiera', domain: 'cooperacion.minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.48', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Gestión de donaciones internacionales y convenios de organismos multilaterales (BID, BM).' },
  { name: 'Tribunal Administrativo Tributario y Aduanero (TRIBUTA)', domain: 'tributa.minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.50', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Resoluciones, criterios jurisprudenciales y convocatorias de vistas públicas.' },
  { name: 'Portal de Empleo y Convocatorias MINFIN', domain: 'empleo.minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.52', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Convocatorias públicas bajo renglones 011, 022 y 029 de la Dirección de Recursos Humanos.' },
  { name: 'Observatorio del Gasto Social', domain: 'observatorio.minfin.gob.gt', category: 'Transparencia', ipAddress: '190.85.120.55', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Métricas de inversión en salud, educación, nutrición infantil e infraestructura vial.' },
  { name: 'Dirección de Análisis Fiscal y Macroeconomía', domain: 'macro.minfin.gob.gt', category: 'Finanzas', ipAddress: '190.85.120.58', wpVersion: '6.7.1', pluginVersion: 'v2.4.1', description: 'Boletines de coyuntura económica, recaudación tributaria y metas macrofiscales.' },
  { name: 'Portal de Compras Eficientes para Municipalidades', domain: 'comprasmunicipales.minfin.gob.gt', category: 'Sistemas', ipAddress: '190.85.120.60', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Guías simplificadas de compras directas y cotizaciones para las 340 municipalidades.' },
  { name: 'Portal Internacional de Inversionistas MINFIN', domain: 'investors.minfin.gob.gt', category: 'Finanzas', ipAddress: '190.85.120.62', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Sovereign Debt Investor Relations portal for international rating agencies and bondholders.' },
  { name: 'Ventanilla Única de Trámites Fiscales', domain: 'tramites.minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.65', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Gestión electrónica de solvencias, certificaciones de pago a proveedores y consultas.' },
  { name: 'Portal del Archivo General de Finanzas', domain: 'archivo.minfin.gob.gt', category: 'Institucional', ipAddress: '190.85.120.68', wpVersion: '6.6.5', pluginVersion: 'v2.4.0', description: 'Catálogo histórico de memoria de labores y registros financieros de la República.' },
  { name: 'Portal de Auditoría Interna (UDAI)', domain: 'auditoria.minfin.gob.gt', category: 'Transparencia', ipAddress: '190.85.120.70', wpVersion: '6.7.2', pluginVersion: 'v2.4.1', description: 'Planes anuales de auditoría, control interno gubernamental y código de ética.' },
];

const OFFICIAL_ACCOUNTS = {
  x: { network: 'x', handle: '@MinfinGT', url: 'https://x.com/MinfinGT', verified: true, name: 'Ministerio de Finanzas Públicas', description: 'Cuenta oficial del Ministerio de Finanzas Públicas de la República de Guatemala.', avatarUrl: '' },
  facebook: { network: 'facebook', handle: 'minfin.gt', url: 'https://facebook.com/minfin.gt', verified: true, name: 'Ministerio de Finanzas Públicas de Guatemala', description: 'Página verificada institucional del Gobierno de Guatemala.', avatarUrl: '' },
  instagram: { network: 'instagram', handle: '@minfingua', url: 'https://instagram.com/minfingua', verified: true, name: 'MINFIN Guatemala', description: 'Transparencia, finanzas públicas y desarrollo para Guatemala.', avatarUrl: '' },
  youtube: { network: 'youtube', handle: '@MinfinGuatemalaOficial', url: 'https://youtube.com/@MinfinGuatemalaOficial', verified: true, name: 'MINFIN Guatemala Oficial', description: 'Canal oficial de videos, tutoriales y transmisiones en directo.', avatarUrl: '' },
  linkedin: { network: 'linkedin', handle: 'minfingobgt', url: 'https://linkedin.com/company/minfingobgt', verified: true, name: 'Ministerio de Finanzas Públicas (MINFIN)', description: 'Entidad rectora de las finanzas públicas del Estado de Guatemala.', avatarUrl: '' },
  tiktok: { network: 'tiktok', handle: '@minfingua', url: 'https://tiktok.com/@minfingua', verified: true, name: 'MINFIN Educa', description: 'Cápsulas educativas sobre presupuesto y transparencia.', avatarUrl: '' },
};

async function main() {
  for (const name of ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@minfin.gob.gt';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Administrador DTI',
      roleId: adminRole.id,
      mfaEnabled: false,
    },
  });

  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      institutionName: 'Ministerio de Finanzas Públicas de Guatemala (MINFIN)',
      webhookSecret: crypto.randomBytes(32).toString('hex'),
      allowedCorsDomains: ['*.minfin.gob.gt', '*.guatecompras.gt', 'minfin.gob.gt', 'guatecompras.gt'],
      officialAccounts: OFFICIAL_ACCOUNTS,
    },
  });

  // Portales de demostración: no se siembran por defecto para permitir registrar
  // portales reales uno por uno desde la UI. Descomentar para poblar datos de ejemplo.
  // for (const portal of PORTALS) {
  //   await prisma.wordPressPortal.upsert({
  //     where: { domain: portal.domain },
  //     update: {},
  //     create: { ...portal, tokenValid: true, webhookEnabled: true },
  //   });
  // }

  console.log(`Seed completo. Usuario admin: ${email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
