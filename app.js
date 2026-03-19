// ================================
// STUDYOS — Lógica principal
// ================================
// Este archivo controla TODA la lógica de la app:
// datos, XP, niveles, renderizado y eventos.


// ================================
// CONFIGURACIÓN GENERAL
// ================================

// La versión de la app. Cámbiala para que aparezca el modal de novedades.
const VERSION = '1.0';

// Clave para guardar en localStorage. Es el "nombre del cajón" donde guardamos.
const STORAGE_KEY = 'studyos_data';

// XP que da cada nivel de dificultad de tarea (1 = fácil, 5 = muy difícil)
const XP_TAREA = {
  1: 5,   // Fácil
  2: 10,   // Normal
  3: 15,   // Media
  4: 25,   // Difícil
  5: 35    // Muy difícil
};

// XP por otras acciones
const XP_TEMA_SABIDO   = 40;   // Marcar un tema como "Me lo sé"
const XP_ASIG_COMPLETA = 200;  // Completar todos los temas de una asignatura
const XP_EXAMEN_BASE   = 100;   // XP base por aprobar un examen (se multiplica por nota)
const XP_CUADRADO      = 2;    // XP por marcar un cuadradito de tarea prorateada
const XP_CUADRADOS_FIN = 10;   // Bonus al terminar todos los cuadraditos

// Estados posibles de un tema, en orden de ciclo
const ESTADOS_TEMA = ['none', 'leyendo', 'repasar', 'sabido'];

// Información visual de cada estado
const ESTADO_INFO = {
  none:    { icon: '○', label: 'No empezado', cls: 'estado-none'    },
  leyendo: { icon: '◉', label: 'Leyendo',     cls: 'estado-leyendo' },
  repasar: { icon: '◈', label: 'Repasar',     cls: 'estado-repasar' },
  sabido:  { icon: '●', label: 'Me lo sé',    cls: 'estado-sabido'  }
};

// Niveles y sus desbloqueos
// Cada entrada tiene el nivel mínimo, el título del usuario y qué se desbloquea
const NIVELES = [
  { nivel: 1,  titulo: 'Estudiante',   desbloqueo: 'Tema Burdeos desbloqueado' },
  { nivel: 3,  titulo: 'Estudiante',    desbloqueo: 'Modo claro desbloqueado' },
  { nivel: 5,  titulo: 'Constante',    desbloqueo: null },
  { nivel: 7,  titulo: 'Constante',     desbloqueo: 'Tema Pizarra desbloqueado' },
  { nivel: 9,  titulo: 'Dedicada',     desbloqueo: null },
  { nivel: 11,  titulo: 'Dedicada',     desbloqueo: 'Tema Tierra desbloqueado'},
  { nivel: 13,  titulo: 'Aplicada',     desbloqueo:  null},
  { nivel: 15,  titulo: 'Aplicada',     desbloqueo: 'Tema Negro total desbloqueado'},
  { nivel: 30,  titulo: 'Imparable',    desbloqueo: null },
  { nivel: 50, titulo: 'Leyenda',      desbloqueo: null },
  { nivel: 70, titulo: 'Magistral',    desbloqueo: null },
  { nivel: 100, titulo: 'Académica',    desbloqueo: null },
];

// Temas de color disponibles
// className es la clase CSS que se aplica al <body>
const TEMAS = {
  bordo:   { label: 'Burdeos',     nivel: 1,  className: 'theme-bordo'   },
  pizarra: { label: 'Pizarra',     nivel: 7,  className: 'theme-pizarra' },
  tierra:  { label: 'Tierra',      nivel: 11,  className: 'theme-tierra'  },
  negro:   { label: 'Negro total', nivel: 15, className: 'theme-negro'   },
};

// Novedades de la versión actual (se muestran en el modal de bienvenida)
const NOVEDADES = {
  '1.0': {
    titulo: 'StudyOS v1.0',
    puntos: [
      'Asignaturas con temas y sistema de estados: No empezado, Leyendo, Repasar, Me lo sé.',
      'Tareas por tema y por asignatura, con fecha límite y dificultad configurable.',
      'Tareas de varios días: divide cualquier tarea en cuadraditos diarios.',
      'Sistema de XP y niveles: gana experiencia completando tareas, temas y exámenes.',
      'Racha diaria: cualquier acción mantiene tu racha activa.',
      'Exámenes con nota final y visualización del estado de cada tema.',
      'Pomodoro personalizable con anillo animado.',
      'Temas de color que se desbloquean al subir de nivel.',
      'Modo claro y oscuro.',
      'Todo se guarda automáticamente en el navegador.',
    ]
  }
};


// ================================
// ESTADO DE LA APP
// ================================
// "state" es el objeto central con todos los datos.
// Se carga desde localStorage al iniciar y se guarda cada vez que cambia algo.

function loadState() {
  // localStorage.getItem devuelve null si no existe nada guardado
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    // JSON.parse convierte el texto guardado de vuelta a un objeto JavaScript
    return JSON.parse(saved);
  }
  // Si no hay datos guardados, devolvemos el estado inicial por defecto
  return {
    user: {
      name: 'Estudiante',
      level: 1,
      xp: 0,           // XP dentro del nivel actual (se resetea al subir)
      totalXp: 0,       // XP acumulada total (nunca baja)
      selectedTheme: 'bordo',
      darkMode: true,
      streak: 0,        // Racha actual en días
      lastActivity: null // Fecha de la última acción (para calcular la racha)
    },
    asignaturas: [],  // Array de asignaturas
    tareas: [],       // Array de tareas (de todas las asignaturas)
    examenes: [],     // Array de exámenes
    actividad: []     // Array de actividad reciente (últimas acciones)
  };
}

function saveState() {
  // JSON.stringify convierte el objeto a texto para poder guardarlo
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Inicializamos el estado cargando los datos guardados
let state = loadState();


// ================================
// UTILIDADES
// ================================

// Genera un ID único combinando tiempo + número aleatorio
function generateId() {
  return Date.now() + '_' + Math.random().toString(36).slice(2);
}

// Devuelve la fecha de hoy en formato "YYYY-MM-DD"
// Ejemplo: "2025-03-15"
function today() {
  return new Date().toISOString().split('T')[0];
}

// Calcula los días que quedan hasta una fecha
// Devuelve un número: positivo = quedan días, 0 = hoy, negativo = pasado
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Ignoramos la hora
  const due = new Date(dateStr + 'T00:00:00');
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

// Formatea los días restantes para mostrar en pantalla
function formatDays(days) {
  if (days === null) return { label: '', cls: '' };
  if (days < 0)   return { label: 'Vencida',    cls: 'vencida' };
  if (days === 0) return { label: '¡Hoy!',      cls: 'urgente' };
  if (days <= 3)  return { label: `${days}d`,   cls: 'urgente' };
  return              { label: `${days} días`,  cls: '' };
}

// Guarda el estado de los acordeones abiertos para restaurarlos después de re-renderizar
function getOpenAccordions() {
  const open = [];
  document.querySelectorAll('.asig-body').forEach((body, i) => {
    if (body.classList.contains('open')) open.push(i);
  });
  return open;
}

// Guarda el estado de los <details> abiertos
function getOpenDetails() {
  const open = [];
  document.querySelectorAll('details').forEach((d, i) => {
    if (d.open) open.push(i);
  });
  return open;
}

// Restaura los acordeones y details abiertos después de re-renderizar
function restoreOpenState(openAccordions, openDetails) {
  document.querySelectorAll('.asig-body').forEach((body, i) => {
    if (openAccordions.includes(i)) {
      body.classList.add('open');
      const arrow = body.previousElementSibling?.querySelector('.asig-arrow');
      if (arrow) arrow.classList.add('open');
    }
  });
  document.querySelectorAll('details').forEach((d, i) => {
    if (openDetails.includes(i)) d.open = true;
  });
}


// ================================
// SISTEMA DE XP Y NIVELES
// ================================

// Calcula cuánta XP hace falta para subir al siguiente nivel
// Fórmula: 400 × nivel_actual
function xpParaSiguienteNivel(nivel) {
  return 400 * nivel * nivel + 200 * nivel; // Fórmula ajustada para que los niveles suban más lentamente
}

// Añade XP al usuario y comprueba si sube de nivel
function addXp(cantidad, descripcion) {
  state.user.xp += cantidad;
  state.user.totalXp += cantidad;

  // Registramos la actividad
  addActividad(descripcion, cantidad);

  // Actualizamos la racha
  updateStreak();

  // Bucle: puede subir varios niveles a la vez si gana mucha XP
  while (state.user.xp >= xpParaSiguienteNivel(state.user.level)) {
    state.user.xp -= xpParaSiguienteNivel(state.user.level);
    state.user.level++;
    showLevelUp();
  }

  saveState();
  renderPerfil();
  renderStats();
}

// Muestra el modal de subida de nivel
function showLevelUp() {
  const nivelInfo = getNivelInfo(state.user.level);
  document.getElementById('levelUpTitle').textContent = `¡Nivel ${state.user.level}!`;
  let msg = `Ahora eres "${nivelInfo.titulo}".`;
  if (nivelInfo.desbloqueo) msg += `\n${nivelInfo.desbloqueo}`;
  document.getElementById('levelUpMsg').textContent = msg;
  document.getElementById('levelUpOverlay').style.display = 'flex';
  renderThemeSelector(); // Actualizamos los temas por si se desbloqueó uno nuevo
}

function closeLevelUp() {
  document.getElementById('levelUpOverlay').style.display = 'none';
}

// Devuelve la información del nivel actual del usuario
function getNivelInfo(nivel) {
  // Buscamos el nivel más alto que el usuario haya alcanzado
  let info = NIVELES[0];
  for (const n of NIVELES) {
    if (nivel >= n.nivel) info = n;
  }
  return info;
}

// Actualiza la racha diaria
function updateStreak() {
  const hoy = today();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toISOString().split('T')[0];

  if (state.user.lastActivity === hoy) {
    // Ya hizo algo hoy, la racha sigue igual
    return;
  } else if (state.user.lastActivity === ayerStr) {
    // Hizo algo ayer, la racha continúa
    state.user.streak++;
  } else {
    // No hizo nada ayer, la racha se reinicia
    state.user.streak = 1;
  }
  state.user.lastActivity = hoy;
}

// Registra una acción en el historial de actividad reciente
function addActividad(descripcion, xp) {
  // Añadimos al principio del array para que lo más reciente aparezca primero
  state.actividad.unshift({
    texto: descripcion,
    xp: xp,
    fecha: today()
  });
  // Mantenemos solo las últimas 20 acciones
  if (state.actividad.length > 20) {
    state.actividad = state.actividad.slice(0, 20);
  }
}


// ================================
// NAVEGACIÓN
// ================================

// Muestra la página indicada y oculta el resto
function navigateTo(page) {
  // Lista de todas las páginas
  const pages = ['inicio', 'asignaturas', 'examenes', 'pomodoro'];

  // Ocultamos todas las páginas
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = 'none';
  });

  // Mostramos la página activa
  const active = document.getElementById(`page-${page}`);
  if (active) active.style.display = 'block';

  // Actualizamos el botón activo en la navbar
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`.nav-btn[onclick="navigateTo('${page}')"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Si navegamos a exámenes, actualizamos el select de asignaturas
  if (page === 'examenes') renderExamenSelect();
}


// ================================
// TEMAS Y MODO
// ================================

// Aplica el tema y el modo guardado en state
function applyTheme() {
  const body = document.body;

  // Quitamos todas las clases de tema
  Object.values(TEMAS).forEach(t => body.classList.remove(t.className));

  // Añadimos la clase del tema seleccionado
  const tema = TEMAS[state.user.selectedTheme];
  if (tema) body.classList.add(tema.className);

  // Aplicamos el modo claro/oscuro
  if (state.user.darkMode) {
    body.classList.remove('light-mode');
  } else {
    body.classList.add('light-mode');
  }
}

// Alterna entre modo claro y oscuro
function toggleMode() {
  // Si está en nivel < 3, el modo claro no está desbloqueado
  if (!state.user.darkMode && state.user.level < 3) {
    alert('El modo claro se desbloquea en nivel 3.');
    return;
  }
  state.user.darkMode = !state.user.darkMode;
  saveState();
  applyTheme();
}

// Abre el modal de ajustes
function openSettings() {
  renderThemeSelector();
  document.getElementById('settingsOverlay').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settingsOverlay').style.display = 'none';
}

// Renderiza los botones de selección de tema
function renderThemeSelector() {
  const container = document.getElementById('themeSelector');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(TEMAS).forEach(([key, tema]) => {
    const desbloqueado = state.user.level >= tema.nivel;
    const activo = state.user.selectedTheme === key;

    const btn = document.createElement('button');
    // Construimos la lista de clases del botón
    btn.className = 'theme-btn' +
      (activo ? ' active' : '') +
      (!desbloqueado ? ' locked' : '');

    btn.textContent = desbloqueado
      ? tema.label
      : `🔒 ${tema.label} (Nv. ${tema.nivel})`;

    btn.addEventListener('click', () => {
      if (!desbloqueado) return;
      state.user.selectedTheme = key;
      saveState();
      applyTheme();
      renderThemeSelector();
    });

    container.appendChild(btn);
  });
}


// ================================
// EDITAR NOMBRE
// ================================

function editName() {
  // prompt() abre una ventana emergente con un campo de texto
  const nombre = prompt('Tu nombre:', state.user.name);
  if (nombre && nombre.trim()) {
    state.user.name = nombre.trim();
    saveState();
    renderPerfil();
  }
}


// ================================
// RENDERIZADO DEL PERFIL
// ================================

function renderPerfil() {
  // Actualizamos cada elemento del perfil con los datos del state

  const nivelInfo = getNivelInfo(state.user.level);

  // Nombre
  const nameEl = document.getElementById('playerName');
  if (nameEl) nameEl.textContent = state.user.name;

  // Título del nivel (en la cabecera)
  const titleEl = document.getElementById('userTitle');
  if (titleEl) titleEl.textContent = nivelInfo.titulo;

  // Nivel
  const levelEl = document.getElementById('levelText');
  if (levelEl) levelEl.textContent = `Nivel ${state.user.level}`;

  // XP
  const xpEl = document.getElementById('xpText');
  const needed = xpParaSiguienteNivel(state.user.level);
  if (xpEl) xpEl.textContent = `${state.user.xp} / ${needed}`;

  // Barra de XP
  const fillEl = document.getElementById('xpFill');
  if (fillEl) {
    const pct = Math.min((state.user.xp / needed) * 100, 100);
    fillEl.style.width = `${pct}%`;
  }

  // Racha
  const streakEl = document.getElementById('streakText');
  if (streakEl) streakEl.textContent = `${state.user.streak} días`;

  const streakIcon = document.getElementById('streakIcon');
  if (streakIcon) {
    // El icono cambia según la racha
    if (state.user.streak >= 30)     streakIcon.textContent = '★';
    else if (state.user.streak >= 14) streakIcon.textContent = '◆';
    else if (state.user.streak >= 7)  streakIcon.textContent = '●';
    else if (state.user.streak >= 1)  streakIcon.textContent = '○';
    else                              streakIcon.textContent = '○';
  }

  // Lista de desbloqueos
  const unlockList = document.getElementById('unlockList');
  if (unlockList) {
    unlockList.innerHTML = '';
    NIVELES.forEach(n => {
      if (state.user.level >= n.nivel) {
        const li = document.createElement('li');
        li.textContent = `Nv. ${n.nivel} — ${n.titulo}${n.desbloqueo ? ': ' + n.desbloqueo : ''}`;
        unlockList.appendChild(li);
      }
    });
  }

  // Actividad reciente
  const actEl = document.getElementById('actividadList');
  if (actEl) {
    if (state.actividad.length === 0) {
      actEl.innerHTML = '<p class="empty-msg">Aún no hay actividad. ¡Empieza estudiando!</p>';
    } else {
      actEl.innerHTML = '';
      state.actividad.slice(0, 8).forEach(act => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
          <span>${act.texto}</span>
          <span class="activity-xp">+${act.xp} XP</span>
        `;
        actEl.appendChild(div);
      });
    }
  }
}


// ================================
// ESTADÍSTICAS RÁPIDAS
// ================================

function renderStats() {
  // Contamos tareas pendientes
  const pendientes = state.tareas.filter(t => !t.done).length;
  const statTareas = document.getElementById('statTareas');
  if (statTareas) statTareas.textContent = pendientes;

  // Contamos temas dominados (estado "sabido")
  let temasSabidos = 0;
  state.asignaturas.forEach(a => {
    (a.temas || []).forEach(t => {
      if (t.estado === 'sabido') temasSabidos++;
    });
  });
  const statTemas = document.getElementById('statTemas');
  if (statTemas) statTemas.textContent = temasSabidos;

  // Contamos exámenes próximos (en los próximos 30 días)
  const proximos = state.examenes.filter(e => {
    const d = daysUntil(e.fecha);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const statExam = document.getElementById('statExamenes');
  if (statExam) statExam.textContent = proximos;

  // XP total
  const statXp = document.getElementById('statXpTotal');
  if (statXp) statXp.textContent = state.user.totalXp;
}


// ================================
// ASIGNATURAS
// ================================

// Añade una nueva asignatura
function addAsignatura(e) {
  e.preventDefault();
  // e.preventDefault() cancela el comportamiento por defecto del formulario
  // (que sería recargar la página)

  const input = document.getElementById('asignaturaInput');
  const nombre = input.value.trim();
  if (!nombre) return;

  state.asignaturas.push({
    id: generateId(),
    nombre,
    notas: '',
    temas: [],
    progreso: 0
  });

  saveState();
  renderAsignaturas();
  input.value = ''; // Limpiamos el input
}

// Elimina una asignatura y todas sus tareas
function deleteAsignatura(id) {
  if (!confirm('¿Eliminar esta asignatura y todas sus tareas?')) return;
  const asig = state.asignaturas.find(a => a.id === id);
  if (asig) {
    // Borramos también las tareas de esta asignatura
    state.tareas = state.tareas.filter(t => t.asignaturaId !== id);
  }
  state.asignaturas = state.asignaturas.filter(a => a.id !== id);
  saveState();
  renderAsignaturas();
  renderStats();
}

// Abre/cierra el acordeón de una asignatura
function toggleAccordion(id) {
  const body = document.getElementById(`body-${id}`);
  const arrow = document.getElementById(`arrow-${id}`);
  if (!body) return;
  body.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
}

// Guarda las notas de una asignatura (se llama al escribir en el textarea)
function saveNota(asigId, value) {
  const asig = state.asignaturas.find(a => a.id === asigId);
  if (asig) asig.notas = value;
  saveState();
}

// ---- TEMAS ----

// Muestra/oculta el formulario para añadir un tema
function toggleAddTema(asigId) {
  const form = document.getElementById(`add-tema-${asigId}`);
  if (!form) return;
  form.classList.toggle('visible');
  if (form.classList.contains('visible')) {
    form.querySelector('input')?.focus();
  }
}

// Añade un tema a una asignatura
function addTema(asigId) {
  const input = document.getElementById(`tema-input-${asigId}`);
  const nombre = input?.value.trim();
  if (!nombre) return;

  const asig = state.asignaturas.find(a => a.id === asigId);
  if (!asig) return;

  if (!asig.temas) asig.temas = [];
  asig.temas.push({
    id: generateId(),
    nombre,
    estado: 'none',
    notas: ''
  });

  saveState();

  // Guardamos el estado de la UI antes de re-renderizar
  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
}

// Elimina un tema
function deleteTema(asigId, temaId) {
  if (!confirm('¿Eliminar este tema y sus tareas?')) return;
  const asig = state.asignaturas.find(a => a.id === asigId);
  if (!asig) return;
  asig.temas = (asig.temas || []).filter(t => t.id !== temaId);
  // Borramos también las tareas de este tema
  state.tareas = state.tareas.filter(t => !(t.asignaturaId === asigId && t.temaId === temaId));
  saveState();
  recalcularProgreso(asigId);
  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
}

// Avanza el estado de un tema al siguiente en el ciclo
function cycleTemaEstado(asigId, temaId) {
  const asig = state.asignaturas.find(a => a.id === asigId);
  if (!asig) return;
  const tema = (asig.temas || []).find(t => t.id === temaId);
  if (!tema) return;

  const estadoAnterior = tema.estado;
  const idx = ESTADOS_TEMA.indexOf(tema.estado || 'none');
  tema.estado = ESTADOS_TEMA[(idx + 1) % ESTADOS_TEMA.length];

  // Si pasamos a "sabido", damos XP
  if (tema.estado === 'sabido' && estadoAnterior !== 'sabido') {
    addXp(XP_TEMA_SABIDO, `Tema dominado: ${tema.nombre}`);
    // Comprobamos si todos los temas de la asignatura están "sabidos"
    comprobarAsigCompleta(asigId);
  }
  // Si quitamos "sabido", no quitamos XP (ya está ganado)

  saveState();
  recalcularProgreso(asigId);
  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
}

// Comprueba si todos los temas de una asignatura están dominados
function comprobarAsigCompleta(asigId) {
  const asig = state.asignaturas.find(a => a.id === asigId);
  if (!asig || !asig.temas || asig.temas.length === 0) return;
  const todosSabidos = asig.temas.every(t => t.estado === 'sabido');
  if (todosSabidos && !asig.bonusCompleta) {
    asig.bonusCompleta = true; // Marcamos para no dar el bonus dos veces
    addXp(XP_ASIG_COMPLETA, `¡${asig.nombre} completada!`);
  }
}

// Muestra/oculta el campo de notas de un tema
function toggleNotaTema(temaId) {
  const el = document.getElementById(`nota-tema-${temaId}`);
  if (!el) return;
  el.classList.toggle('visible');
  if (el.classList.contains('visible')) el.querySelector('textarea')?.focus();
}

// Guarda las notas de un tema
function saveNotaTema(asigId, temaId, value) {
  const asig = state.asignaturas.find(a => a.id === asigId);
  const tema = (asig?.temas || []).find(t => t.id === temaId);
  if (tema) tema.notas = value;
  saveState();
}

// ---- TAREAS ----

// Muestra/oculta el formulario de añadir tarea (de asignatura o de tema)
function toggleAddTarea(asigId, temaId = null) {
  const key = temaId ? `add-tarea-${asigId}-${temaId}` : `add-tarea-${asigId}`;
  const form = document.getElementById(key);
  if (!form) return;
  form.classList.toggle('visible');
  if (form.classList.contains('visible')) form.querySelector('input')?.focus();
}

// Añade una tarea (puede ir a una asignatura o a un tema)
function addTarea(asigId, temaId = null) {
  const key = temaId ? `add-tarea-${asigId}-${temaId}` : `add-tarea-${asigId}`;
  const form = document.getElementById(key);
  if (!form) return;

  const titulo = form.querySelector('.tarea-titulo-input')?.value.trim();
  const fecha = form.querySelector('.tarea-fecha-input')?.value || null;
  const dificultad = parseInt(form.querySelector('.tarea-dif-input')?.value) || 1;
  const dias = parseInt(form.querySelector('.tarea-dias-input')?.value) || 0;
  // dias > 0 significa que es una tarea prorateada

  if (!titulo) return;

  const tarea = {
    id: generateId(),
    titulo,
    asignaturaId: asigId,
    temaId: temaId,
    dificultad,
    xp: XP_TAREA[dificultad] || 10,
    fecha,
    done: false,
    notas: '',
    // Si tiene días, creamos un array de booleanos (false = no marcado)
    diasTotal: dias > 0 ? dias : 0,
    diasMarcados: dias > 0 ? new Array(dias).fill(false) : []
  };

  state.tareas.push(tarea);
  saveState();

  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
}

// Marca/desmarca una tarea como completada
function toggleTarea(id) {
  const tarea = state.tareas.find(t => t.id === id);
  if (!tarea) return;

  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();

  if (!tarea.done) {
    // Solo damos XP al completar, no al descompletar
    tarea.done = true;
    addXp(tarea.xp, `Tarea completada: ${tarea.titulo}`);
    recalcularProgreso(tarea.asignaturaId);
  } else {
    tarea.done = false;
  }

  saveState();
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
  renderStats();
}

// Elimina una tarea
function deleteTarea(id) {
  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();
  state.tareas = state.tareas.filter(t => t.id !== id);
  saveState();
  recalcularProgreso(); // Recalculamos todas las asignaturas
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
  renderStats();
}

// Marca un cuadradito de una tarea prorateada
function toggleCuadrado(tareaId, index) {
  const tarea = state.tareas.find(t => t.id === tareaId);
  if (!tarea) return;

  const openAcc = getOpenAccordions();
  const openDet = getOpenDetails();

  // Solo se puede marcar, no desmarcar (para mantener la racha honesta)
  if (!tarea.diasMarcados[index]) {
    tarea.diasMarcados[index] = true;
    addXp(XP_CUADRADO, `Progreso en: ${tarea.titulo}`);

    // Si todos los cuadraditos están marcados, damos el bonus
    const todosCompletos = tarea.diasMarcados.every(d => d);
    if (todosCompletos && !tarea.bonusCuadrados) {
      tarea.bonusCuadrados = true;
      addXp(XP_CUADRADOS_FIN, `¡${tarea.titulo} completada!`);
      tarea.done = true;
    }
  }

  saveState();
  renderAsignaturas();
  restoreOpenState(openAcc, openDet);
}

// Muestra/oculta el campo de notas de una tarea
function toggleNotaTarea(id) {
  const el = document.getElementById(`nota-tarea-${id}`);
  if (!el) return;
  el.classList.toggle('visible');
  if (el.classList.contains('visible')) el.querySelector('textarea')?.focus();
}

// Guarda las notas de una tarea
function saveNotaTarea(id, value) {
  const tarea = state.tareas.find(t => t.id === id);
  if (tarea) tarea.notas = value;
  saveState();
}

// ---- PROGRESO ----

// Recalcula el progreso de una o todas las asignaturas
// 70% temas dominados + 30% tareas completadas
function recalcularProgreso(asigId = null) {
  const asigs = asigId
    ? state.asignaturas.filter(a => a.id === asigId)
    : state.asignaturas;

  asigs.forEach(asig => {
    const temas = asig.temas || [];
    const tareas = state.tareas.filter(t => t.asignaturaId === asig.id);

    // Porcentaje de temas dominados
    let pctTemas = 0;
    if (temas.length > 0) {
      const sabidos = temas.filter(t => t.estado === 'sabido').length;
      pctTemas = (sabidos / temas.length) * 100;
    }

    // Porcentaje de tareas completadas
    let pctTareas = 0;
    if (tareas.length > 0) {
      const hechas = tareas.filter(t => t.done).length;
      pctTareas = (hechas / tareas.length) * 100;
    }

    // Mixto: si no hay temas, todo viene de tareas y viceversa
    if (temas.length === 0 && tareas.length === 0) {
      asig.progreso = 0;
    } else if (temas.length === 0) {
      asig.progreso = Math.round(pctTareas);
    } else if (tareas.length === 0) {
      asig.progreso = Math.round(pctTemas);
    } else {
      // 70% temas + 30% tareas
      asig.progreso = Math.round(pctTemas * 0.7 + pctTareas * 0.3);
    }
  });

  saveState();
}

// ---- RENDERIZADO DE ASIGNATURAS ----

function renderAsignaturas() {
  const container = document.getElementById('asignaturasList');
  if (!container) return;
  container.innerHTML = '';

  if (state.asignaturas.length === 0) {
    container.innerHTML = '<p class="empty-msg">Añade tu primera asignatura arriba.</p>';
    return;
  }

  state.asignaturas.forEach((asig, asigIdx) => {
    const tareas = state.tareas.filter(t => t.asignaturaId === asig.id);
    const pendientes = tareas.filter(t => !t.done).length;
    const pct = asig.progreso || 0;

    const div = document.createElement('div');
    div.className = 'asig-accordion';
    div.innerHTML = `
      <!-- CABECERA DEL ACORDEÓN -->
      <div class="asig-header" onclick="toggleAccordion('${asig.id}')">
        <span class="asig-nombre">${asig.nombre}</span>
        <div class="asig-meta">
          ${pendientes > 0 ? `<span class="badge">${pendientes}</span>` : ''}
          <div class="mini-bar">
            <div class="mini-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="asig-pct">${pct}%</span>
        </div>
        <button class="btn-danger" onclick="event.stopPropagation();deleteAsignatura('${asig.id}')">✕</button>
        <span class="asig-arrow" id="arrow-${asig.id}">▼</span>
      </div>

      <!-- CUERPO DEL ACORDEÓN -->
      <div class="asig-body" id="body-${asig.id}">

        <!-- Notas de la asignatura -->
        <div class="inner-label">
          Notas generales
        </div>
        <textarea class="asig-notes" placeholder="Apuntes, resúmenes..."
          onchange="saveNota('${asig.id}', this.value)"
          style="width:100%;margin-bottom:8px">${asig.notas || ''}</textarea>

        <!-- TEMAS -->
        <div class="inner-label">
          Temas
          <button class="add-btn" onclick="toggleAddTema('${asig.id}')">+ Añadir</button>
        </div>

        <!-- Formulario añadir tema -->
        <div class="mini-form" id="add-tema-${asig.id}">
          <input type="text" id="tema-input-${asig.id}" placeholder="Nombre del tema..." />
          <button class="btn-primary" onclick="addTema('${asig.id}')">Añadir</button>
        </div>

        <!-- Lista de temas -->
        <div id="temas-${asig.id}">
          ${renderTemasHTML(asig)}
        </div>

        <!-- TAREAS SUELTAS DE LA ASIGNATURA -->
        <div class="inner-label" style="margin-top:16px">
          Tareas generales
          <button class="add-btn" onclick="toggleAddTarea('${asig.id}')">+ Añadir</button>
        </div>

        <!-- Formulario añadir tarea suelta -->
        <div class="mini-form" id="add-tarea-${asig.id}">
          <input type="text" class="tarea-titulo-input" placeholder="Tarea..." style="flex:2" />
          <input type="date" class="tarea-fecha-input" title="Fecha límite" />
          <select class="tarea-dif-input" title="Dificultad">
            <option value="1">★ Fácil</option>
            <option value="2">★★ Normal</option>
            <option value="3" selected>★★★ Media</option>
            <option value="4">★★★★ Difícil</option>
            <option value="5">★★★★★ Muy difícil</option>
          </select>
          <input type="number" class="tarea-dias-input" placeholder="Días (opt.)" min="0" max="30" title="Dividir en N días" style="width:80px" />
          <button class="btn-primary" onclick="addTarea('${asig.id}')">Añadir</button>
        </div>

        <!-- Lista de tareas sueltas -->
        ${renderTareasHTML(asig.id, null)}

      </div>
    `;

    container.appendChild(div);
  });
}

// Renderiza los temas de una asignatura como HTML
function renderTemasHTML(asig) {
  const temas = asig.temas || [];
  if (temas.length === 0) {
    return '<p class="empty-msg" style="font-size:0.82rem">Sin temas todavía.</p>';
  }

  return temas.map(tema => {
    const info = ESTADO_INFO[tema.estado || 'none'];
    // Tareas de este tema
    const tareasTema = state.tareas.filter(t => t.asignaturaId === asig.id && t.temaId === tema.id);
    const pendientesTema = tareasTema.filter(t => !t.done).length;

    return `
      <div class="tema-row">
        <!-- Botón de estado (clic para cambiar) -->
        <button class="tema-estado-btn" onclick="cycleTemaEstado('${asig.id}', '${tema.id}')"
          title="Cambiar estado">${info.icon}</button>

        <span class="tema-nombre">${tema.nombre}</span>

        ${pendientesTema > 0 ? `<span class="badge" style="font-size:0.65rem">${pendientesTema}</span>` : ''}

        <!-- Etiqueta del estado -->
        <span class="tema-estado-label ${info.cls}">${info.label}</span>

        <!-- Botones de acción del tema -->
        <button class="btn-secondary" style="font-size:0.72rem;padding:3px 8px"
          onclick="toggleAddTarea('${asig.id}', '${tema.id}')">+ Tarea</button>
        <button class="btn-secondary" style="font-size:0.72rem;padding:3px 8px"
          onclick="toggleNotaTema('${tema.id}')">📝</button>
        <button class="btn-danger" onclick="deleteTema('${asig.id}', '${tema.id}')">✕</button>
      </div>

      <!-- Notas del tema -->
      <div class="nota-box ${tema.notas ? 'visible' : ''}" id="nota-tema-${tema.id}">
        <textarea placeholder="Notas del tema..."
          onchange="saveNotaTema('${asig.id}', '${tema.id}', this.value)">${tema.notas || ''}</textarea>
      </div>

      <!-- Formulario añadir tarea al tema -->
      <div class="mini-form" id="add-tarea-${asig.id}-${tema.id}" style="margin-left:24px">
        <input type="text" class="tarea-titulo-input" placeholder="Tarea del tema..." style="flex:2" />
        <input type="date" class="tarea-fecha-input" title="Fecha límite" />
        <select class="tarea-dif-input" title="Dificultad">
          <option value="1">★ Fácil</option>
          <option value="2">★★ Normal</option>
          <option value="3" selected>★★★ Media</option>
          <option value="4">★★★★ Difícil</option>
          <option value="5">★★★★★ Muy difícil</option>
        </select>
        <input type="number" class="tarea-dias-input" placeholder="Días" min="0" max="30" style="width:70px" />
        <button class="btn-primary" onclick="addTarea('${asig.id}', '${tema.id}')">Añadir</button>
      </div>

      <!-- Tareas de este tema -->
      ${renderTareasHTML(asig.id, tema.id)}
    `;
  }).join('');
}

// Renderiza las tareas de una asignatura/tema
function renderTareasHTML(asigId, temaId) {
  // Filtramos las tareas que pertenecen a este contexto
  const todas = state.tareas.filter(t =>
    t.asignaturaId === asigId && t.temaId === temaId
  );
  const pendientes = todas.filter(t => !t.done);
  const completadas = todas.filter(t => t.done);

  if (todas.length === 0) return '';

  const indent = temaId ? 'margin-left:24px' : '';

  // Renderizamos tareas pendientes
  let html = `<div style="${indent}">`;

  pendientes.forEach(t => {
    const { label, cls } = formatDays(daysUntil(t.fecha));
    // Estrellas de dificultad
    const estrellas = '★'.repeat(t.dificultad);

    html += `
      <div class="tarea-item">
        <input type="checkbox" onchange="toggleTarea('${t.id}')"
          style="accent-color:var(--accent)">
        <span class="tarea-titulo">${t.titulo}</span>
        <span class="tarea-dificultad">${estrellas}</span>
        ${label ? `<span class="tarea-fecha ${cls}">📅 ${label}</span>` : ''}
        <button class="btn-secondary" style="font-size:0.7rem;padding:2px 6px"
          onclick="toggleNotaTarea('${t.id}')">📝</button>
        <button class="btn-danger" onclick="deleteTarea('${t.id}')">✕</button>
      </div>

      <!-- Cuadraditos de días (si la tarea es prorateada) -->
      ${t.diasTotal > 0 ? `
        <div class="dias-grid">
          ${t.diasMarcados.map((marcado, i) => `
            <div class="dia-cuadrado ${marcado ? 'marcado' : ''}"
              onclick="toggleCuadrado('${t.id}', ${i})"
              title="Día ${i + 1}"></div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Notas de la tarea -->
      <div class="nota-box ${t.notas ? 'visible' : ''}" id="nota-tarea-${t.id}">
        <textarea placeholder="Notas de la tarea..."
          onchange="saveNotaTarea('${t.id}', this.value)">${t.notas || ''}</textarea>
      </div>
    `;
  });

  // Desplegable de completadas
  if (completadas.length > 0) {
    html += `
      <details class="completadas-details">
        <summary>Completadas (${completadas.length})</summary>
        ${completadas.map(t => `
          <div class="tarea-item done">
            <input type="checkbox" checked onchange="toggleTarea('${t.id}')"
              style="accent-color:var(--accent)">
            <span class="tarea-titulo">${t.titulo}</span>
            <button class="btn-danger" onclick="deleteTarea('${t.id}')">✕</button>
          </div>
        `).join('')}
      </details>
    `;
  }

  html += '</div>';
  return html;
}


// ================================
// EXÁMENES
// ================================

// Actualiza el select de asignaturas en el formulario de exámenes
function renderExamenSelect() {
  const select = document.getElementById('examenAsignatura');
  if (!select) return;
  select.innerHTML = '<option value="">Asignatura...</option>';
  state.asignaturas.forEach(asig => {
    const opt = document.createElement('option');
    opt.value = asig.id;
    opt.textContent = asig.nombre;
    select.appendChild(opt);
  });
}

// Añade un examen
function addExamen(e) {
  e.preventDefault();
  const asigId = document.getElementById('examenAsignatura').value;
  const fecha = document.getElementById('examenFecha').value;
  const nota = document.getElementById('examenNota').value;
  const notaMax = document.getElementById('examenNotaMax').value || 10;

  if (!asigId || !fecha) return;

  const examen = {
    id: generateId(),
    asignaturaId: asigId,
    fecha,
    nota: nota !== '' ? parseFloat(nota) : null,
    notaMax: parseFloat(notaMax),
    xpDado: false // Para no dar XP dos veces
  };

  // Si ya tiene nota y es aprobado, damos XP inmediatamente
  if (examen.nota !== null) {
    darXpExamen(examen);
  }

  state.examenes.push(examen);
  saveState();
  renderExamenes();
  e.target.reset();
}

// Calcula y da XP por un examen aprobado
function darXpExamen(examen) {
  if (examen.xpDado) return;
  const aprobado = examen.nota >= examen.notaMax / 2; // Aprobado si >= la mitad
  if (!aprobado) return;

  // Más nota = más XP (proporcionalmente)
  const proporcion = examen.nota / examen.notaMax;
  const xp = Math.round(XP_EXAMEN_BASE * proporcion * 2);
  examen.xpDado = true;
  addXp(xp, `Examen aprobado: ${getNombreAsig(examen.asignaturaId)}`);
}

// Devuelve el nombre de una asignatura por su id
function getNombreAsig(id) {
  return state.asignaturas.find(a => a.id === id)?.nombre || 'Asignatura';
}

// Elimina un examen
function deleteExamen(id) {
  state.examenes = state.examenes.filter(e => e.id !== id);
  saveState();
  renderExamenes();
}

// Añade la nota a un examen existente
function addNotaExamen(id) {
  const input = document.getElementById(`nota-input-${id}`);
  const maxInput = document.getElementById(`notamax-input-${id}`);
  if (!input) return;

  const nota = parseFloat(input.value);
  const notaMax = parseFloat(maxInput?.value) || 10;
  if (isNaN(nota)) return;

  const examen = state.examenes.find(e => e.id === id);
  if (!examen) return;

  examen.nota = nota;
  examen.notaMax = notaMax;
  darXpExamen(examen);
  saveState();
  renderExamenes();
  renderStats();
}

// Renderiza la lista de exámenes
function renderExamenes() {
  const container = document.getElementById('examenesList');
  if (!container) return;
  container.innerHTML = '';

  if (state.examenes.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin exámenes registrados.</p>';
    return;
  }

  // Ordenamos por fecha
  const ordenados = [...state.examenes].sort((a, b) =>
    new Date(a.fecha) - new Date(b.fecha)
  );

  ordenados.forEach(examen => {
    const asig = state.asignaturas.find(a => a.id === examen.asignaturaId);
    const temas = asig?.temas || [];
    const days = daysUntil(examen.fecha);
    const pasado = days !== null && days < 0;

    // Clase y texto para los días
    let diasCls = 'ok';
    let diasTxt = `En ${days} días`;
    if (days === 0) { diasCls = 'urgente'; diasTxt = '¡Hoy!'; }
    else if (days > 0 && days <= 7) { diasCls = 'urgente'; diasTxt = `En ${days} días`; }
    else if (pasado) { diasCls = 'vencido'; diasTxt = 'Ya pasó'; }

    // Nota
    let notaHTML = '';
    if (examen.nota !== null) {
      const aprobado = examen.nota >= examen.notaMax / 2;
      const cls = aprobado ? 'aprobado' : 'suspenso';
      notaHTML = `<p class="examen-nota ${cls}">
        Nota: ${examen.nota} / ${examen.notaMax} — ${aprobado ? 'Aprobado ✓' : 'Suspenso ✗'}
      </p>`;
    } else {
      // Si no tiene nota todavía, mostramos un formulario para añadirla
      notaHTML = `
        <div class="mini-form visible" style="margin-top:8px">
          <input type="number" id="nota-input-${examen.id}" placeholder="Nota" min="0" step="0.1" style="width:80px" />
          <input type="number" id="notamax-input-${examen.id}" placeholder="Sobre" value="${examen.notaMax}" min="1" style="width:70px" />
          <button class="btn-secondary" onclick="addNotaExamen('${examen.id}')">Guardar nota</button>
        </div>
      `;
    }

    // Chips de estado de temas
    const temasHTML = temas.length > 0 ? `
      <div class="temas-chips">
        ${temas.map(t => {
          const info = ESTADO_INFO[t.estado || 'none'];
          return `<span class="tema-chip ${info.cls}">${info.icon} ${t.nombre}</span>`;
        }).join('')}
      </div>
    ` : '';

    const div = document.createElement('div');
    div.className = 'examen-item';
    div.innerHTML = `
      <div class="examen-header">
        <div>
          <div class="examen-asig">${asig?.nombre || 'Asignatura eliminada'}</div>
          <div class="examen-fecha">${examen.fecha}</div>
        </div>
        <button class="btn-danger" onclick="deleteExamen('${examen.id}')">✕</button>
      </div>
      <p class="examen-dias ${diasCls}">${diasTxt}</p>
      ${notaHTML}
      ${temasHTML}
    `;

    container.appendChild(div);
  });
}


// ================================
// POMODORO
// ================================

// Calculamos la longitud del anillo para animarlo
// Circunferencia = 2π × radio. El radio del círculo SVG es 54.
const CIRCUMFERENCE = 2 * Math.PI * 54;

// Inicializamos el anillo
const ringEl = document.getElementById('ringProgress');
if (ringEl) {
  ringEl.style.strokeDasharray = CIRCUMFERENCE;
  ringEl.style.strokeDashoffset = 0;
}

let pomodoroInterval = null;  // Referencia al intervalo activo
let pomodoroWorking = true;   // true = sesión de trabajo, false = descanso
let pomodoroSeconds = 25 * 60; // Segundos restantes
let pomodoroTotal = 25 * 60;  // Total de segundos de la sesión

// Actualiza el display del pomodoro (tiempo + anillo + color)
function updatePomodoroDisplay() {
  // Formateamos los minutos y segundos con dos dígitos
  const min = String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0');
  const sec = String(pomodoroSeconds % 60).padStart(2, '0');

  const display = document.getElementById('pomodoroDisplay');
  if (display) display.textContent = `${min}:${sec}`;

  // Actualizamos el anillo SVG
  // El offset va de 0 (lleno) a CIRCUMFERENCE (vacío)
  const progress = pomodoroSeconds / pomodoroTotal;
  const offset = CIRCUMFERENCE * (1 - progress);
  if (ringEl) {
    ringEl.style.strokeDashoffset = offset;
    // El color sigue el tema actual
    const style = getComputedStyle(document.documentElement);
    ringEl.style.stroke = pomodoroWorking
      ? style.getPropertyValue('--accent').trim()
      : style.getPropertyValue('--muted').trim();
  }
}

// Actualiza los botones del pomodoro según el estado
function updatePomodoroButtons(estado) {
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');

  if (!btnStart || !btnPause) return;

  // Quitamos las clases activas
  btnStart.classList.remove('active-start');
  btnPause.classList.remove('active-pause');

  // Añadimos la clase correspondiente al estado
  if (estado === 'running') btnStart.classList.add('active-start');
  else if (estado === 'paused') btnPause.classList.add('active-pause');
}

function startPomodoro() {
  if (pomodoroInterval) return; // Ya está corriendo
  updatePomodoroButtons('running');

  pomodoroInterval = setInterval(() => {
    pomodoroSeconds--;
    updatePomodoroDisplay();

    if (pomodoroSeconds <= 0) {
      // Tiempo agotado: cambiamos entre trabajo y descanso
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroWorking = !pomodoroWorking;

      const workMin = parseInt(document.getElementById('workMinutes')?.value) || 25;
      const breakMin = parseInt(document.getElementById('breakMinutes')?.value) || 5;
      pomodoroTotal = pomodoroWorking ? workMin * 60 : breakMin * 60;
      pomodoroSeconds = pomodoroTotal;

      const status = document.getElementById('pomodoroStatus');
      if (status) status.textContent = pomodoroWorking ? 'Trabajo' : 'Descanso';

      updatePomodoroDisplay();
      startPomodoro(); // Arrancamos la siguiente sesión automáticamente
    }
  }, 1000); // Se ejecuta cada 1000ms = 1 segundo
}

function pausePomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  updatePomodoroButtons('paused');
}

function resetPomodoro() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroWorking = true;
  const workMin = parseInt(document.getElementById('workMinutes')?.value) || 25;
  pomodoroTotal = workMin * 60;
  pomodoroSeconds = pomodoroTotal;
  const status = document.getElementById('pomodoroStatus');
  if (status) status.textContent = 'Trabajo';
  updatePomodoroDisplay();
  updatePomodoroButtons('stopped');
}

// Cuando cambian los minutos configurados, reiniciamos
document.getElementById('workMinutes')?.addEventListener('change', resetPomodoro);
document.getElementById('breakMinutes')?.addEventListener('change', resetPomodoro);


// ================================
// MODAL DE BIENVENIDA / VERSIÓN
// ================================

function checkWelcome() {
  const seen = localStorage.getItem('studyos_version');
  if (seen === VERSION) return; // Ya vio esta versión

  const novedades = NOVEDADES[VERSION];
  if (!novedades) return;

  const html = `
    <h3>${novedades.titulo}</h3>
    <p style="color:var(--muted);font-size:0.85rem;margin-bottom:12px">Novedades de esta versión:</p>
    <ol style="padding-left:18px;line-height:2.2;font-size:0.85rem">
      ${novedades.puntos.map(p => `<li>${p}</li>`).join('')}
    </ol>
  `;

  document.getElementById('welcomeContent').innerHTML = html;
  document.getElementById('welcomeOverlay').style.display = 'flex';
}

function closeWelcome() {
  localStorage.setItem('studyos_version', VERSION);
  document.getElementById('welcomeOverlay').style.display = 'none';
}


// ================================
// INICIO DE LA APLICACIÓN
// ================================
// DOMContentLoaded garantiza que este bloque se ejecuta solo cuando
// el HTML está 100% cargado y todos los elementos existen en el DOM.

document.addEventListener('DOMContentLoaded', function () {
  // Aplicamos el tema y el modo guardado
  applyTheme();

  // Renderizamos todo
  renderPerfil();
  renderStats();
  renderAsignaturas();
  renderExamenes();
  updatePomodoroDisplay();

  // Comprobamos si hay novedades que mostrar
  checkWelcome();
});