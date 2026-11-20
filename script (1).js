/* Arma el portfolio con los datos de datos.js.
   Incluye el modo edición (agregar, cambiar y sacar proyectos), los filtros
   y la vista previa de los repositorios de GitHub.
   No hace falta tocar este archivo para cargar tus proyectos. */
(function () {
  "use strict";

  var KEY = "portfolio-garcia-brunato-v1";
  var CACHE_REPO = "portfolio-repo-v1:";
  var CACHE_MS = 6 * 60 * 60 * 1000;
  var ANIO_MIN = 1990;
  var ANIO_MAX = 2100;

  var root = document.getElementById("app");
  var fuente = typeof PORTFOLIO !== "undefined" ? PORTFOLIO : null;

  if (!fuente) {
    root.textContent = "No se encontró datos.js. Revisá que esté en la misma carpeta que index.html.";
    return;
  }

  var BASE = "";
  try { BASE = JSON.stringify(fuente); } catch (e) { BASE = ""; }

  /* ---------- utilidades ---------- */

  function str(v) { return v === null || v === undefined ? "" : String(v); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function sinAcentos(s) { return str(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function igual(a, b) { return sinAcentos(a) === sinAcentos(b); }

  // Crea un elemento HTML. Los textos se insertan como texto, nunca como HTML.
  function h(tag, props, kids) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "value") el.value = v;
      else if (k === "hidden") el.hidden = !!v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, String(v));
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  // Convierte "usuario/repo", "usuario" o "sitio.com" en un link. Solo acepta http y https.
  function normalizarUrl(raw, esPerfil) {
    var v = str(raw).trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(v)) return "";
    if (/^(github\.com|www\.)/i.test(v)) return "https://" + v;
    if (esPerfil && /^@?[\w\-]+$/.test(v)) return "https://github.com/" + v.replace(/^@/, "");
    if (/^[\w\-]+\/[\w.\-]+$/.test(v)) return "https://github.com/" + v;
    if (/^[\w\-]+(\.[\w\-]+)+(\/\S*)?$/.test(v)) return "https://" + v;
    return "";
  }

  function textoCorto(url) {
    return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/^github\.com\//i, "").replace(/\/$/, "");
  }

  function listaTecnologias(t) {
    var items = Array.isArray(t) ? t : str(t).split(",");
    var vistos = [];
    var salida = [];
    items.forEach(function (x) {
      var s = str(x).trim();
      if (!s) return;
      var k = sinAcentos(s);
      if (vistos.indexOf(k) < 0) { vistos.push(k); salida.push(s); }
    });
    return salida;
  }

  function parrafos(texto) {
    return str(texto).split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ---------- vista previa del repositorio (API pública de GitHub) ---------- */

  var COLORES = {
    "Python": "#3572A5", "JavaScript": "#f1e05a", "TypeScript": "#3178c6", "HTML": "#e34c26",
    "CSS": "#563d7c", "Java": "#b07219", "C": "#555555", "C++": "#f34b7d", "C#": "#178600",
    "Go": "#00ADD8", "Rust": "#dea584", "PHP": "#4F5D95", "Ruby": "#701516", "Kotlin": "#A97BFF",
    "Swift": "#F05138", "Shell": "#89e051", "Lua": "#51a0cf", "Dart": "#00B4AB", "Batchfile": "#C1F12E"
  };
  var memoria = {};
  var fallos = {};
  var enCurso = {};

  function repoGitHub(url) {
    var m = /^https?:\/\/(?:www\.)?github\.com\/([\w.\-]+)\/([\w.\-]+?)(?:\.git)?(?:[\/?#].*)?$/i.exec(url || "");
    return m ? { dueno: m[1], repo: m[2] } : null;
  }
  function claveRepo(gh) { return (gh.dueno + "/" + gh.repo).toLowerCase(); }

  function leerCache(clave) {
    try {
      var raw = localStorage.getItem(CACHE_REPO + clave);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (c && c.d && Date.now() - c.t < CACHE_MS) return c.d;
    } catch (e) {}
    return null;
  }
  function guardarCache(clave, d) {
    try { localStorage.setItem(CACHE_REPO + clave, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  }
  function datosEnMemoria(gh) {
    var clave = claveRepo(gh);
    return memoria[clave] || leerCache(clave);
  }

  // Pide los datos del repositorio. Resuelve { ok: true, d: datos } o { ok: false, motivo: "..." }.
  function datosRepo(gh) {
    var clave = claveRepo(gh);
    var previo = datosEnMemoria(gh);
    if (previo) { memoria[clave] = previo; return Promise.resolve({ ok: true, d: previo }); }
    if (fallos[clave]) return Promise.resolve({ ok: false, motivo: fallos[clave] });
    if (enCurso[clave]) return enCurso[clave];
    if (typeof fetch !== "function") return Promise.resolve({ ok: false, motivo: "red" });

    var pedido = fetch("https://api.github.com/repos/" + encodeURIComponent(gh.dueno) + "/" + encodeURIComponent(gh.repo))
      .then(function (r) {
        if (r.status === 404) return { ok: false, motivo: "no-encontrado" };
        if (r.status === 403 || r.status === 429) return { ok: false, motivo: "limite" };
        if (!r.ok) return { ok: false, motivo: "red" };
        return r.json().then(function (j) {
          var d = {
            nombre: j.full_name || gh.dueno + "/" + gh.repo,
            desc: j.description || "",
            estrellas: j.stargazers_count || 0,
            forks: j.forks_count || 0,
            lenguaje: j.language || "",
            actualizado: j.pushed_at || "",
            archivado: !!j.archived
          };
          memoria[clave] = d;
          guardarCache(clave, d);
          return { ok: true, d: d };
        });
      })
      .catch(function () { return { ok: false, motivo: "red" }; })
      .then(function (res) {
        delete enCurso[clave];
        if (!res.ok) fallos[clave] = res.motivo;
        return res;
      });
    enCurso[clave] = pedido;
    return pedido;
  }

  function abreviar(n) { return n >= 1000 ? Math.round(n / 100) / 10 + "k" : String(n); }

  function haceCuanto(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return "hace un momento";
    var min = Math.floor(s / 60);
    if (min < 60) return "hace " + plural(min, "minuto", "minutos");
    var hs = Math.floor(min / 60);
    if (hs < 24) return "hace " + plural(hs, "hora", "horas");
    var dias = Math.floor(hs / 24);
    if (dias < 30) return "hace " + plural(dias, "día", "días");
    var meses = Math.floor(dias / 30);
    if (meses < 12) return "hace " + plural(meses, "mes", "meses");
    return "hace " + plural(Math.max(1, Math.floor(dias / 365)), "año", "años");
  }

  function mensajeError(motivo) {
    if (motivo === "no-encontrado") return "No se encontró el repositorio. Revisá el nombre. Si es privado, GitHub no permite mostrar la vista previa.";
    if (motivo === "limite") return "GitHub limitó las consultas por un rato. La vista previa se va a mostrar más tarde.";
    return "No se pudo cargar la vista previa. Revisá tu conexión.";
  }

  // Tarjeta con la vista previa de un repositorio. Si no es de GitHub, muestra un link simple.
  // Con detallado=true (formulario) explica por qué falla; en la página pública falla en silencio.
  function vistaPrevia(url, detallado) {
    var gh = repoGitHub(url);
    if (!gh) {
      return h("a", { class: "repo", href: url, target: "_blank", rel: "noopener noreferrer", text: textoCorto(url) + " ↗" });
    }
    var nombreEl = h("span", { class: "vp-nombre", text: gh.dueno + "/" + gh.repo });
    var descEl = h("span", { class: "vp-desc", text: "Cargando vista previa…" });
    var metaEl = h("span", { class: "vp-meta", hidden: true });
    var tarjeta = h("a", { class: "vp", href: url, target: "_blank", rel: "noopener noreferrer" }, [
      h("span", { class: "vp-top" }, [nombreEl, h("span", { class: "vp-flecha", "aria-hidden": "true", text: "↗" })]),
      descEl,
      metaEl
    ]);

    function pintar(d) {
      nombreEl.textContent = d.nombre;
      descEl.hidden = false;
      descEl.textContent = d.desc || "Este repositorio no tiene descripción en GitHub.";
      var items = [];
      if (d.lenguaje) {
        items.push(h("span", { class: "vp-item" }, [
          h("span", { class: "vp-punto", style: "background:" + (COLORES[d.lenguaje] || "var(--muted)"), "aria-hidden": "true" }),
          d.lenguaje
        ]));
      }
      items.push(h("span", { class: "vp-item", title: "Estrellas", text: "★ " + abreviar(d.estrellas) }));
      items.push(h("span", { class: "vp-item", title: "Forks", text: "⑂ " + abreviar(d.forks) }));
      var cuando = haceCuanto(d.actualizado);
      if (cuando) items.push(h("span", { class: "vp-item", text: "Actualizado " + cuando }));
      if (d.archivado) items.push(h("span", { class: "vp-item", text: "Archivado" }));
      metaEl.replaceChildren.apply(metaEl, items);
      metaEl.hidden = false;
    }

    var ya = datosEnMemoria(gh);
    if (ya) {
      pintar(ya);
    } else {
      datosRepo(gh).then(function (res) {
        if (res.ok) { pintar(res.d); return; }
        if (detallado) descEl.textContent = mensajeError(res.motivo);
        else descEl.hidden = true;
      });
    }
    return tarjeta;
  }

  /* ---------- datos ---------- */

  function normalizarProyecto(p) {
    var anio = parseInt(p.anio, 10);
    return {
      _id: uid(),
      anio: isFinite(anio) ? anio : new Date().getFullYear(),
      nombre: str(p.nombre),
      info: str(p.info),
      detalle: Array.isArray(p.detalle) ? p.detalle.map(str).join("\n\n") : str(p.detalle),
      tecnologias: listaTecnologias(p.tecnologias),
      repo: str(p.repo),
      demo: str(p.demo),
      ejemplo: !!p.ejemplo
    };
  }

  function normalizar(d) {
    var lista = [];
    if (Array.isArray(d.proyectos)) {
      lista = d.proyectos.slice();
    } else if (Array.isArray(d.anios)) {
      // Formato anterior: proyectos agrupados por año
      d.anios.forEach(function (a) {
        (a.proyectos || []).forEach(function (p) {
          var copia = {};
          Object.keys(p).forEach(function (k) { copia[k] = p[k]; });
          copia.anio = a.anio;
          if (copia.info === undefined && copia.descripcion !== undefined) copia.info = copia.descripcion;
          lista.push(copia);
        });
      });
    }
    return {
      nombre: str(d.nombre),
      rol: str(d.rol),
      sobreMi: str(d.sobreMi),
      github: str(d.github),
      proyectos: lista.map(normalizarProyecto)
    };
  }

  function limpio(d) {
    return {
      nombre: d.nombre,
      rol: d.rol,
      sobreMi: d.sobreMi,
      github: d.github,
      proyectos: d.proyectos.map(function (p) {
        return {
          anio: p.anio,
          nombre: p.nombre,
          info: p.info,
          detalle: p.detalle,
          tecnologias: p.tecnologias.slice(),
          repo: p.repo,
          demo: p.demo,
          ejemplo: !!p.ejemplo
        };
      })
    };
  }

  var ENCABEZADO = [
    "/* ==========================================================================",
    "   AQUÍ ESTÁN TUS DATOS: tu nombre, tu GitHub y tus proyectos.",
    "   Este archivo lo generó el modo edición del portfolio. Reemplazá con él el",
    "   datos.js que está en GitHub para publicar los cambios.",
    "",
    "   También podés editarlo a mano. Respetá las comillas \"\" y las comas , al",
    "   final de cada línea.",
    "",
    "   Cada proyecto tiene:",
    "     anio         el año en que lo hiciste",
    "     nombre       el título",
    "     info         descripción corta (se ve en la tarjeta)",
    "     detalle      descripción larga, opcional. Para separar párrafos escribí \\n\\n",
    "     tecnologias  lista entre corchetes y comillas, por ejemplo [\"Python\", \"HTML\"]",
    "     repo         repositorio de GitHub: \"usuario/repositorio\" o el link completo",
    "     demo         opcional: link a la versión online",
    "     ejemplo      true muestra la etiqueta \"Ejemplo\". Borrá la línea al reemplazarlo.",
    "   ========================================================================== */",
    ""
  ].join("\n");

  function serializar(d) {
    var c = limpio(d);
    function q(s) { return JSON.stringify(str(s)); }
    var L = [ENCABEZADO, "const PORTFOLIO = {"];
    L.push("  nombre: " + q(c.nombre) + ",");
    L.push("  rol: " + q(c.rol) + ",");
    L.push("  sobreMi: " + q(c.sobreMi) + ",");
    L.push("  github: " + q(c.github) + ",");
    L.push("");
    L.push("  proyectos: [");
    c.proyectos.forEach(function (p) {
      L.push("    {");
      L.push("      anio: " + p.anio + ",");
      L.push("      nombre: " + q(p.nombre) + ",");
      L.push("      info: " + q(p.info) + ",");
      L.push("      detalle: " + q(p.detalle) + ",");
      L.push("      tecnologias: [" + p.tecnologias.map(q).join(", ") + "],");
      L.push("      repo: " + q(p.repo) + ",");
      L.push("      demo: " + q(p.demo) + ",");
      if (p.ejemplo) L.push("      ejemplo: true,");
      L.push("    },");
    });
    L.push("  ],");
    L.push("};");
    return L.join("\n") + "\n";
  }

  /* ---------- estado ---------- */

  var data = normalizar(fuente);
  var editable = puedeEditar();
  var editing = false;
  var dirty = false;
  var estado = "";
  var estadoEl = null;
  var filtro = { q: "", anio: "", tec: "" };
  var refs = {};

  // El botón Editar aparece al abrir el archivo en tu computadora, o en internet con #editar al final del link.
  function puedeEditar() {
    var host = location.hostname;
    return location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || location.hash === "#editar";
  }

  function cargarBorrador() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (d && d.base === BASE && d.data && Array.isArray(d.data.proyectos)) return d.data;
      localStorage.removeItem(KEY);
    } catch (e) {}
    return null;
  }
  function guardarBorrador() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ base: BASE, data: limpio(data) }));
      return true;
    } catch (e) {
      return false;
    }
  }

  if (editable) {
    var borrador = cargarBorrador();
    if (borrador) { data = normalizar(borrador); dirty = true; }
  }

  function aniosUnicos() {
    var vistos = {};
    var lista = [];
    data.proyectos.forEach(function (p) {
      if (!vistos[p.anio]) { vistos[p.anio] = true; lista.push(p.anio); }
    });
    return lista.sort(function (a, b) { return b - a; });
  }

  function tecnologiasUnicas() {
    var mapa = {};
    var orden = [];
    data.proyectos.forEach(function (p) {
      p.tecnologias.forEach(function (t) {
        var k = sinAcentos(t);
        if (!mapa[k]) { mapa[k] = { nombre: t, n: 0 }; orden.push(mapa[k]); }
        mapa[k].n++;
      });
    });
    return orden.sort(function (a, b) { return b.n - a.n || a.nombre.localeCompare(b.nombre, "es"); });
  }

  function hayFiltro() { return !!(filtro.q.trim() || filtro.anio || filtro.tec); }

  function filtrados() {
    var q = sinAcentos(filtro.q).trim();
    return data.proyectos.filter(function (p) {
      if (filtro.anio && String(p.anio) !== filtro.anio) return false;
      if (filtro.tec && !p.tecnologias.some(function (t) { return igual(t, filtro.tec); })) return false;
      if (q) {
        var texto = sinAcentos([p.nombre, p.info, p.detalle, p.tecnologias.join(" "), p.anio].join(" "));
        if (texto.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function iniciales(nombre) {
    var t = str(nombre).trim().split(/\s+/).filter(Boolean);
    if (!t.length) return "·";
    if (t.length === 1) return t[0].charAt(0).toUpperCase();
    return (t[0].charAt(0) + t[t.length - 1].charAt(0)).toUpperCase();
  }

  function setEstado(m) {
    estado = m;
    if (estadoEl) estadoEl.textContent = m;
  }

  function cambio() {
    dirty = true;
    var ok = guardarBorrador();
    estado = ok
      ? "Cambios guardados en este navegador. Descargá datos.js para publicarlos."
      : "No se pudo guardar en este navegador. Descargá datos.js para no perder los cambios.";
    renderTodo();
  }

  /* ---------- controles de formulario ---------- */

  function field(label, id, control, hint) {
    return h("div", { class: "field" }, [
      h("label", { for: id, text: label }),
      control,
      hint ? h("p", { class: "hint", text: hint }) : null
    ]);
  }
  function textInput(id, val, ph) {
    return h("input", { type: "text", id: id, class: "inp", value: val || "", placeholder: ph || null, autocomplete: "off" });
  }
  function areaInput(id, val, filas, ph) {
    var el = h("textarea", { id: id, class: "inp", rows: filas || 3, placeholder: ph || null });
    el.value = val || "";
    return el;
  }
  function confirmBtn(label, onConfirm, clase) {
    var b = h("button", { type: "button", class: "btn danger " + (clase || ""), text: label });
    var armado = false;
    var t = null;
    b.addEventListener("click", function () {
      if (!armado) {
        armado = true;
        b.textContent = "¿Seguro? Tocá de nuevo";
        t = setTimeout(function () { armado = false; b.textContent = label; }, 3000);
      } else {
        clearTimeout(t);
        onConfirm();
      }
    });
    return b;
  }

  // Abre una ventana con un formulario. guardar() devuelve un mensaje de error, o nada si todo salió bien.
  function abrirFormulario(titulo, nodos, guardar, ayuda) {
    var dlg = h("dialog", { class: "dlg", "aria-labelledby": "dlg-titulo" });
    var error = h("p", { class: "error", role: "alert", hidden: true });
    var hijos = [h("h2", { class: "dlg-titulo", id: "dlg-titulo", text: titulo }), ayuda ? h("p", { class: "hint", text: ayuda }) : null]
      .concat(nodos)
      .concat([
        error,
        h("div", { class: "row fin" }, [
          h("button", { type: "button", class: "btn", text: "Cancelar", onclick: function () { dlg.close(); } }),
          h("button", { type: "submit", class: "btn primary", text: "Guardar" })
        ])
      ]);
    var form = h("form", { class: "form", novalidate: "novalidate" }, hijos);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = guardar();
      if (msg) { error.textContent = msg; error.hidden = false; return; }
      dlg.close();
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", function () { dlg.remove(); });
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function abrirProyecto(p) {
    var nuevo = !p;
    var d = p || {
      anio: filtro.anio ? parseInt(filtro.anio, 10) : new Date().getFullYear(),
      nombre: "", info: "", detalle: "", tecnologias: [], repo: "", demo: "", ejemplo: false
    };

    var cNombre = textInput("d-nombre", d.nombre, "Ej: Mi asistente de voz");
    var cAnio = h("input", { type: "number", id: "d-anio", class: "inp", min: ANIO_MIN, max: ANIO_MAX, inputmode: "numeric" });
    cAnio.value = String(d.anio);
    var cInfo = areaInput("d-info", d.info, 2, "Una o dos frases: qué hace el proyecto.");
    var cDetalle = areaInput("d-detalle", d.detalle, 6, "Contá más: cómo lo hiciste, qué aprendiste, qué sigue. Separá los párrafos con una línea en blanco.");
    var cTec = textInput("d-tec", d.tecnologias.join(", "), "Python, HTML, CSS");
    var cRepo = textInput("d-repo", d.repo, "usuario/repositorio");
    var cDemo = textInput("d-demo", d.demo, "https://...");

    var sugerencias = h("div", { class: "chips chips-s", role: "group", "aria-label": "Tecnologías que ya usaste" },
      tecnologiasUnicas().slice(0, 12).map(function (t) {
        return h("button", {
          type: "button",
          class: "chip",
          text: "+ " + t.nombre,
          onclick: function () {
            var actual = listaTecnologias(cTec.value);
            if (!actual.some(function (x) { return igual(x, t.nombre); })) actual.push(t.nombre);
            cTec.value = actual.join(", ");
          }
        });
      }));

    // Vista previa del repositorio mientras escribís el link
    var caja = h("div", { class: "vp-caja", "aria-live": "polite" });
    var temporizador = null;
    function refrescarVista() {
      clearTimeout(temporizador);
      temporizador = setTimeout(function () {
        caja.replaceChildren();
        var texto = cRepo.value.trim();
        if (!texto) return;
        var url = normalizarUrl(texto);
        if (!url) {
          caja.appendChild(h("p", { class: "hint", text: "Escribí usuario/repositorio o pegá el link completo." }));
          return;
        }
        if (!repoGitHub(url)) {
          caja.appendChild(h("p", { class: "hint", text: "El link es válido, pero la vista previa solo funciona con repositorios de GitHub." }));
          return;
        }
        caja.appendChild(vistaPrevia(url, true));
      }, 500);
    }
    cRepo.addEventListener("input", refrescarVista);
    refrescarVista();

    abrirFormulario(
      nuevo ? "Agregar proyecto" : "Editar proyecto",
      [
        field("Nombre del proyecto", "d-nombre", cNombre),
        h("div", { class: "grid2" }, [
          field("Año", "d-anio", cAnio),
          field("Tecnologías (separadas por coma)", "d-tec", cTec)
        ]),
        sugerencias,
        field("Descripción corta", "d-info", cInfo, "Se ve en la tarjeta del proyecto."),
        field("Descripción detallada (opcional)", "d-detalle", cDetalle, "Aparece al tocar “Ver más” en la tarjeta."),
        h("div", { class: "grid2" }, [
          field("Link de GitHub", "d-repo", cRepo, "Acepta usuario/repositorio o el link completo."),
          field("Versión online (opcional)", "d-demo", cDemo)
        ]),
        caja
      ],
      function guardar() {
        var nombre = cNombre.value.trim();
        if (!nombre) { cNombre.focus(); return "Escribí el nombre del proyecto."; }
        var anio = parseInt(cAnio.value, 10);
        if (!(anio >= ANIO_MIN && anio <= ANIO_MAX)) { cAnio.focus(); return "Escribí un año entre " + ANIO_MIN + " y " + ANIO_MAX + "."; }
        var repo = cRepo.value.trim();
        if (repo && !normalizarUrl(repo)) { cRepo.focus(); return "El link de GitHub no se entiende. Probá con usuario/repositorio o con el link completo."; }
        var demo = cDemo.value.trim();
        if (demo && !normalizarUrl(demo)) { cDemo.focus(); return "El link de la versión online no se entiende. Probá con https://..."; }

        var valores = {
          anio: anio,
          nombre: nombre,
          info: cInfo.value.trim(),
          detalle: cDetalle.value.trim(),
          tecnologias: listaTecnologias(cTec.value),
          repo: repo,
          demo: demo,
          ejemplo: false
        };
        if (nuevo) {
          valores._id = uid();
          data.proyectos.unshift(valores);
        } else {
          Object.keys(valores).forEach(function (k) { p[k] = valores[k]; });
        }
        cambio();
      },
      d.ejemplo ? "Este es un proyecto de ejemplo. Al guardarlo deja de mostrarse como Ejemplo." : ""
    );
  }

  function abrirPerfil() {
    var cNombre = textInput("d-pnombre", data.nombre, "Tu nombre");
    var cRol = textInput("d-prol", data.rol, "Ej: Programación y proyectos propios");
    var cSobre = areaInput("d-psobre", data.sobreMi, 3, "Una presentación corta.");
    var cGit = textInput("d-pgit", data.github, "tu-usuario");
    abrirFormulario(
      "Mis datos",
      [
        field("Nombre", "d-pnombre", cNombre),
        field("A qué te dedicás (una línea)", "d-prol", cRol),
        field("Sobre vos", "d-psobre", cSobre),
        field("Tu perfil de GitHub", "d-pgit", cGit, "Escribí tu usuario o pegá el link de tu perfil.")
      ],
      function guardar() {
        var nombre = cNombre.value.trim();
        if (!nombre) { cNombre.focus(); return "Escribí tu nombre."; }
        var gh = cGit.value.trim();
        if (gh && !normalizarUrl(gh, true)) { cGit.focus(); return "El perfil de GitHub no se entiende. Probá con tu usuario o con el link completo."; }
        data.nombre = nombre;
        data.rol = cRol.value.trim();
        data.sobreMi = cSobre.value.trim();
        data.github = gh;
        cambio();
      }
    );
  }

  /* ---------- acciones de edición ---------- */

  function eliminar(p) {
    data.proyectos = data.proyectos.filter(function (q) { return q._id !== p._id; });
    cambio();
  }

  function descargar() {
    var texto = serializar(data);
    var blob = new Blob([texto], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: "datos.js" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setEstado("Se descargó datos.js. Reemplazá con él el que está en GitHub para publicar los cambios.");
  }

  function copiar() {
    var texto = serializar(data);
    function plan(ok) {
      setEstado(ok ? "Datos copiados. Pegalos en datos.js." : "No se pudo copiar. Usá Descargar datos.js.");
    }
    function alternativa() {
      var ta = h("textarea", { "aria-hidden": "true", style: "position:fixed;opacity:0;top:0;left:0" });
      ta.value = texto;
      document.body.appendChild(ta);
      var ok = false;
      try { ta.select(); ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      plan(ok);
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(texto).then(function () { plan(true); }, alternativa);
    } else {
      alternativa();
    }
  }

  function descartar() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    data = normalizar(fuente);
    dirty = false;
    estado = "Se descartaron los cambios. Se ve la versión publicada.";
    renderTodo();
  }

  /* ---------- vistas ---------- */

  function barraSuperior() {
    return h("div", { class: "topbar" }, [
      h("div", { class: "brand" }, [
        h("span", { class: "monograma", "aria-hidden": "true", text: iniciales(data.nombre) }),
        h("span", { class: "mark", text: "Portfolio" })
      ]),
      editable && !editing
        ? h("button", { type: "button", class: "btn", id: "btn-editar", text: "Editar", onclick: function () { editing = true; renderTodo(); } })
        : null
    ]);
  }

  function avisos() {
    var lista = [];
    if (editable && editing) {
      lista.push(h("p", { class: "notice", text: "Modo edición: los cambios se guardan en este navegador. Para que los vea cualquiera, tocá Descargar datos.js y reemplazá ese archivo en GitHub." }));
    }
    if (editable && !editing && dirty) {
      lista.push(h("p", { class: "notice", text: "Tenés cambios guardados solo en este navegador. Tocá Editar y descargá datos.js para publicarlos." }));
    }
    if (editable && !editing && !dirty && data.proyectos.some(function (p) { return p.ejemplo; })) {
      lista.push(h("p", { class: "notice", text: "Los proyectos con la etiqueta Ejemplo son de muestra. Tocá Editar para cambiarlos por los tuyos." }));
    }
    return lista.length ? h("div", { class: "notices" }, lista) : null;
  }

  function stat(valor, etiqueta) {
    return h("div", { class: "stat" }, [h("dt", { text: etiqueta }), h("dd", { text: String(valor) })]);
  }

  function portada() {
    var anios = aniosUnicos();
    var rango = "";
    if (anios.length) {
      var max = anios[0];
      var min = anios[anios.length - 1];
      rango = min === max ? String(max) : min + " — " + max;
    }
    var gh = normalizarUrl(data.github, true);
    return h("header", { class: "hero" }, [
      h("p", { class: "eyebrow", text: "Proyectos" + (rango ? " · " + rango : "") }),
      h("h1", { text: data.nombre || "Tu nombre" }),
      data.rol ? h("p", { class: "role", text: data.rol }) : null,
      data.sobreMi ? h("p", { class: "bio", text: data.sobreMi }) : null,
      h("div", { class: "row" }, [
        gh ? h("a", { class: "btn primary", href: gh, target: "_blank", rel: "noopener noreferrer", text: "Ver mi GitHub ↗" }) : null,
        h("button", { type: "button", class: "btn", text: "Ver proyectos ↓", onclick: irAProyectos })
      ]),
      h("dl", { class: "stats" }, [
        stat(data.proyectos.length, "proyectos"),
        stat(anios.length, "años"),
        stat(tecnologiasUnicas().length, "tecnologías")
      ])
    ]);
  }

  function irAProyectos() {
    if (refs.filtros && refs.filtros.scrollIntoView) refs.filtros.scrollIntoView({ block: "start" });
  }

  function filtros() {
    var anios = aniosUnicos();
    if (filtro.anio && anios.indexOf(parseInt(filtro.anio, 10)) < 0) filtro.anio = "";
    if (filtro.tec && !tecnologiasUnicas().some(function (t) { return igual(t.nombre, filtro.tec); })) filtro.tec = "";

    var buscar = h("input", { type: "search", id: "f-buscar", class: "inp", placeholder: "Buscar por nombre, tecnología o palabra", autocomplete: "off", "aria-label": "Buscar proyectos" });
    buscar.value = filtro.q;
    buscar.addEventListener("input", function () { filtro.q = buscar.value; actualizarResultados(); });

    var selAnio = h("select", { id: "f-anio", class: "inp", "aria-label": "Filtrar por año" },
      [h("option", { value: "", text: "Todos los años" })].concat(
        anios.map(function (a) { return h("option", { value: String(a), text: String(a) }); })
      ));
    selAnio.value = filtro.anio;
    selAnio.addEventListener("change", function () { filtro.anio = selAnio.value; actualizarResultados(); });

    var chips = h("div", { class: "chips", role: "group", "aria-label": "Filtrar por tecnología" });
    refs.chips = chips;
    dibujarChips();

    var cuenta = h("p", { class: "cuenta", role: "status" });
    var limpiar = h("button", {
      type: "button", class: "btn sm", text: "Limpiar filtros", hidden: true,
      onclick: function () {
        filtro = { q: "", anio: "", tec: "" };
        buscar.value = "";
        selAnio.value = "";
        dibujarChips();
        actualizarResultados();
      }
    });
    refs.cuenta = cuenta;
    refs.limpiar = limpiar;

    var seccion = h("section", { class: "filtros", "aria-label": "Filtrar proyectos" }, [
      h("div", { class: "filtros-fila" }, [buscar, selAnio]),
      chips,
      h("div", { class: "filtros-pie" }, [cuenta, limpiar])
    ]);
    refs.filtros = seccion;
    return seccion;
  }

  function dibujarChips() {
    var botones = tecnologiasUnicas().map(function (t) {
      return h("button", {
        type: "button",
        class: "chip",
        "aria-pressed": filtro.tec && igual(filtro.tec, t.nombre) ? "true" : "false",
        text: t.nombre,
        onclick: function () {
          filtro.tec = igual(filtro.tec, t.nombre) ? "" : t.nombre;
          dibujarChips();
          actualizarResultados();
        }
      });
    });
    refs.chips.replaceChildren.apply(refs.chips, botones);
  }

  function tarjeta(p, i, animar) {
    var repo = normalizarUrl(p.repo);
    var demo = normalizarUrl(p.demo);
    var partes = parrafos(p.detalle);

    var enlaces = [];
    if (demo) enlaces.push(h("a", { class: "repo", href: demo, target: "_blank", rel: "noopener noreferrer", text: "Ver online ↗" }));

    return h("article", { class: "card" + (animar ? " anim" : ""), style: "--i:" + Math.min(i, 10) }, [
      h("h3", { class: "p-title" }, [p.nombre || "Proyecto sin nombre", p.ejemplo ? h("span", { class: "badge", text: "Ejemplo" }) : null]),
      p.info ? h("p", { class: "p-info", text: p.info }) : null,
      p.tecnologias.length
        ? h("ul", { class: "tags" }, p.tecnologias.map(function (t) { return h("li", { class: "tag", text: t }); }))
        : null,
      partes.length
        ? h("details", { class: "more" }, [h("summary", { text: "Ver más" }), h("div", { class: "more-body" }, partes.map(function (t) { return h("p", { text: t }); }))])
        : null,
      repo ? vistaPrevia(repo, false) : (editing ? h("span", { class: "repo-falta", text: "Falta el link de GitHub" }) : null),
      enlaces.length ? h("div", { class: "links" }, enlaces) : null,
      editing
        ? h("div", { class: "acciones" }, [
            h("button", { type: "button", class: "btn sm", text: "Editar", onclick: function () { abrirProyecto(p); } }),
            confirmBtn("Eliminar", function () { eliminar(p); }, "sm")
          ])
        : null
    ]);
  }

  function vistaResultados(lista, animar) {
    var total = data.proyectos.length;
    if (!lista.length) {
      var hijos = [h("p", { text: total ? "Ningún proyecto coincide con los filtros." : "Todavía no hay proyectos cargados." })];
      if (total) {
        hijos.push(h("button", { type: "button", class: "btn", text: "Limpiar filtros", onclick: function () { if (refs.limpiar) refs.limpiar.click(); } }));
      } else if (editing) {
        hijos.push(h("button", { type: "button", class: "btn primary", text: "+ Agregar proyecto", onclick: function () { abrirProyecto(null); } }));
      }
      return [h("div", { class: "vacio" }, hijos)];
    }
    var porAnio = {};
    lista.forEach(function (p) { (porAnio[p.anio] = porAnio[p.anio] || []).push(p); });
    var anios = Object.keys(porAnio).map(Number).sort(function (a, b) { return b - a; });
    var i = 0;
    return anios.map(function (a) {
      var ps = porAnio[a];
      return h("section", { class: "year" }, [
        h("header", { class: "year-head" }, [
          h("h2", { class: "year-num", text: String(a) }),
          h("p", { class: "year-count", text: plural(ps.length, "proyecto", "proyectos") })
        ]),
        h("div", { class: "grid" }, ps.map(function (p) { return tarjeta(p, i++, animar); }))
      ]);
    });
  }

  function actualizarResultados() {
    var lista = filtrados();
    var total = data.proyectos.length;
    if (refs.cuenta) {
      refs.cuenta.textContent = hayFiltro()
        ? "Mostrando " + lista.length + " de " + plural(total, "proyecto", "proyectos")
        : plural(total, "proyecto", "proyectos");
    }
    if (refs.limpiar) refs.limpiar.hidden = !hayFiltro();
    var animar = refs.animar;
    refs.animar = false;
    var nodos = vistaResultados(lista, animar);
    refs.resultados.replaceChildren.apply(refs.resultados, nodos);
  }

  function pie() {
    return h("footer", { class: "pie" }, [
      h("span", { text: "© " + new Date().getFullYear() + " " + (data.nombre || "") }),
      h("span", { text: "Hecho con HTML, CSS y JavaScript" })
    ]);
  }

  function barraEdicion() {
    estadoEl = h("p", { class: "status", role: "status", text: estado });
    var botones = [
      h("button", { type: "button", class: "btn primary sm", id: "btn-agregar", text: "+ Agregar proyecto", onclick: function () { abrirProyecto(null); } }),
      h("button", { type: "button", class: "btn sm", id: "btn-perfil", text: "Mis datos", onclick: abrirPerfil }),
      h("button", { type: "button", class: "btn sm", id: "btn-descargar", text: "Descargar datos.js", onclick: descargar }),
      h("button", { type: "button", class: "btn sm", id: "btn-copiar", text: "Copiar datos", onclick: copiar })
    ];
    if (dirty) botones.push(confirmBtn("Descartar cambios", descartar, "sm"));
    botones.push(h("button", { type: "button", class: "btn sm", id: "btn-salir", text: "Salir de edición", onclick: function () { editing = false; renderTodo(); } }));
    return h("div", { class: "toolbar" }, [estadoEl, h("div", { class: "row" }, botones)]);
  }

  function renderTodo() {
    estadoEl = null;
    document.title = (data.nombre || "Portfolio") + " · Portfolio";
    document.body.className = editing ? "editando" : "";

    var principal = h("main", { class: "resultados" });
    refs.resultados = principal;
    refs.animar = true;

    var envoltorio = h("div", { class: "wrap" }, [barraSuperior(), avisos(), portada(), filtros(), principal, pie()]);
    var hijos = [envoltorio];
    if (editing) hijos.push(barraEdicion());
    root.replaceChildren.apply(root, hijos);
    actualizarResultados();
  }

  /* ---------- inicio ---------- */

  window.addEventListener("hashchange", function () {
    var pe = puedeEditar();
    if (pe === editable) return;
    editable = pe;
    if (pe) {
      var b = cargarBorrador();
      if (b) { data = normalizar(b); dirty = true; }
    } else {
      editing = false;
      data = normalizar(fuente);
      dirty = false;
    }
    renderTodo();
  });

  renderTodo();
})();
