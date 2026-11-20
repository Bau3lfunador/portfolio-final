/* ==========================================================================
   AQUÍ ESTÁN TUS DATOS: tu nombre, tu GitHub y tus proyectos.

   Podés cambiarlos de dos formas:
     1) Desde la página, con el botón "Editar" (agregar, sacar y cambiar
        proyectos). Después descargás el archivo datos.js nuevo y reemplazás
        este. Las instrucciones están en el README.
     2) A mano, en este archivo. Respetá las comillas "" y las comas , al
        final de cada línea.

   Cada proyecto tiene:
     anio         el año en que lo hiciste
     nombre       el título
     info         descripción corta (se ve en la tarjeta)
     detalle      descripción larga, opcional. Para separar párrafos escribí \n\n
     tecnologias  lista entre corchetes y comillas, por ejemplo ["Python", "HTML"]
     repo         repositorio de GitHub: "usuario/repositorio" o el link completo
     demo         opcional: link a la versión online
     ejemplo      true muestra la etiqueta "Ejemplo". Borrá la línea al reemplazarlo.
   ========================================================================== */

const PORTFOLIO = {
  nombre: "GARCIA BRUNATO Bautista",
  rol: "Programación y proyectos propios",
  sobreMi:
    "Me gusta construir herramientas que resuelven problemas concretos. Acá reúno lo que hice año a año, cada proyecto con su código en GitHub.",

  // Tu usuario de GitHub (por ejemplo "juanperez") o el link completo de tu perfil.
  github: "",

  proyectos: [
    {
      anio: 2026,
      nombre: "Asistente de voz para la PC",
      info: "Programa que escucha por el micrófono, muestra un indicador mientras te atiende y ejecuta órdenes habladas: abrir programas de la PC y buscar en el navegador.",
      detalle:
        "El programa detecta el micrófono de la computadora y queda escuchando. Cuando reconoce una orden, responde y la ejecuta: por ejemplo, abrir un programa o entrar al navegador y hacer una búsqueda.\n\nMientras escucha muestra un indicador visual en pantalla, para saber cuándo te está atendiendo.",
      tecnologias: ["Python", "Reconocimiento de voz", "Windows"],
      repo: "", // Ejemplo: "tu-usuario/asistente-de-voz"
      demo: "",
    },
    {
      anio: 2026,
      nombre: "Ordenador de Descargas",
      info: "Script que revisa la carpeta de Descargas y manda cada archivo a su carpeta según el tipo: imágenes, documentos, instaladores y comprimidos.",
      detalle:
        "Cada cierto tiempo mira los archivos nuevos y los clasifica por extensión. Si ya existe un archivo con el mismo nombre, le agrega un número para no pisarlo.",
      tecnologias: ["Python"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
    {
      anio: 2026,
      nombre: "Control de gastos del mes",
      info: "Aplicación web para anotar gastos por categoría y ver con un gráfico cuánto va gastado del presupuesto.",
      detalle: "",
      tecnologias: ["HTML", "CSS", "JavaScript"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
    {
      anio: 2026,
      nombre: "Bot de Discord para estudiar",
      info: "Bot que arma turnos de estudio, avisa con un temporizador y lleva el ranking de quién estudió más en la semana.",
      detalle: "",
      tecnologias: ["Python", "discord.py"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
    {
      anio: 2026,
      nombre: "Juego de plataformas 2D",
      info: "Juego hecho desde cero, con niveles, enemigos y puntajes que se guardan entre partidas.",
      detalle: "",
      tecnologias: ["Python", "Pygame"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
    {
      anio: 2026,
      nombre: "Página para un comercio del barrio",
      info: "Sitio con catálogo de productos, horarios y botón directo a WhatsApp para un negocio local.",
      detalle: "",
      tecnologias: ["HTML", "CSS"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
    {
      anio: 2025,
      nombre: "Calculadora de promedios",
      info: "Calculadora que suma las notas de cada materia y muestra el promedio y cuánto falta para aprobar.",
      detalle: "",
      tecnologias: ["JavaScript"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
    {
      anio: 2025,
      nombre: "Mi primera página web",
      info: "Primer sitio publicado, con presentación personal, fotos y un formulario de contacto.",
      detalle: "",
      tecnologias: ["HTML", "CSS"],
      repo: "",
      demo: "",
      ejemplo: true,
    },
  ],
};
