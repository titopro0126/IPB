let productos = [];

try {
    const guardado = localStorage.getItem('inventarioCUP');
    if (guardado) productos = JSON.parse(guardado);
} catch (e) {
    productos = [];
}

const calc = {
    final: p => {
        if (p.finalManual !== null && p.finalManual !== undefined && p.finalManual !== '') {
            return +p.finalManual || 0;
        }
        return (p.inicio || 0) + (p.entrada || 0) - (p.bajas || 0);
    },
    venta: p => {
        const disponible = (p.inicio || 0) + (p.entrada || 0);
        const final      = calc.final(p);
        const bajas      = p.bajas || 0;
        return Math.max(0, disponible - bajas - final);
    },
    efectivo: p => calc.venta(p) * (p.pv || 0),
    ganancia: p => calc.venta(p) * ((p.pv || 0) - (p.pc || 0)),
    importe:  p => calc.venta(p) * (p.pv || 0),
};

const money = n => new Intl.NumberFormat('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
}).format(n) + ' CUP';

function persistir() {
    try {
        localStorage.setItem('inventarioCUP', JSON.stringify(productos));
    } catch (e) {}
}

const ICONOS_TOAST = {
    exito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    aviso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function mostrarToast(titulo, mensaje, tipo = 'info', duracion = 3500) {
    const contenedor = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <div class="toast-icon">${ICONOS_TOAST[tipo] || ICONOS_TOAST.info}</div>
        <div class="toast-contenido">
            <div class="toast-titulo">${titulo}</div>
            ${mensaje ? `<div class="toast-msg">${mensaje}</div>` : ''}
        </div>
    `;
    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

function confirmar(titulo, mensaje, opciones = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('modalConfirm');
        const icono = document.getElementById('confirmIcono');
        const btnAceptar = document.getElementById('confirmAceptar');

        document.getElementById('confirmTitulo').textContent = titulo;
        document.getElementById('confirmMensaje').textContent = mensaje;
        btnAceptar.textContent = opciones.textoAceptar || 'Aceptar';
        document.getElementById('confirmCancelar').textContent = opciones.textoCancelar || 'Cancelar';

        if (opciones.peligro) {
            icono.classList.add('peligro');
            btnAceptar.classList.add('peligro');
        } else {
            icono.classList.remove('peligro');
            btnAceptar.classList.remove('peligro');
        }

        modal.classList.add('activo');
        setTimeout(() => btnAceptar.focus(), 100);

        window._confirmResolve = resolve;
    });
}

function cerrarConfirm(respuesta) {
    document.getElementById('modalConfirm').classList.remove('activo');
    if (window._confirmResolve) {
        window._confirmResolve(respuesta);
        window._confirmResolve = null;
    }
}

function toggleModoOscuro() {
    document.body.classList.toggle('dark');
    const oscuro = document.body.classList.contains('dark');
    try {
        localStorage.setItem('ipbTema', oscuro ? 'dark' : 'light');
    } catch (e) {}
}

function cargarTema() {
    try {
        const tema = localStorage.getItem('ipbTema');
        if (tema === 'dark') {
            document.body.classList.add('dark');
        }
    } catch (e) {}
}

function render() {
    const tbody = document.getElementById('tbody');
    const tfoot = document.getElementById('tfoot');
    const footerAcciones = document.getElementById('footerAcciones');

    tbody.innerHTML = '';

    if (productos.length === 0) {
        tbody.innerHTML = `
            <tr class="vacio">
                <td colspan="10">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <p><strong>No hay productos todavía</strong></p>
                        <p class="empty-sub">Pulsa "Nuevo producto" para empezar</p>
                    </div>
                </td>
            </tr>
        `;
        tfoot.style.display = 'none';
        footerAcciones.style.display = 'none';

        document.getElementById('mProductos').textContent = '0';
        document.getElementById('mEfectivo').textContent  = money(0);
        document.getElementById('mGanancia').textContent  = money(0);
        document.getElementById('mStock').textContent     = '0';
        return;
    }

    let tVenta = 0, tEfectivo = 0, tGanancia = 0, tImporte = 0, stockBajo = 0;

    productos.forEach(p => {
        const final    = calc.final(p);
        const venta    = calc.venta(p);
        const efectivo = calc.efectivo(p);
        const ganancia = calc.ganancia(p);
        const importe  = calc.importe(p);

        tVenta    += venta;
        tEfectivo += efectivo;
        tGanancia += ganancia;
        tImporte  += importe;
        if (final < 50) stockBajo++;

        let badge = '';
        if (final === 0) badge = '<span class="badge badge-cero">Agotado</span>';
        else if (final < 50) badge = '<span class="badge badge-bajo">Bajo</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="nombre" title="${escapeHtml(p.producto)}">${escapeHtml(p.producto)}${badge}</td>
            <td class="num">${p.inicio || ''}</td>
            <td class="num">${p.entrada || ''}</td>
            <td class="num">${p.bajas || ''}</td>
            <td class="num"><strong>${final}</strong></td>
            <td class="num">${venta}</td>
            <td class="num">${money(efectivo)}</td>
            <td class="num verde">${money(ganancia)}</td>
            <td class="num">${money(importe)}</td>
            <td class="num">
                <div class="acciones">
                    <button class="icon-btn" onclick="editar(${p.id})" title="Editar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="icon-btn del" onclick="borrar(${p.id})" title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('tVenta').textContent    = tVenta;
    document.getElementById('tEfectivo').textContent = money(tEfectivo);
    document.getElementById('tGanancia').textContent = money(tGanancia);
    document.getElementById('tImporte').textContent  = money(tImporte);
    tfoot.style.display = 'table-footer-group';

    document.getElementById('mProductos').textContent = productos.length;
    document.getElementById('mEfectivo').textContent  = money(tEfectivo);
    document.getElementById('mGanancia').textContent  = money(tGanancia);
    document.getElementById('mStock').textContent     = stockBajo;

    footerAcciones.style.display = 'block';
    persistir();
}

function abrirModal(id) {
    const modal = document.getElementById('modal');
    const titulo = document.getElementById('modalTitulo');

    if (id) {
        const p = productos.find(x => x.id === id);
        if (!p) return;
        document.getElementById('editId').value    = p.id;
        document.getElementById('fProducto').value = p.producto;
        document.getElementById('fInicio').value   = (p.inicio || p.inicio === 0) ? p.inicio : '';
        document.getElementById('fEntrada').value  = (p.entrada || p.entrada === 0) ? p.entrada : '';
        document.getElementById('fBajas').value    = (p.bajas || p.bajas === 0) ? p.bajas : '';
        document.getElementById('fFinal').value    = (p.finalManual !== null && p.finalManual !== undefined) ? p.finalManual : '';
        document.getElementById('fPV').value       = (p.pv || p.pv === 0) ? p.pv : '';
        document.getElementById('fPC').value       = (p.pc || p.pc === 0) ? p.pc : '';
        titulo.textContent = 'Editar producto';
    } else {
        document.getElementById('editId').value    = '';
        document.getElementById('fProducto').value = '';
        document.getElementById('fInicio').value   = '';
        document.getElementById('fEntrada').value  = '';
        document.getElementById('fBajas').value    = '';
        document.getElementById('fFinal').value    = '';
        document.getElementById('fPV').value       = '';
        document.getElementById('fPC').value       = '';
        titulo.textContent = 'Nuevo producto';
    }

    actualizarPreview();
    modal.classList.add('activo');
    setTimeout(() => document.getElementById('fProducto').focus(), 100);
}

function cerrarModal() {
    document.getElementById('modal').classList.remove('activo');
}

function guardarProducto() {
    const nombre = document.getElementById('fProducto').value.trim();
    if (!nombre) {
        mostrarToast('Campo obligatorio', 'El nombre del producto es obligatorio', 'aviso');
        document.getElementById('fProducto').focus();
        return;
    }

    const finalInput = document.getElementById('fFinal').value;
    const finalManual = finalInput === '' ? null : +finalInput;

    const data = {
        producto:    nombre,
        inicio:      +document.getElementById('fInicio').value  || 0,
        entrada:     +document.getElementById('fEntrada').value || 0,
        bajas:       +document.getElementById('fBajas').value   || 0,
        finalManual: finalManual,
        pv:          +document.getElementById('fPV').value      || 0,
        pc:          +document.getElementById('fPC').value      || 0,
    };

    const editId = document.getElementById('editId').value;

    if (editId) {
        const i = productos.findIndex(p => p.id === +editId);
        if (i !== -1) {
            productos[i] = { ...productos[i], ...data };
            mostrarToast('Producto actualizado', `"${nombre}" se ha actualizado correctamente`, 'exito');
        }
    } else {
        const nuevoId = productos.length ? Math.max(...productos.map(p => p.id)) + 1 : 1;
        productos.push({ id: nuevoId, ...data });
        mostrarToast('Producto añadido', `"${nombre}" se ha agregado al inventario`, 'exito');
    }

    render();
    cerrarModal();
}

function editar(id) { abrirModal(id); }

async function borrar(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;

    const ok = await confirmar(
        'Eliminar producto',
        `¿Seguro que quieres eliminar "${p.producto}"?`,
        { textoAceptar: 'Eliminar', peligro: true }
    );

    if (!ok) return;

    productos = productos.filter(x => x.id !== id);
    render();
    mostrarToast('Producto eliminado', `"${p.producto}" ha sido eliminado`, 'aviso');
}

async function resetear() {
    const ok = await confirmar(
        'Vaciar inventario',
        'Se borrarán TODOS los productos. Esta acción no se puede deshacer.',
        { textoAceptar: 'Sí, borrar todo', peligro: true }
    );

    if (!ok) return;

    productos = [];
    persistir();
    render();
    mostrarToast('Inventario vaciado', 'Todos los productos han sido eliminados', 'aviso');
}

function actualizarPreview() {
    const inicio  = +document.getElementById('fInicio').value  || 0;
    const entrada = +document.getElementById('fEntrada').value || 0;
    const bajas   = +document.getElementById('fBajas').value   || 0;
    const pv      = +document.getElementById('fPV').value      || 0;
    const pc      = +document.getElementById('fPC').value      || 0;

    const finalInput = document.getElementById('fFinal').value;
    const finalManual = finalInput === '' ? null : +finalInput;

    const final = (finalManual !== null) ? finalManual : (inicio + entrada - bajas);
    const venta    = Math.max(0, (inicio + entrada) - bajas - final);
    const ganancia = venta * (pv - pc);

    document.getElementById('pvFinal').textContent    = final;
    document.getElementById('pvVenta').textContent    = venta;
    document.getElementById('pvGanancia').textContent = money(ganancia);
}

function prepararDatosExport() {
    return productos.map(p => ({
        Producto: p.producto,
        Inicio:   Number(p.inicio) || 0,
        Entrada:  Number(p.entrada) || 0,
        Bajas:    Number(p.bajas) || 0,
        Final:    Number(calc.final(p)) || 0,
        Venta:    Number(calc.venta(p)) || 0,
        Efectivo: Number(calc.efectivo(p).toFixed(2)),
        Ganancia: Number(calc.ganancia(p).toFixed(2)),
        Importe:  Number(calc.importe(p).toFixed(2)),
    }));
}

function calcularTotales() {
    let tVenta = 0, tEfectivo = 0, tGanancia = 0, tImporte = 0;
    productos.forEach(p => {
        tVenta    += Number(calc.venta(p)) || 0;
        tEfectivo += Number(calc.efectivo(p)) || 0;
        tGanancia += Number(calc.ganancia(p)) || 0;
        tImporte  += Number(calc.importe(p)) || 0;
    });
    return { tVenta, tEfectivo, tGanancia, tImporte };
}

function exportarExcel() {
    if (productos.length === 0) {
        mostrarToast('Sin datos', 'No hay productos para exportar', 'aviso');
        return;
    }

    if (typeof XLSX === 'undefined') {
        mostrarToast('Error', 'No se pudo cargar la librería de Excel', 'error');
        return;
    }

    const datos = prepararDatosExport();
    const t = calcularTotales();

    datos.push({
        Producto: 'TOTAL',
        Inicio:   '',
        Entrada:  '',
        Bajas:    '',
        Final:    '',
        Venta:    t.tVenta,
        Efectivo: Number(t.tEfectivo.toFixed(2)),
        Ganancia: Number(t.tGanancia.toFixed(2)),
        Importe:  Number(t.tImporte.toFixed(2)),
    });

    const ws = XLSX.utils.json_to_sheet(datos);

    ws['!cols'] = [
        { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];

    const rango = XLSX.utils.decode_range(ws['!ref']);
    for (let fila = 1; fila <= rango.e.r; fila++) {
        [1, 2, 3, 4, 5].forEach(col => {
            const celda = XLSX.utils.encode_cell({ r: fila, c: col });
            if (ws[celda] && ws[celda].t === 'n') ws[celda].z = '0';
        });
        [6, 7, 8].forEach(col => {
            const celda = XLSX.utils.encode_cell({ r: fila, c: col });
            if (ws[celda] && ws[celda].t === 'n') ws[celda].z = '#,##0.00';
        });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `IPB_inventario_${fecha}.xlsx`);
    mostrarToast('Excel exportado', `Archivo IPB_inventario_${fecha}.xlsx descargado`, 'exito');
}

function exportarCSV() {
    if (productos.length === 0) {
        mostrarToast('Sin datos', 'No hay productos para exportar', 'aviso');
        return;
    }

    const datos = prepararDatosExport();
    const t = calcularTotales();

    const cabeceras = ['Producto', 'Inicio', 'Entrada', 'Bajas', 'Final', 'Venta', 'Efectivo', 'Ganancia', 'Importe'];
    const lineas = [cabeceras.join(';')];

    datos.forEach(d => {
        lineas.push([
            `"${d.Producto.replace(/"/g, '""')}"`,
            d.Inicio, d.Entrada, d.Bajas, d.Final, d.Venta,
            d.Efectivo.toFixed(2),
            d.Ganancia.toFixed(2),
            d.Importe.toFixed(2),
        ].join(';'));
    });

    lineas.push([
        '"TOTAL"', '', '', '', '', t.tVenta,
        t.tEfectivo.toFixed(2),
        t.tGanancia.toFixed(2),
        t.tImporte.toFixed(2),
    ].join(';'));

    const csv = '\uFEFF' + lineas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const fecha = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IPB_inventario_${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('CSV exportado', `Archivo IPB_inventario_${fecha}.csv descargado`, 'exito');
}

async function cargarExcel(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const hoja = wb.Sheets[wb.SheetNames[0]];
            const filas = XLSX.utils.sheet_to_json(hoja);

            if (filas.length === 0) {
                mostrarToast('Archivo vacío', 'El archivo no contiene datos', 'aviso');
                return;
            }

            const nuevos = [];
            let maxId = productos.length ? Math.max(...productos.map(p => p.id)) : 0;

            filas.forEach(f => {
                if (!f.Producto || String(f.Producto).toUpperCase() === 'TOTAL') return;

                maxId++;
                nuevos.push({
                    id: maxId,
                    producto:    String(f.Producto),
                    inicio:      Number(f.Inicio) || 0,
                    entrada:     Number(f.Entrada) || 0,
                    bajas:       Number(f.Bajas) || 0,
                    finalManual: (f.Final === '' || f.Final === undefined || f.Final === null) ? null : Number(f.Final),
                    pv:          Number(f.PV || f.Efectivo / (f.Venta || 1)) || 0,
                    pc:          Number(f.PC) || 0,
                });
            });

            if (nuevos.length === 0) {
                mostrarToast('Sin productos', 'No se encontraron productos válidos', 'aviso');
                return;
            }

            const añadir = await confirmar(
                'Productos encontrados',
                `Se encontraron ${nuevos.length} productos.\n\n¿Qué quieres hacer?`,
                {
                    textoAceptar: 'Añadir a la lista',
                    textoCancelar: 'Reemplazar todo'
                }
            );

            if (añadir) {
                productos = productos.concat(nuevos);
            } else {
                productos = nuevos;
            }

            render();
            mostrarToast('Excel cargado', `${nuevos.length} productos importados correctamente`, 'exito');
        } catch (err) {
            mostrarToast('Error', 'No se pudo leer el archivo. Verifica el formato', 'error');
        }
    };

    reader.readAsArrayBuffer(archivo);
    event.target.value = '';
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
    if (e.key === 'F12') {
        e.preventDefault();
        mostrarToast('Acceso restringido', 'Esta función está deshabilitada', 'error');
        return false;
    }
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        mostrarToast('Acceso restringido', 'Esta función está deshabilitada', 'error');
        return false;
    }
    if (e.ctrlKey && ['U', 'S', 'P'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        mostrarToast('Acceso restringido', 'Esta función está deshabilitada', 'error');
        return false;
    }
    if (e.key === 'PrintScreen') {
        e.preventDefault();
        mostrarToast('Captura bloqueada', 'No se permite capturar la pantalla', 'error');
        return false;
    }
});

document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('selectstart', e => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    cargarTema();

    document.getElementById('fecha').textContent = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    document.getElementById('year').textContent = new Date().getFullYear();
    document.getElementById('fechaFooter').textContent = new Date().toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    document.getElementById('modal').addEventListener('click', e => {
        if (e.target.id === 'modal') cerrarModal();
    });

    document.getElementById('modalConfirm').addEventListener('click', e => {
        if (e.target.id === 'modalConfirm') cerrarConfirm(false);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            cerrarModal();
            cerrarConfirm(false);
        }
    });

    ['fInicio', 'fEntrada', 'fBajas', 'fFinal', 'fPV', 'fPC'].forEach(id => {
        document.getElementById(id).addEventListener('input', actualizarPreview);
    });

    render();

    setTimeout(() => {
        mostrarToast('Bienvenido a IPB', 'Sistema de inventario', 'info', 4000);
    }, 500);
});