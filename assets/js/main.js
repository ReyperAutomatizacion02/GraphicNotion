const CANVAS_SIZE = 8000;
const CANVAS_CENTER_OFFSET = CANVAS_SIZE / 2 - 500;

const dbData = [
    { id: 'db_clients', name: 'Clientes', icon: '🏢', color: 'purple', position: { x: 200 + CANVAS_CENTER_OFFSET, y: 100 + CANVAS_CENTER_OFFSET }, properties: [{ name: 'Nombre Cliente', type: 'Text' }, { name: 'Contacto Principal', type: 'Person' }, { name: 'Proyectos Activos', type: 'Relation', relationTo: 'db_projects' }, { name: 'Industria', type: 'Select' }] },
    { id: 'db_projects', name: 'Proyectos', icon: '🚀', color: 'blue', position: { x: 200 + CANVAS_CENTER_OFFSET, y: 300 + CANVAS_CENTER_OFFSET }, properties: [{ name: 'Nombre Proyecto', type: 'Text' }, { name: 'Tareas Activas', type: 'Relation', relationTo: 'db_tasks' }, { name: 'Tareas Archivadas', type: 'Relation', relationTo: 'db_tasks' }, { name: 'Cliente', type: 'Relation', relationTo: 'db_clients' }, { name: 'Documentación', type: 'Relation', relationTo: 'db_docs' }, { name: 'Líder de Proyecto', type: 'Person' }, { name: 'Estado', type: 'Select' }] },
    { id: 'db_tasks', name: 'Tareas', icon: '✅', color: 'green', position: { x: 200 + CANVAS_CENTER_OFFSET, y: 500 + CANVAS_CENTER_OFFSET }, properties: [{ name: 'Nombre Tarea', type: 'Text' }, { name: 'Asignado a', type: 'Person' }, { name: 'Fecha Límite', type: 'Date' }, { name: 'Horas Estimadas', type: 'Number' }, { name: 'Proyecto', type: 'Relation', relationTo: 'db_projects' }, { name: 'Sprint', type: 'Relation', relationTo: 'db_sprints' }] },
    { id: 'db_sprints', name: 'Sprints', icon: '🏃‍♂️', color: 'orange', position: { x: 600 + CANVAS_CENTER_OFFSET, y: 500 + CANVAS_CENTER_OFFSET }, properties: [{ name: 'Nombre Sprint', type: 'Text' }, { name: 'Fecha Inicio', type: 'Date' }, { name: 'Fecha Fin', type: 'Date' }, { name: 'Tareas Incluidas', type: 'Relation', relationTo: 'db_tasks' }] },
    { id: 'db_docs', name: 'Documentos', icon: '📄', color: 'teal', position: { x: 600 + CANVAS_CENTER_OFFSET, y: 300 + CANVAS_CENTER_OFFSET }, properties: [ { name: 'Título', type: 'Text' }, { name: 'Proyecto', type: 'Relation', relationTo: 'db_projects' } ] }
];

const state = { dbVisibility: {}, draggedNode: null, draggedHandle: null, isPanning: false, transform: { scale: 1, translateX: 0, translateY: 0 }, customControlPoints: new Map()};

const canvasContainer = document.getElementById('canvas-container');
const canvasTransformer = document.getElementById('canvas-transformer');
const canvas = document.getElementById('canvas');
const relationsSvg = document.getElementById('relations-svg');
const dbTogglesContainer = document.getElementById('db-toggles');
const themeToggle = document.getElementById('theme-toggle');
const appDiv = document.getElementById('app');
const hideSidebarBtn = document.getElementById('hide-sidebar-btn');
const showSidebarBtn = document.getElementById('show-sidebar-btn');

function setTheme(theme) {
    const isDark = theme === 'dark';
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
    // Solo cambiamos el fondo del área de trabajo, no el sidebar
    document.body.className = isDark ? 'bg-slate-900' : 'bg-gray-100';
    const main = document.getElementById('canvas-container');
    if (main) main.className = isDark ? 'flex-1 relative overflow-hidden bg-gray-900' : 'flex-1 relative overflow-hidden bg-gray-50';
    // No modificar la clase del sidebar aquí
    const indicator = document.getElementById('theme-toggle-indicator');
    if (indicator) {
        indicator.classList.remove('translate-x-6', 'translate-x-1');
        indicator.classList.add(isDark ? 'translate-x-6' : 'translate-x-1');
    }
    renderAllNodes();
    renderControls();
}

function applyTransform() {
    const { scale, translateX, translateY } = state.transform;
    canvasTransformer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}
function renderAllNodes() {
    if (groupDragInProgress) return; // No re-renderizar durante drag grupal
    const scrollPos = dbTogglesContainer.scrollTop;
    canvas.innerHTML = '';
    dbData.forEach( db => canvas.appendChild(createDbNode(db)));
    updateNodeVisibility();
    drawRelations();
    dbTogglesContainer.scrollTop = scrollPos;
}
function updateNodeVisibility() {
    dbData.forEach(db => {
        const node = document.getElementById(db.id);
        if (node) node.style.display = state.dbVisibility[db.id] ? 'block' : 'none';
    });
}

function getHeaderClasses(color) {
    const colorMap = {
        blue:   'bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-100',
        green:  'bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-100',
        purple: 'bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-100',
        orange: 'bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-100',
        teal:   'bg-teal-100 dark:bg-teal-900/50 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-100',
        default: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100'
    };
    return colorMap[color] || colorMap.default;
}

// --- Selección múltiple y movimiento conjunto ---
state.selectedNodes = new Set();
let isShiftDown = false;
let groupDragStart = null;
let groupDragOrigin = null;
let groupDragInProgress = false;

// --- Evitar re-render de nodos seleccionados antes del drag grupal ---
function createDbNode(db) {
    const node = document.createElement('div');
    node.id = db.id;
    node.className = 'db-node absolute w-64 rounded-lg border fade-in pointer-events-auto bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600';
    node.style.left = `${db.position.x}px`;
    node.style.top = `${db.position.y}px`;

    // Detectar si el color es un nombre o un valor hex/hsl
    const isNamedColor = typeof db.color === 'string' && /^[a-z]+$/.test(db.color);
    const headerClasses = isNamedColor ? getHeaderClasses(db.color) : '';
    const headerBgClasses = isNamedColor ? headerClasses.split(' ').filter(c => !c.startsWith('text-')).join(' ') : '';
    const headerTextClasses = isNamedColor ? headerClasses.split(' ').filter(c => c.startsWith('text-')).join(' ') : '';

    // Contraste para texto blanco o negro según fondo
    function getContrastText(bgColor) {
        // Si es hsl, convertir a rgb
        let r, g, b;
        if (bgColor.startsWith('hsl')) {
            const [h, s, l] = bgColor.match(/\d+/g).map(Number);
            // Conversión HSL a RGB
            const a = s / 100 * Math.min(l / 100, 1 - l / 100);
            const f = n => {
                const k = (n + h / 30) % 12;
                const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color);
            };
            r = f(0); g = f(8); b = f(4);
        } else if (bgColor.startsWith('#')) {
            const hex = bgColor.replace('#', '');
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            // fallback: texto oscuro
            return 'text-gray-900';
        }
        // Luminancia
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.6 ? 'text-gray-900' : 'text-white';
    }

    let headerStyle = '';
    let headerTextClass = '';
    if (!isNamedColor) {
        headerStyle = `background:${db.color}; border-bottom:2px solid ${db.color};`;
        headerTextClass = getContrastText(db.color);
    }

    const propTypeClasses = (type) => {
        const map = {
            'Text': 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
            'Number': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
            'Date': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
            'Relation': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
            'Person': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
            'Select': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
            'Formula': 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200',
            'Checkbox': 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
            'Button': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
            'Rollup': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
            'MultiSelect': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
            'Status': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
            'Email': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            'Phone': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            'URL': 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
            'CreatedTime': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
            'LastEditedTime': 'bg-gray-300 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
            'CreatedBy': 'bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100',
            'LastEditedBy': 'bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100',
            'People': 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
            'Files': 'bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100',
            'Title': 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100',
        };
        return map[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    };

    // --- NUEVO: Estado de visibilidad de propiedades por bloque ---
    if (!state.hiddenProperties) state.hiddenProperties = {};
    if (!state.hiddenProperties[db.id]) state.hiddenProperties[db.id] = new Set();

    let propertiesHtml = '';
    let saveButtonHtml = '';
    if (state.editingBlockId === db.id) {
        // Botón Guardar para salir de edición
        saveButtonHtml = `<button class="save-edit-btn bg-indigo-600 text-white rounded px-2 py-1 mb-2 hover:bg-indigo-700 w-full">Guardar</button>`;
        // Modo edición: mostrar checkboxes para cada propiedad
        propertiesHtml = db.properties.map((prop, idx) => {
            const checked = !state.hiddenProperties[db.id].has(prop.name);
            return `<div class="flex items-center gap-2 p-2">
                <input type="checkbox" class="prop-visibility-checkbox" data-prop="${encodeURIComponent(prop.name)}" ${checked ? 'checked' : ''}>
                <span class="text-sm text-gray-700 dark:text-gray-300">${prop.name}</span>
                <span class="prop-type px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${propTypeClasses(prop.type)}">${prop.type}</span>
            </div>`;
        }).join('');
    } else {
        // Normal: solo mostrar las propiedades visibles
        propertiesHtml = db.properties.filter(prop => !state.hiddenProperties[db.id].has(prop.name)).map(prop => 
            `<div class="flex justify-between items-center p-3">
                <span class="text-sm text-gray-700 dark:text-gray-300">${prop.name}</span>
                <span class="prop-type px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${propTypeClasses(prop.type)}">${prop.type}</span>
            </div>`
        ).join('');
    }

    node.innerHTML = `
        <div class="header p-3 border-b rounded-t-lg flex items-center gap-2 ${headerBgClasses} ${headerTextClass}" style="${headerStyle}">
            <span class="text-lg">${db.icon}</span>
            <h3 class="font-semibold ${headerTextClass}">${db.name}</h3>
        </div>
        <div class="properties-container divide-y divide-gray-200 dark:divide-gray-600">${saveButtonHtml}${propertiesHtml}</div>`;

    // Si es color personalizado, aplicar el fondo directamente
    if (!isNamedColor) {
        const header = node.querySelector('.header');
        header.style.background = db.color;
        header.style.borderBottom = `2px solid ${db.color}`;
        header.style.color = headerTextClass === 'text-white' ? '#fff' : '#111827';
        node.querySelector('h3').style.color = headerTextClass === 'text-white' ? '#fff' : '#111827';
    }

    // --- NUEVO: listeners para checkboxes y botón Guardar en modo edición ---
    if (state.editingBlockId === db.id) {
        node.querySelectorAll('.prop-visibility-checkbox').forEach(input => {
            input.addEventListener('change', function() {
                const propName = decodeURIComponent(this.getAttribute('data-prop'));
                if (this.checked) {
                    state.hiddenProperties[db.id].delete(propName);
                } else {
                    state.hiddenProperties[db.id].add(propName);
                }
                // No salir de edición aún
            });
        });
        // Botón Guardar para salir de edición
        const saveBtn = node.querySelector('.save-edit-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                state.editingBlockId = null;
                renderAllNodes();
            });
        }
    } else {
        node.querySelector('.header').addEventListener('click', () => {
            node.querySelector('.properties-container').classList.toggle('hidden');
            drawRelations();
        });
    }

    node.addEventListener('mousedown', startNodeDrag);
    node.addEventListener('mouseover', () => highlightConnections(node.id, true));
    node.addEventListener('mouseout', () => highlightConnections(node.id, false));
    // Selección múltiple con Shift
    node.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (isShiftDown) {
            if (state.selectedNodes.has(db.id)) {
                state.selectedNodes.delete(db.id);
                node.classList.remove('selected');
            } else {
                state.selectedNodes.add(db.id);
                node.classList.add('selected');
            }
            updateSelectionUI(); // Ahora existe aunque sea vacía
            e.stopPropagation();
            return;
        } else if (state.selectedNodes.size > 1 && state.selectedNodes.has(db.id)) {
            // Iniciar drag grupal
            groupDragStart = { x: e.clientX, y: e.clientY };
            groupDragOrigin = Array.from(state.selectedNodes).map(id => {
                const d = dbData.find(d => d.id === id);
                return { id, x: d.position.x, y: d.position.y };
            });
            document.addEventListener('mousemove', groupNodeDrag);
            document.addEventListener('mouseup', endGroupNodeDrag);
            e.preventDefault();
            e.stopPropagation();
            return;
        } else {
            // Selección simple
            state.selectedNodes.clear();
            document.querySelectorAll('.db-node.selected').forEach(n => n.classList.remove('selected'));
            state.selectedNodes.add(db.id);
            node.classList.add('selected');
            updateSelectionUI(); // Ahora existe aunque sea vacía
        }
        startNodeDrag(e);
    });
    // Visual feedback
    if (state.selectedNodes.has(db.id)) node.classList.add('selected');
    // --- Ocultar seleccionados con clic derecho ---
    node.addEventListener('contextmenu', function(e) {
        if (state.selectedNodes && state.selectedNodes.size > 0 && state.selectedNodes.has(db.id)) {
            e.preventDefault();
            const isDark = document.documentElement.classList.contains('dark');
            showCustomContextMenu(e.clientX, e.clientY, isDark);
        }
    });
    return node;
}

// Drag grupal
function groupNodeDrag(e) {
    if (!groupDragStart || !groupDragOrigin) return;
    groupDragInProgress = true;
    const dx = (e.clientX - groupDragStart.x) / state.transform.scale;
    const dy = (e.clientY - groupDragStart.y) / state.transform.scale;
    groupDragOrigin.forEach(({ id, x, y }) => {
        const db = dbData.find(d => d.id === id);
        db.position.x = x + dx;
        db.position.y = y + dy;
        const node = document.getElementById(id);
        if (node) {
            node.style.left = `${db.position.x}px`;
            node.style.top = `${db.position.y}px`;
        }
    });
    drawRelations();
}
function endGroupNodeDrag() {
    groupDragStart = null;
    groupDragOrigin = null;
    setTimeout(() => { groupDragInProgress = false; }, 100); // Espera a que termine el mouseup antes de permitir renderAllNodes
    document.removeEventListener('mousemove', groupNodeDrag);
    document.removeEventListener('mouseup', endGroupNodeDrag);
    drawRelations();
}

// Shift key tracking
window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') isShiftDown = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') isShiftDown = false;
});

function drawRelations() {
    relationsSvg.innerHTML = '';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    // Mapa para evitar duplicar marcadores
    const markerMap = new Map();

    // Crear relaciones agrupadas por pares
    const relationsByPair = new Map();
    dbData.forEach(db => {
        if (!state.dbVisibility[db.id]) return;
        db.properties.forEach(prop => {
            if (prop.type === 'Relation' && prop.relationTo && state.dbVisibility[prop.relationTo]) {
                const key = `${db.id}--${prop.relationTo}`;
                if (!relationsByPair.has(key)) relationsByPair.set(key, []);
                relationsByPair.get(key).push({
                    source: db.id,
                    target: prop.relationTo,
                    name: prop.name,
                    color: db.color // Usar el color real del bloque de origen
                });
            }
        });
    });

    // Crear marcadores SVG personalizados para cada color
    dbData.forEach(db => {
        if (!state.dbVisibility[db.id]) return;
        const color = db.color;
        if (!markerMap.has(color)) {
            const markerId = `arrowhead-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', markerId);
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('refX', '8');
            marker.setAttribute('refY', '5');
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('orient', 'auto-start-reverse');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
            path.setAttribute('fill', color);
            marker.appendChild(path);
            defs.appendChild(marker);
            markerMap.set(color, markerId);
        }
    });
    relationsSvg.appendChild(defs);

    for (const [key, relations] of relationsByPair.entries()) {
        const total = relations.length;
        relations.forEach((rel, index) => {
            const lineGroup = createRelationLine(rel, index, total, markerMap);
            if (lineGroup) relationsSvg.appendChild(lineGroup);
        });
    }

    // --- Ajustar tamaño de etiquetas según zoom (proporcional al zoom) ---
    const baseFontSize = 36; // tamaño base aumentado
    const fontSize = baseFontSize * state.transform.scale;
    document.querySelectorAll('.relation-label').forEach(label => {
        label.setAttribute('font-size', `${fontSize}`);
        // Ajustar el desplazamiento vertical para mantener centrado
        const y = label.getAttribute('y');
        if (y !== null) {
            // El -4 es el offset original, ajustamos proporcionalmente
            const baseOffset = -6 * state.transform.scale / 1.0; // ajusta el offset al zoom y tamaño base
            const x = label.getAttribute('x');
            if (x !== null) label.setAttribute('y', parseFloat(y.split('.')[0]) - baseOffset);
        }
    });
}

function getDistributedConnectionPoint(rect, side, index, total) {
    const { x, y, width, height } = rect;
    // Mejor distribución: margen mínimo y separación uniforme
    const margin = 24; // margen mínimo desde el borde
    let spacing, pointOffset;
    if (side === 'left' || side === 'right') {
        spacing = (height - 2 * margin) / (total > 1 ? total - 1 : 1);
        pointOffset = margin + (total === 1 ? height / 2 - margin : index * spacing);
        if (side === 'right') return { x: x + width, y: y + pointOffset };
        if (side === 'left') return { x: x, y: y + pointOffset };
    } else {
        spacing = (width - 2 * margin) / (total > 1 ? total - 1 : 1);
        pointOffset = margin + (total === 1 ? width / 2 - margin : index * spacing);
        if (side === 'top') return { x: x + pointOffset, y: y };
        if (side === 'bottom') return { x: x + pointOffset, y: y + height };
    }
    return { x: x + width / 2, y: y + height / 2 };
}

function createRelationLine(relation, index, total, markerMap) {
    const { source: sourceId, target: targetId, name, color } = relation;
    const sourceNode = document.getElementById(sourceId);
    const targetNode = document.getElementById(targetId);
    if (!sourceNode || !targetNode || !sourceNode.offsetParent || !targetNode.offsetParent) return null;
    // Si el bloque está minimizado, usar el header como referencia
    const getRect = (node) => {
        const props = node.querySelector('.properties-container');
        if (props && props.classList.contains('hidden')) {
            // Minimizado: usar header
            const header = node.querySelector('.header');
            return { x: node.offsetLeft, y: node.offsetTop, width: header.offsetWidth, height: header.offsetHeight };
        } else {
            // Normal
            return { x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
        }
    };
    const sourceRect = getRect(sourceNode);
    const targetRect = getRect(targetNode);
    const startCenter = { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height / 2 };
    const endCenter = { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 };
    const angle = Math.atan2(endCenter.y - startCenter.y, endCenter.x - startCenter.x);
    let sourceSide, targetSide;
    if (angle > -Math.PI / 4 && angle <= Math.PI / 4) { sourceSide = 'right'; targetSide = 'left'; }
    else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) { sourceSide = 'bottom'; targetSide = 'top'; }
    else if (angle > 3 * Math.PI / 4 || angle <= -3 * Math.PI / 4) { sourceSide = 'left'; targetSide = 'right'; }
    else { sourceSide = 'top'; targetSide = 'bottom'; }
    const startPoint = getDistributedConnectionPoint(sourceRect, sourceSide, index, total);
    const endPoint = getDistributedConnectionPoint(targetRect, targetSide, index, total);
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if(length === 0) return null;
    const perpVec = { x: -dy / length, y: dx / length };
    const relationKey = `${sourceId}-${targetId}-${name}`;
    let controlPoint = state.customControlPoints.get(relationKey);
    if (!controlPoint) {
            // Calcular la curvatura y el ángulo de separación para flechas paralelas
            // Alternar arriba/abajo y distribuir uniformemente
            let direction = (index % 2 === 0) ? 1 : -1; // alterna arriba/abajo
            let order = Math.floor(index / 2) + 1;
            const baseCurvature = 30 + Math.max(0, total - 2) * 8; // más separación si hay muchas
            const curvature = direction * order * baseCurvature;
            controlPoint = {
            x: startPoint.x + dx / 2 + perpVec.x * curvature,
            y: startPoint.y + dy / 2 + perpVec.y * curvature,
        };
    }
    // Crear el path de la línea
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${startPoint.x} ${startPoint.y} Q ${controlPoint.x} ${controlPoint.y}, ${endPoint.x} ${endPoint.y}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke-width', `${2.5 / state.transform.scale}px`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.classList.add('relation-line');
    // Color de la flecha según el bloque de origen
    const markerId = markerMap.get(color) || markerMap.get('default');
    path.setAttribute('stroke', color);
    path.setAttribute('marker-end', `url(#${markerId})`);
    path.setAttribute('data-marker-id', markerId); // <-- Guardar markerId real
    path.setAttribute('pointer-events', 'stroke');
    path.style.cursor = 'grab';
    // Capa invisible para área de clic amplia
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('d', d);
    hitArea.setAttribute('stroke-width', `${16 / state.transform.scale}`); // área amplia
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('fill', 'none');
    hitArea.setAttribute('pointer-events', 'stroke');
    hitArea.style.cursor = 'grab';
    hitArea.addEventListener('mousedown', (e) => startHandleDrag(e, relationKey, controlPoint));
    path.addEventListener('mousedown', (e) => startHandleDrag(e, relationKey, controlPoint));

    // Calcular el punto medio de la curva para la etiqueta
    function getQuadraticPoint(t, p0, p1, p2) {
        // Fórmula de curva cuadrática de Bézier
        return {
            x: (1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x,
            y: (1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y
        };
    }
    const labelPos = getQuadraticPoint(0.5, startPoint, controlPoint, endPoint);
    // Etiqueta SVG
    const labelFontSize = 16 / state.transform.scale; // más pequeño
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelPos.x);
    text.setAttribute('y', labelPos.y - 4 / state.transform.scale);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', `${labelFontSize}`);
    text.setAttribute('font-family', 'Inter, sans-serif');
    text.setAttribute('fill', color); // color igual a la línea
    text.setAttribute('stroke', '#fff');
    text.setAttribute('stroke-width', `${2 / state.transform.scale}`);
    text.setAttribute('paint-order', 'stroke');
    text.setAttribute('style', 'pointer-events: none; user-select: none;');
    text.setAttribute('class', 'relation-label');
    text.textContent = name;
    // Texto encima para mejor contraste
    const textTop = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textTop.setAttribute('x', labelPos.x);
    textTop.setAttribute('y', labelPos.y - 4 / state.transform.scale);
    textTop.setAttribute('text-anchor', 'middle');
    textTop.setAttribute('font-size', `${labelFontSize}`);
    textTop.setAttribute('font-family', 'Inter, sans-serif');
    textTop.setAttribute('fill', color); // color igual a la línea
    textTop.setAttribute('style', 'pointer-events: none; user-select: none;');
    textTop.setAttribute('class', 'relation-label');
    textTop.textContent = name;

    // --- Pinear etiqueta con doble clic ---
    // Estado global de etiquetas pineadas
    if (!window.pinnedRelationLabels) window.pinnedRelationLabels = new Set();
    const pinKey = `${sourceId}--${targetId}--${name}`;
    function updateLabelVisibility() {
        const pinned = window.pinnedRelationLabels.has(pinKey);
        text.style.display = pinned ? 'block' : '';
        textTop.style.display = pinned ? 'block' : '';
        if (pinned) {
            text.classList.add('pinned-label');
            textTop.classList.add('pinned-label');
        } else {
            text.classList.remove('pinned-label');
            textTop.classList.remove('pinned-label');
        }
    }
    updateLabelVisibility();
    // Doble clic para pinear/despinear
    [path, hitArea].forEach(el => {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (window.pinnedRelationLabels.has(pinKey)) {
                window.pinnedRelationLabels.delete(pinKey);
            } else {
                window.pinnedRelationLabels.add(pinKey);
            }
            updateLabelVisibility();
        });
    });

    const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    lineGroup.classList.add('relation-line-group');
    lineGroup.dataset.source = sourceId;
    lineGroup.dataset.target = targetId;
    lineGroup.dataset.name = name;
    lineGroup.appendChild(hitArea);
    lineGroup.appendChild(path);
    lineGroup.appendChild(text);
    lineGroup.appendChild(textTop);
    return lineGroup;
}

function highlightConnections(nodeId, shouldHighlight) {
    document.querySelectorAll('.relation-line-group').forEach(group => {
        if (group.dataset.source === nodeId || group.dataset.target === nodeId) {
            const line = group.querySelector('.relation-line');
            const handle = group.querySelector('.handle');
            line.classList.toggle('highlight', shouldHighlight);
            // Restaurar el marker-end usando el markerId real guardado
            const markerId = line.getAttribute('data-marker-id');
            if (markerId) {
                line.setAttribute('marker-end', `url(#${markerId})`);
            }
            if (handle) {
                handle.style.opacity = shouldHighlight ? '1' : '0';
            }
        }
    });
}
function renderControls() {
    const scrollPos = dbTogglesContainer.scrollTop;
    dbTogglesContainer.innerHTML = '';
    dbData.forEach(db => {
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'db-toggle flex items-center justify-between p-2 rounded-md bg-gray-100 dark:bg-gray-700/50';
        toggleWrapper.innerHTML = `<label for="toggle-${db.id}" class="flex items-center gap-2 text-sm cursor-pointer text-gray-800 dark:text-gray-200"><span>${db.icon}</span> <span>${db.name}</span></label><input type="checkbox" id="toggle-${db.id}" class="h-4 w-4 rounded border text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500">`;
        const input = toggleWrapper.querySelector('input');
        input.checked = state.dbVisibility[db.id];
        input.addEventListener('change', (e) => {
            state.dbVisibility[db.id] = e.target.checked;
            updateNodeVisibility();
            drawRelations();
        });
        dbTogglesContainer.appendChild(toggleWrapper);
    });
    dbTogglesContainer.scrollTop = scrollPos;
}
function startNodeDrag(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.button !== 0) return;
    state.draggedNode = e.currentTarget;
    state.draggedNode.style.zIndex = 10;
    document.addEventListener('mousemove', nodeDrag);
    document.addEventListener('mouseup', endNodeDrag);
}
function nodeDrag(e) { if (!state.draggedNode) return; const node = state.draggedNode; node.style.left = `${node.offsetLeft + e.movementX / state.transform.scale}px`; node.style.top = `${node.offsetTop + e.movementY / state.transform.scale}px`; drawRelations(); }
function endNodeDrag() {
    if (state.draggedNode) state.draggedNode.style.zIndex = '';
    state.draggedNode = null;
    document.removeEventListener('mousemove', nodeDrag);
    document.removeEventListener('mouseup', endNodeDrag);
    drawRelations(); // Redibuja relaciones al soltar
}

// Cambiar el cursor al mover la línea
function startHandleDrag(e, key, initialControlPoint) {
    // Solo permitir arrastrar con botón izquierdo (e.button === 0)
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    state.draggedHandle = key;
    document.body.style.cursor = 'grabbing';
    if (!state.customControlPoints.has(key)) {
        state.customControlPoints.set(key, initialControlPoint);
    }
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endHandleDrag);
}

function handleDrag(e) {
    if(!state.draggedHandle) return;
    const key = state.draggedHandle;
    const currentPoint = state.customControlPoints.get(key);
    
    if(currentPoint) {
        const newX = currentPoint.x + e.movementX / state.transform.scale;
        const newY = currentPoint.y + e.movementY / state.transform.scale;
        state.customControlPoints.set(key, {x: newX, y: newY});
        drawRelations();
    }
}

function endHandleDrag() {
    state.draggedHandle = null;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', endHandleDrag);
}

function handleZoom(e) { e.preventDefault(); const scaleAmount = -e.deltaY * 0.001; const newScale = Math.max(0.2, Math.min(2.5, state.transform.scale + scaleAmount)); const rect = canvasContainer.getBoundingClientRect(); const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top; const worldX = (mouseX - state.transform.translateX) / state.transform.scale, worldY = (mouseY - state.transform.translateY) / state.transform.scale; state.transform.translateX = mouseX - worldX * newScale; state.transform.translateY = mouseY - worldY * newScale; state.transform.scale = newScale; applyTransform(); drawRelations(); }
function startPan(e) {
    // Solo permitir pan con botón central (mouse 1) o tecla especial, no con clic izquierdo
    if (e.button !== 1) return; // 0: izquierdo, 1: central, 2: derecho
    if (e.target.closest('.db-node') || e.target.closest('.relation-line-group')) return;
    e.preventDefault();
    state.isPanning = true;
    canvasContainer.classList.add('panning');
}
function pan(e) { if (!state.isPanning) return; state.transform.translateX += e.movementX; state.transform.translateY += e.movementY; applyTransform(); }
function endPan() { state.isPanning = false; canvasContainer.classList.remove('panning'); }

function distributeDbNodes() {
    // Distribución automática en cuadrícula
    const n = dbData.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const nodeWidth = 320, nodeHeight = 120, marginX = 80, marginY = 80;
    const totalWidth = cols * nodeWidth + (cols - 1) * marginX;
    const totalHeight = rows * nodeHeight + (rows - 1) * marginY;
    const startX = CANVAS_SIZE / 2 - totalWidth / 2;
    const startY = CANVAS_SIZE / 2 - totalHeight / 2;
    for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        dbData[i].position.x = startX + col * (nodeWidth + marginX);
        dbData[i].position.y = startY + row * (nodeHeight + marginY);
    }
}
function distributeDbNodesBySize() {
    // Obtener nodos ya renderizados
    const nodes = dbData.map(db => document.getElementById(db.id));
    if (nodes.some(n => !n)) return; // Si falta alguno, no distribuir
    // Ordenar en filas, dejando margen según tamaño real
    const marginX = 80, marginY = 80;
    let x = CANVAS_SIZE / 2, y = CANVAS_SIZE / 2;
    let maxRowHeight = 0;
    let row = [];
    const maxWidth = CANVAS_SIZE - 200;
    x = 100;
    y = 100;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const rect = node.getBoundingClientRect();
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        if (x + width > maxWidth) {
            // Nueva fila
            x = 100;
            y += maxRowHeight + marginY;
            maxRowHeight = 0;
        }
        dbData[i].position.x = x;
        dbData[i].position.y = y;
        x += width + marginX;
        if (height > maxRowHeight) maxRowHeight = height;
    }
}

function getDbHierarchyLevels() {
    // Calcula niveles jerárquicos para cada bloque según relaciones
    const levels = {};
    const incoming = {};
    dbData.forEach(db => { incoming[db.id] = 0; });
    dbData.forEach(db => {
        db.properties.forEach(prop => {
            if (prop.type === 'Relation' && prop.relationTo) {
                incoming[prop.relationTo] = (incoming[prop.relationTo] || 0) + 1;
            }
        });
    });
    // Nodos raíz: sin relaciones entrantes
    let currentLevel = dbData.filter(db => incoming[db.id] === 0).map(db => db.id);
    let visited = new Set();
    let level = 0;
    while (currentLevel.length > 0) {
        currentLevel.forEach(id => { levels[id] = level; visited.add(id); });
        let nextLevel = [];
        currentLevel.forEach(id => {
            const db = dbData.find(d => d.id === id);
            db.properties.forEach(prop => {
                if (prop.type === 'Relation' && prop.relationTo && !visited.has(prop.relationTo)) {
                    nextLevel.push(prop.relationTo);
                }
            });
        });
        currentLevel = [...new Set(nextLevel)];
        level++;
    }
    // Los que no entraron, ponerlos al final
    dbData.forEach(db => { if (!(db.id in levels)) levels[db.id] = level; });
    return levels;
}
function distributeDbNodesHierarchically() {
    const levels = getDbHierarchyLevels();
    const marginX = 120, marginY = 80;
    const nodeWidth = 320;
    // Agrupar por nivel
    const byLevel = {};
    dbData.forEach(db => {
        const lvl = levels[db.id];
        if (!byLevel[lvl]) byLevel[lvl] = [];
        byLevel[lvl].push(db);
    });
    // Distribuir por columnas (niveles)
    let maxRows = 0;
    Object.values(byLevel).forEach(arr => { if (arr.length > maxRows) maxRows = arr.length; });
    const totalWidth = Object.keys(byLevel).length * (nodeWidth + marginX);
    const startX = CANVAS_SIZE / 2 - totalWidth / 2;
    let col = 0;
    for (const lvl of Object.keys(byLevel).sort((a,b)=>a-b)) {
        const nodes = byLevel[lvl];
        const colX = startX + col * (nodeWidth + marginX);
        const totalHeight = nodes.length * 120 + (nodes.length - 1) * marginY;
        const startY = CANVAS_SIZE / 2 - totalHeight / 2;
        nodes.forEach((db, i) => {
            db.position.x = colX;
            db.position.y = startY + i * (120 + marginY);
        });
        col++;
    }
}

function forceLayoutDbNodes(iterations = 100) {
    // Inicializar posiciones si no existen
    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;
    dbData.forEach((db, i) => {
        if (!db.position) db.position = {x: centerX + Math.random()*200-100, y: centerY + Math.random()*200-100};
    });
    // Obtener relaciones
    const edges = [];
    dbData.forEach(db => {
        db.properties.forEach(prop => {
            if (prop.type === 'Relation' && prop.relationTo) {
                edges.push({source: db.id, target: prop.relationTo});
            }
        });
    });
    // Simulación de fuerzas
    const k = 200; // distancia ideal
    const repulsion = 120000; // fuerza de repulsión
    for (let step = 0; step < iterations; step++) {
        // Repulsión entre todos los nodos
        for (let i = 0; i < dbData.length; i++) {
            for (let j = i + 1; j < dbData.length; j++) {
                const a = dbData[i], b = dbData[j];
                let dx = a.position.x - b.position.x;
                let dy = a.position.y - b.position.y;
                let dist = Math.sqrt(dx*dx + dy*dy) || 1;
                let force = repulsion / (dist * dist);
                let fx = force * dx / dist;
                let fy = force * dy / dist;
                a.position.x += fx;
                a.position.y += fy;
                b.position.x -= fx;
                b.position.y -= fy;
            }
        }
        // Atracción por relaciones
        edges.forEach(edge => {
            const a = dbData.find(d => d.id === edge.source);
            const b = dbData.find(d => d.id === edge.target);
            let dx = a.position.x - b.position.x;
            let dy = a.position.y - b.position.y;
            let dist = Math.sqrt(dx*dx + dy*dy) || 1;
            let force = (dist - k) * 0.05;
            let fx = force * dx / dist;
            let fy = force * dy / dist;
            a.position.x -= fx;
            a.position.y -= fy;
            b.position.x += fx;
            b.position.y += fy;
        });
        // Limitar posiciones al canvas
        dbData.forEach(db => {
            db.position.x = Math.max(100, Math.min(CANVAS_SIZE-400, db.position.x));
            db.position.y = Math.max(100, Math.min(CANVAS_SIZE-200, db.position.y));
        });
    }
}

// --- DAGRE LAYOUT ---
function dagreLayoutDbNodes() {
    const g = new dagre.graphlib.Graph();
    // Cambiado a horizontal (LR): primero en horizontal, luego en vertical
    g.setGraph({ rankdir: "LR", align: "UL", nodesep: 140, ranksep: 180, ranker: "network-simplex" });
    g.setDefaultEdgeLabel(() => ({}));
    // Usa tamaño estimado primero
    dbData.forEach(db => {
        g.setNode(db.id, { width: 320, height: 64 + db.properties.length * 44 });
    });
    dbData.forEach(db => {
        db.properties.forEach(prop => {
            if (prop.type === 'Relation' && prop.relationTo) {
                g.setEdge(db.id, prop.relationTo);
            }
        });
    });
    dagre.layout(g);
    // Centrado respecto al layout real
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dbData.forEach(db => {
        const node = g.node(db.id);
        if (node.x < minX) minX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.x > maxX) maxX = node.x;
        if (node.y > maxY) maxY = node.y;
    });
    const layoutWidth = maxX - minX;
    const layoutHeight = maxY - minY;
    const offsetX = CANVAS_SIZE / 2 - minX - layoutWidth / 2;
    const offsetY = CANVAS_SIZE / 2 - minY - layoutHeight / 2;
    dbData.forEach(db => {
        const node = g.node(db.id);
        db.position.x = node.x + offsetX;
        db.position.y = node.y + offsetY;
    });
}

function init() {
    // Set theme class first! This is crucial.
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    dbData.forEach(db => { state.dbVisibility[db.id] = true; });
    dagreLayoutDbNodes(); // Layout automático con dagre
    renderAllNodes();
    renderControls();
    setTimeout(() => {
        // distributeDbNodesBySize(); // Si quieres ajustar por tamaño real, descomenta
        renderAllNodes();
        document.getElementById('fit-view-btn').click();
    }, 0);
    applyTransform();

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        setTheme(newTheme);
    });
    
    hideSidebarBtn.addEventListener('click', () => {
        appDiv.classList.add('sidebar-collapsed');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    });

    showSidebarBtn.addEventListener('click', () => {
        appDiv.classList.remove('sidebar-collapsed');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    });
    
    // Set initial toggle state without calling setTheme again
    const isDark = initialTheme === 'dark';
    const indicator = document.getElementById('theme-toggle-indicator');
    indicator.classList.toggle('translate-x-6', isDark);
    indicator.classList.toggle('translate-x-1', !isDark);

    // Eliminar retardo, hacer instantáneo
    canvas.style.opacity = 1;
    drawRelations();
    
    canvasContainer.addEventListener('wheel', handleZoom);
    canvasContainer.addEventListener('mousedown', startPan);
    document.addEventListener('mousemove', pan);
    document.addEventListener('mouseup', endPan);
    window.addEventListener('resize', drawRelations);

    // Permitir deseleccionar todo al hacer clic en el fondo
    canvasContainer.addEventListener('mousedown', function(e) {
        // Solo si el clic no es sobre un nodo ni sobre una relación
        if (e.target === canvasContainer || e.target === canvasTransformer || e.target === canvas) {
            state.selectedNodes.clear();
            document.querySelectorAll('.db-node.selected').forEach(n => n.classList.remove('selected'));
        }
    });
    // Asigna funcionalidad al botón ya presente en el HTML
    const notionBtn = document.getElementById('notion-connect-btn');
    if (notionBtn) notionBtn.onclick = showNotionTokenInput;
}

// --- Controles de zoom, cuadrar vista y descarga ---
document.getElementById('zoom-in-btn').onclick = function() {
    // Zoom respecto al centro del área visible
    const prevScale = state.transform.scale;
    const newScale = Math.min(2.5, prevScale * 1.15);
    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - state.transform.translateX) / prevScale;
    const worldY = (centerY - state.transform.translateY) / prevScale;
    state.transform.scale = newScale;
    state.transform.translateX = centerX - worldX * newScale;
    state.transform.translateY = centerY - worldY * newScale;
    applyTransform();
    drawRelations();
};
document.getElementById('zoom-out-btn').onclick = function() {
    // Zoom respecto al centro del área visible
    const prevScale = state.transform.scale;
    const newScale = Math.max(0.2, prevScale / 1.15);
    const rect = canvasContainer.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - state.transform.translateX) / prevScale;
    const worldY = (centerY - state.transform.translateY) / prevScale;
    state.transform.scale = newScale;
    state.transform.translateX = centerX - worldX * newScale;
    state.transform.translateY = centerY - worldY * newScale;
    applyTransform();
    drawRelations();
};
document.getElementById('fit-view-btn').onclick = function() {
    // Centrar y ajustar el canvas para mostrar todos los nodos visibles
    const visibleNodes = dbData.filter(db => state.dbVisibility[db.id]);
    if (visibleNodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleNodes.forEach(db => {
        minX = Math.min(minX, db.position.x);
        minY = Math.min(minY, db.position.y);
        maxX = Math.max(maxX, db.position.x + 256); // ancho del nodo
        maxY = Math.max(maxY, db.position.y + 64 + db.properties.length * 44); // alto estimado
    });
    const margin = 100;
    const viewWidth = maxX - minX + margin * 2;
    const viewHeight = maxY - minY + margin * 2;
    const scaleX = canvasContainer.clientWidth / viewWidth;
    const scaleY = canvasContainer.clientHeight / viewHeight;
    state.transform.scale = Math.max(0.2, Math.min(2.5, Math.min(scaleX, scaleY)));
    state.transform.translateX = canvasContainer.clientWidth / 2 - ((minX + maxX) / 2) * state.transform.scale;
    state.transform.translateY = canvasContainer.clientHeight / 2 - ((minY + maxY) / 2) * state.transform.scale;
    applyTransform();
    drawRelations();
};
document.getElementById('download-btn').onclick = function() {
    // Descargar solo el área de los nodos visibles (usando boundingClientRect real)
    const controls = document.getElementById('canvas-controls');
    controls.style.display = 'none';
    // Desactivar transiciones/animaciones para evitar artefactos
    const style = document.createElement('style');
    style.id = 'export-temp-style';
    style.innerHTML = `* { transition: none !important; animation: none !important; }`;
    document.head.appendChild(style);
    const visibleNodes = dbData.filter(db => state.dbVisibility[db.id]);
    if (visibleNodes.length === 0) {
        controls.style.display = '';
        if (style.parentNode) style.parentNode.removeChild(style);
        return;
    }
    // Obtener el bounding box real de los nodos en pantalla
    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    visibleNodes.forEach(db => {
        const el = document.getElementById(db.id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        minLeft = Math.min(minLeft, rect.left);
        minTop = Math.min(minTop, rect.top);
        maxRight = Math.max(maxRight, rect.right);
        maxBottom = Math.max(maxBottom, rect.bottom);
    });
    // Margen visual
    const margin = 40;
    minLeft -= margin;
    minTop -= margin;
    maxRight += margin;
    maxBottom += margin;
    const cropWidth = maxRight - minLeft;
    const cropHeight = maxBottom - minTop;
    // Obtener el offset del canvas respecto a la ventana
    const containerRect = document.getElementById('canvas-transformer').getBoundingClientRect();
    // Determinar fondo según tema
    const isDark = document.documentElement.classList.contains('dark');
    setTimeout(() => {
        html2canvas(document.getElementById('canvas-transformer'), {
            backgroundColor: isDark ? null : '#fff',
            useCORS: true,
            scale: 3
        }).then(canvas => {
            controls.style.display = '';
            if (style.parentNode) style.parentNode.removeChild(style);
            // Recortar el canvas usando coordenadas DOM
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropWidth * 3;
            croppedCanvas.height = cropHeight * 3;
            const ctx = croppedCanvas.getContext('2d');
            // Ajustar el recorte según la posición relativa al canvas
            const sx = (minLeft - containerRect.left) * 3;
            const sy = (minTop - containerRect.top) * 3;
            ctx.drawImage(canvas, sx, sy, cropWidth * 3, cropHeight * 3, 0, 0, cropWidth * 3, cropHeight * 3);
            const link = document.createElement('a');
            link.download = 'notion-graphic.png';
            link.href = croppedCanvas.toDataURL('image/png');
            link.click();
        }).catch(() => {
            controls.style.display = '';
            if (style.parentNode) style.parentNode.removeChild(style);
        });
    }, 80); // Ligeramente mayor retardo para asegurar render
};
document.getElementById('auto-layout-btn').onclick = function() {
    dagreLayoutDbNodes();
    renderAllNodes();
    document.getElementById('fit-view-btn').click();
};

// --- Evitar layouts automáticos tras drag grupal ---
const originalDagreLayoutDbNodes = dagreLayoutDbNodes;
dagreLayoutDbNodes = function() {
    if (groupDragInProgress) return; // No auto-layout si se está arrastrando grupo
    originalDagreLayoutDbNodes();
}

init();

function hideCustomContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if (menu) menu.style.display = 'none';
    if (window._contextMenuHandler) {
        document.removeEventListener('mousedown', window._contextMenuHandler, true);
        window._contextMenuHandler = null;
    }
}

function showCustomContextMenu(x, y, isDark, isGlobal = false) {
    let menu = document.getElementById('custom-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'custom-context-menu';
        document.body.appendChild(menu);
    }
    menu.className = isDark ? 'dark' : '';
    menu.innerHTML = '';
    if (isGlobal) {
        // Menú global: Ocultar todo / Mostrar todo / Minimizar todo / Maximizar todo
        const hideAllBtn = document.createElement('button');
        hideAllBtn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 20 20'><rect x='3' y='6' width='14' height='8' rx='2' fill='currentColor' opacity='0.15'/><rect x='3' y='6' width='14' height='8' rx='2' stroke='currentColor' stroke-width='2'/><path d='M7 10h6' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg> Ocultar todo`;
        hideAllBtn.onclick = function() {
            dbData.forEach(db => { state.dbVisibility[db.id] = false; });
            renderControls();
            renderAllNodes();
            hideCustomContextMenu();
        };
        menu.appendChild(hideAllBtn);
        const showAllBtn = document.createElement('button');
        showAllBtn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 20 20'><rect x='3' y='6' width='14' height='8' rx='2' fill='currentColor' opacity='0.15'/><rect x='3' y='6' width='14' height='8' rx='2' stroke='currentColor' stroke-width='2'/><path d='M7 10h6' stroke='currentColor' stroke-width='2' stroke-linecap='round'/><path d='M10 7v6' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg> Mostrar todo`;
        showAllBtn.onclick = function() {
            dbData.forEach(db => { state.dbVisibility[db.id] = true; });
            renderControls();
            renderAllNodes();
            hideCustomContextMenu();
        };
        menu.appendChild(showAllBtn);
        // Minimizar todo
        const minimizeAllBtn = document.createElement('button');
        minimizeAllBtn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 20 20'><rect x='3' y='6' width='14' height='8' rx='2' fill='currentColor' opacity='0.15'/><rect x='3' y='6' width='14' height='8' rx='2' stroke='currentColor' stroke-width='2'/><path d='M7 13h6' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg> Minimizar todo`;
        minimizeAllBtn.onclick = function() {
            dbData.forEach(db => {
                const node = document.getElementById(db.id);
                if (node) {
                    const props = node.querySelector('.properties-container');
                    if (props && !props.classList.contains('hidden')) props.classList.add('hidden');
                }
            });
            drawRelations();
            hideCustomContextMenu();
        };
        menu.appendChild(minimizeAllBtn);
        // Maximizar todo
        const maximizeAllBtn = document.createElement('button');
        maximizeAllBtn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 20 20'><rect x='3' y='6' width='14' height='8' rx='2' fill='currentColor' opacity='0.15'/><rect x='3' y='6' width='14' height='8' rx='2' stroke='currentColor' stroke-width='2'/><path d='M7 7h6' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg> Maximizar todo`;
        maximizeAllBtn.onclick = function() {
            dbData.forEach(db => {
                const node = document.getElementById(db.id);
                if (node) {
                    const props = node.querySelector('.properties-container');
                    if (props && props.classList.contains('hidden')) props.classList.remove('hidden');
                }
            });
            drawRelations();
            hideCustomContextMenu();
        };
        menu.appendChild(maximizeAllBtn);
    } else {
        // Menú contextual para nodos seleccionados
        // Ocultar seleccionados
        const hideSelectedBtn = document.createElement('button');
        hideSelectedBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.98 8.223C5.21 6.362 7.48 4.5 10 4.5c2.52 0 4.79 1.862 6.02 3.723a3.5 3.5 0 010 3.554C14.79 13.638 12.52 15.5 10 15.5c-2.52 0-4.79-1.862-6.02-3.723a3.5 3.5 0 010-3.554z" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 4l12 12" stroke-linecap="round"/></svg> Ocultar seleccionados`;
        hideSelectedBtn.onclick = function() {
            state.selectedNodes.forEach(id => { state.dbVisibility[id] = false; });
            renderControls();
            renderAllNodes();
            hideCustomContextMenu();
        };
        menu.appendChild(hideSelectedBtn);
        // Contraer seleccionados
        const collapseSelectedBtn = document.createElement('button');
        collapseSelectedBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 12l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg> Contraer seleccionados`;
        collapseSelectedBtn.onclick = function() {
            state.selectedNodes.forEach(id => {
                const node = document.getElementById(id);
                if (node) {
                    const props = node.querySelector('.properties-container');
                    if (props && !props.classList.contains('hidden')) props.classList.add('hidden');
                }
            });
            drawRelations();
            hideCustomContextMenu();
        };
        menu.appendChild(collapseSelectedBtn);
        // Expandir seleccionados
        const expandSelectedBtn = document.createElement('button');
        expandSelectedBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg> Expandir seleccionados`;
        expandSelectedBtn.onclick = function() {
            state.selectedNodes.forEach(id => {
                const node = document.getElementById(id);
                if (node) {
                    const props = node.querySelector('.properties-container');
                    if (props && props.classList.contains('hidden')) props.classList.remove('hidden');
                }
            });
            drawRelations();
            hideCustomContextMenu();
        };
        menu.appendChild(expandSelectedBtn);

        // Botón Editar bloque
        const editBlockBtn = document.createElement('button');
        editBlockBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 13v3h3l9-9a1.5 1.5 0 0 0-3-3l-9 9z"/></svg> Editar bloque`;
        editBlockBtn.onclick = function() {
            if (state.selectedNodes.size === 1) {
                state.editingBlockId = Array.from(state.selectedNodes)[0];
                renderAllNodes();
                hideCustomContextMenu();
            }
        };
        menu.appendChild(editBlockBtn);
    }
    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    // Cerrar al hacer clic fuera
    window._contextMenuHandler = function(ev) {
        if (!menu.contains(ev.target)) hideCustomContextMenu();
    };
    setTimeout(() => document.addEventListener('mousedown', window._contextMenuHandler, true), 0);
}

// Detectar clic derecho en el área de trabajo sin selección
canvasContainer.addEventListener('contextmenu', function(e) {
    // Solo si no hay nodos seleccionados
    if (!state.selectedNodes || state.selectedNodes.size === 0) {
        e.preventDefault();
        const isDark = document.documentElement.classList.contains('dark');
        showCustomContextMenu(e.clientX, e.clientY, isDark, true);
    }
});

// Elimina la función addNotionConnectButton, ya no es necesaria

// Añadido para evitar error si no existe
function updateSelectionUI() {}

function connectToNotionAndFetchDatabases(token) {
    // Mostrar feedback de carga
    let feedbackDiv = document.getElementById('notion-feedback-div');
    if (!feedbackDiv) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'notion-feedback-div';
        feedbackDiv.className = 'mb-3 flex flex-col gap-2';
        const sidebarFooter = document.getElementById('sidebar-footer');
        sidebarFooter.insertBefore(feedbackDiv, sidebarFooter.firstChild.nextSibling);
    }
    feedbackDiv.innerHTML = `<span class='text-xs text-gray-700 dark:text-gray-300'>Conectando con Notion...</span>`;

    fetch('http://127.0.0.1:5001/notion/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
    .then(async res => {
        if (!res.ok) {
            let msg = 'Error desconocido';
            try { const data = await res.json(); msg = data.error || msg; } catch {}
            throw new Error(msg);
        }
        return res.json();
    })
    .then(data => {
        const dbs = (data.results || []).filter(obj => obj.object === 'database');
        feedbackDiv.innerHTML = `<span class='text-xs text-green-700 dark:text-green-300'>¡Conexión exitosa! Se encontraron <b>${dbs.length}</b> bases de datos.</span>`;
        console.log('Bases de datos de Notion:', dbs);
        // --- Transformar y visualizar ---
        if (dbs.length > 0) {
            // Mapear Notion DBs a formato interno, incluyendo relaciones reales
            // 1. Crear un mapa id->db para lookup
            const notionDbMap = {};
            dbs.forEach(db => { notionDbMap[db.id] = db; });
            // 2. Transformar cada DB
            const newDbData = dbs.map((db, idx) => {
                // Icono: emoji, archivo o null
                let icon = '📦';
                if (db.icon) {
                    if (db.icon.type === 'emoji') icon = db.icon.emoji;
                    else if (db.icon.type === 'external' && db.icon.external && db.icon.external.url) icon = '🌐';
                    else if (db.icon.type === 'file' && db.icon.file && db.icon.file.url) icon = '🖼️';
                }
                // Color único y sin repeticiones
                let color = getUniqueColor(idx, dbs.length);
                // Propiedades
                const properties = [];
                for (const [propName, prop] of Object.entries(db.properties)) {
                    const type = (prop.type || '').toLowerCase();
                    if (type === 'relation') {
                        const relDbId = prop.relation && prop.relation.database_id;
                        properties.push({ name: propName, type: 'Relation', relationTo: relDbId || 'unknown' });
                    } else if (type === 'title' || type === 'rich_text') {
                        properties.push({ name: propName, type: 'Text' });
                    } else if (type === 'number') {
                        properties.push({ name: propName, type: 'Number' });
                    } else if (type === 'date') {
                        properties.push({ name: propName, type: 'Date' });
                    } else if (type === 'select' || type === 'multi_select') {
                        properties.push({ name: propName, type: 'Select' });
                    } else if (type === 'people') {
                        properties.push({ name: propName, type: 'Person' });
                    } else if (type === 'checkbox') {
                        properties.push({ name: propName, type: 'Checkbox' });
                    } else if (type === 'button') {
                        properties.push({ name: propName, type: 'Button' });
                    } else {
                        // Otros tipos: mostrar como tipo genérico, capitalizando
                        properties.push({ name: propName, type: type.charAt(0).toUpperCase() + type.slice(1) });
                    }
                }
                // Agrupar y ordenar propiedades por tipo
                properties.sort((a, b) => {
                    if (a.type < b.type) return -1;
                    if (a.type > b.type) return 1;
                    return a.name.localeCompare(b.name);
                });
                return {
                    id: db.id,
                    name: db.title && db.title[0] && db.title[0].plain_text ? db.title[0].plain_text : (db.name || 'Sin nombre'),
                    icon,
                    color,
                    position: { x: 0, y: 0 },
                    properties
                };
            });
            // Reemplazar datos y renderizar
            dbData.length = 0;
            dbData.push(...newDbData);
            // Mostrar todos los nodos
            dbData.forEach(db => { state.dbVisibility[db.id] = true; });
            dagreLayoutDbNodes();
            renderAllNodes();
            renderControls();
            setTimeout(() => document.getElementById('fit-view-btn').click(), 100);
        }
    })
    .catch(err => {
        feedbackDiv.innerHTML = `<span class='text-xs text-red-700 dark:text-red-300'>Error al conectar con Notion: ${err.message}</span>`;
    });
}

function showNotionTokenInput() {
    let inputDiv = document.getElementById('notion-token-input-div');
    if (inputDiv) return;
    inputDiv = document.createElement('div');
    inputDiv.id = 'notion-token-input-div';
    inputDiv.className = 'mb-3 flex flex-col gap-2';
    inputDiv.innerHTML = `
        <label class='text-xs text-gray-700 dark:text-gray-300'>Pega tu token de integración de Notion:</label>
        <input id='notion-token-input' type='password' class='px-2 py-1 rounded border border-gray-300 dark:bg-gray-800 dark:text-white' placeholder='secret_xxx...' autocomplete='off'>
        <button id='notion-token-save-btn' class='bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700'>Guardar</button>
    `;
    const sidebarFooter = document.getElementById('sidebar-footer');
    sidebarFooter.insertBefore(inputDiv, sidebarFooter.firstChild.nextSibling);
       document.getElementById('notion-token-save-btn').onclick = function() {
        const input = document.getElementById('notion-token-input');
        if (!input.value) { alert('Debes ingresar un token de integración de Notion.'); return; }
        localStorage.setItem('notionToken', input.value);
        inputDiv.remove();
        connectToNotionAndFetchDatabases(input.value);
    };
}

// --- Paleta de colores vibrantes únicos ---
const vibrantColorPalette = [
    '#ef4444', // rojo
    '#f59e42', // naranja
    '#fbbf24', // amarillo
    '#fde047', // amarillo claro
    '#f472b6', // rosa
    '#e879f9', // fucsia
    '#a21caf', // violeta oscuro
    '#8b5cf6', // violeta
    '#6366f1', // azul indigo
    '#2563eb', // azul
    '#0ea5e9', // celeste
    '#06b6d4', // cian
    '#14b8a6', // turquesa
    '#22d3ee', // azul claro
    '#4ade80', // verde claro
    '#22c55e', // verde
    '#84cc16', // lima
    '#eab308', // dorado
    '#f43f5e', // rosa fuerte
    '#be185d', // magenta oscuro
    '#db2777', // rosa oscuro
    '#facc15', // amarillo vibrante
    '#fb7185', // coral
    '#f87171', // rojo claro
    '#a3e635', // verde lima
    '#38bdf8', // azul cielo
    '#818cf8', // azul lavanda
    '#fcd34d', // amarillo pastel
    '#fda4af', // rosa pastel
    '#c026d3', // violeta fuerte
    '#7c3aed', // violeta medio
    '#0d9488', // teal
];

function getUniqueColor(index, total) {
    if (index < vibrantColorPalette.length) {
        return vibrantColorPalette[index];
    }
    // Si hay más nodos que colores, generar colores HSL vibrantes y únicos
    // Espaciado uniforme en el círculo cromático
    const hue = Math.round((360 / total) * index);
    return `hsl(${hue}, 85%, 60%)`;
}