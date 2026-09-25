var listaCanales = [];
var indiceSeleccionado = 0;
var listaVisible = true;

// URLs
var URL_GITHUB_M3U = "https://raw.githubusercontent.com/josethwert/TVM3U-Player/main/Lista/custom_url.m3u";
var URL_PROXY_M3U = "https://api.allorigins.win/raw?url=" + encodeURIComponent(URL_GITHUB_M3U);
var RUTA_LOCAL_M3U = "Lista/custom_url.m3u";

// Variables para salida
var contadorSalir = 0;
var temporizadorSalir = null;
var osdTimeout = null;

// Indica si actualmente estamos usando el reproductor Dailymotion
var reproduciendoDailymotion = false;

// ======================================================
// INICIO
// ======================================================

window.onload = function () {
    inicializarReproductorHTML();
    registrarTeclasTizen();

    // 1. Cargar lista local
    cargarListaLocal();

    // 2. Sincronizar desde GitHub
    sincronizarListaDesdeGitHub();

    document.addEventListener("keydown", manejarTeclado);
};


// ======================================================
// INICIALIZAR REPRODUCTOR
// ======================================================

function inicializarReproductorHTML() {
    crearReproductorAVPlay();
}


// ======================================================
// CREAR REPRODUCTOR AVPLAY
// ======================================================

function crearReproductorAVPlay() {
    var wrapper = document.getElementById("media-player-wrapper");

    if (!wrapper) {
        return;
    }

    reproduciendoDailymotion = false;

    if (typeof webapis !== "undefined" && webapis.avplay) {

        wrapper.innerHTML =
            '<object id="avplayer" ' +
            'type="application/avplayer" ' +
            'style="width:100%; height:100%;"></object>';

    } else {

        wrapper.innerHTML =
            '<video id="htmlvideo" ' +
            'style="width:100%; height:100%; background:#000;" ' +
            'controls autoplay></video>';
    }
}


// ======================================================
// DETECTAR DAILYMOTION
// ======================================================

function esDailymotion(url) {

    if (!url) {
        return false;
    }

    return /(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/(?:video|embed\/video)\/[a-zA-Z0-9]+/i.test(url);
}


// ======================================================
// OBTENER ID DE DAILYMOTION
// ======================================================

function obtenerIdDailymotion(url) {

    if (!url) {
        return null;
    }

    var coincidencia = url.match(
        /dailymotion\.com\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/i
    );

    if (coincidencia && coincidencia[1]) {
        return coincidencia[1];
    }

    return null;
}


// ======================================================
// CREAR REPRODUCTOR DAILYMOTION
// ======================================================

function reproducirDailymotion(videoId) {

    var wrapper = document.getElementById("media-player-wrapper");

    if (!wrapper || !videoId) {
        console.error("No se pudo crear el reproductor Dailymotion.");
        return;
    }

    console.log("Dailymotion detectado. Video ID:", videoId);

    // Detener AVPlay si estaba reproduciendo algo
    detenerAVPlay();

    reproduciendoDailymotion = true;

    /*
     * Usamos el reproductor de Dailymotion directamente.
     *
     * No utilizamos la URL sec2(...) obtenida por IDM.
     * Dailymotion se encarga de obtener internamente
     * el stream correspondiente.
     */
    var urlDailymotion =
        "https://dailymotion.com/embed/video/" +
        videoId +
        "?ui-highlight" +
        "&start" +
        "&endscreen-enable=0" +
        "&controls=1" +
        "&mute=0" +
        "&ui-start-screen-info=0" +
        "&ui-logo=0" +
        "&autoplay=1";

    console.log("Abriendo reproductor Dailymotion:");
    console.log(urlDailymotion);

    wrapper.innerHTML = "";

    var iframe = document.createElement("iframe");

    iframe.id = "dailymotion-player";
    iframe.src = urlDailymotion;

    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.style.backgroundColor = "#000";

    iframe.setAttribute(
        "allow",
        "autoplay; fullscreen; picture-in-picture"
    );

    iframe.setAttribute("allowfullscreen", "true");

    /*
     * Importante para Dailymotion.
     */
    iframe.setAttribute(
        "referrerpolicy",
        "strict-origin-when-cross-origin"
    );

    iframe.setAttribute("frameborder", "0");

    wrapper.appendChild(iframe);

    console.log("Reproductor Dailymotion creado correctamente.");
}


// ======================================================
// DETENER AVPLAY
// ======================================================

function detenerAVPlay() {

    try {

        if (typeof webapis !== "undefined" && webapis.avplay) {

            try {
                webapis.avplay.stop();
            } catch (e1) {
                console.log("AVPlay stop:", e1);
            }

            try {
                webapis.avplay.close();
            } catch (e2) {
                console.log("AVPlay close:", e2);
            }
        }

    } catch (e) {

        console.error("Error deteniendo AVPlay:", e);
    }
}


// ======================================================
// VOLVER DE DAILYMOTION A AVPLAY
// ======================================================

function prepararAVPlay() {

    var wrapper = document.getElementById("media-player-wrapper");

    if (!wrapper) {
        return;
    }

    if (reproduciendoDailymotion) {

        console.log("Cerrando reproductor Dailymotion.");

        wrapper.innerHTML = "";

        reproduciendoDailymotion = false;
    }

    // Crear AVPlay nuevamente
    if (typeof webapis !== "undefined" && webapis.avplay) {

        wrapper.innerHTML =
            '<object id="avplayer" ' +
            'type="application/avplayer" ' +
            'style="width:100%; height:100%;"></object>';

    } else {

        wrapper.innerHTML =
            '<video id="htmlvideo" ' +
            'style="width:100%; height:100%; background:#000;" ' +
            'controls autoplay></video>';
    }
}


// ======================================================
// TECLAS TIZEN
// ======================================================

function registrarTeclasTizen() {

    try {

        if (typeof tizen !== "undefined" && tizen.tvinputdevice) {

            tizen.tvinputdevice.registerKey("MediaPlay");
            tizen.tvinputdevice.registerKey("MediaStop");
            tizen.tvinputdevice.registerKey("MediaPause");

            tizen.tvinputdevice.registerKey("ChannelUp");
            tizen.tvinputdevice.registerKey("ChannelDown");

            tizen.tvinputdevice.registerKey("Return");
        }

    } catch (e) {

        console.log("No es un entorno Tizen nativo:", e);
    }
}


// ======================================================
// CARGAR LISTA LOCAL
// ======================================================

function cargarListaLocal() {

    var xhr = new XMLHttpRequest();

    xhr.open("GET", RUTA_LOCAL_M3U, true);

    xhr.onreadystatechange = function () {

        if (xhr.readyState === 4) {

            if (xhr.status === 200 || xhr.status === 0) {

                listaCanales = parsearM3U(xhr.responseText);

                renderizarCanales(listaCanales);

                console.log("Lista local cargada correctamente.");
            }
        }
    };

    xhr.send();
}


// ======================================================
// SINCRONIZAR GITHUB
// ======================================================

function sincronizarListaDesdeGitHub() {

    var timestamp = new Date().getTime();

    var urlFinal =
        URL_GITHUB_M3U +
        "?t=" +
        timestamp;

    if (window.fetch) {

        fetch(urlFinal, {
            cache: "reload"
        })

        .then(function (response) {

            if (!response.ok) {
                throw new Error(
                    "HTTP Status " +
                    response.status
                );
            }

            return response.text();
        })

        .then(function (data) {

            procesarYActualizarLista(
                data,
                "GitHub Directo (Fetch)"
            );
        })

        .catch(function (err) {

            console.warn(
                "Falló Fetch directo. " +
                "Intentando vía Proxy CORS:",
                err
            );

            descargarViaProxy(timestamp);
        });

    } else {

        descargarViaXHR(urlFinal, timestamp);
    }
}


// ======================================================
// DESCARGAR MEDIANTE PROXY
// ======================================================

function descargarViaProxy(timestamp) {

    var urlProxy =
        URL_PROXY_M3U +
        "&t=" +
        timestamp;

    if (window.fetch) {

        fetch(urlProxy, {
            cache: "no-store"
        })

        .then(function (res) {
            return res.text();
        })

        .then(function (data) {

            procesarYActualizarLista(
                data,
                "GitHub vía Proxy"
            );
        })

        .catch(function (e) {

            console.error(
                "Error definitivo al descargar desde GitHub:",
                e
            );
        });

    } else {

        descargarViaXHR(urlProxy, timestamp);
    }
}


// ======================================================
// DESCARGAR XHR
// ======================================================

function descargarViaXHR(targetUrl, timestamp) {

    var xhr = new XMLHttpRequest();

    xhr.open("GET", targetUrl, true);

    xhr.setRequestHeader(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
    );

    xhr.setRequestHeader(
        "Pragma",
        "no-cache"
    );

    xhr.setRequestHeader(
        "Expires",
        "0"
    );

    xhr.onreadystatechange = function () {

        if (xhr.readyState === 4) {

            if (
                xhr.status === 200 &&
                xhr.responseText
            ) {

                procesarYActualizarLista(
                    xhr.responseText,
                    "GitHub (XHR)"
                );

            } else {

                console.warn(
                    "Error XHR TV Status:",
                    xhr.status
                );
            }
        }
    };

    xhr.send();
}


// ======================================================
// PROCESAR LISTA
// ======================================================

function procesarYActualizarLista(
    contenidoM3U,
    fuente
) {

    var canalesNuevos =
        parsearM3U(contenidoM3U);

    if (
        canalesNuevos &&
        canalesNuevos.length > 0
    ) {

        listaCanales = canalesNuevos;

        if (
            indiceSeleccionado >=
            listaCanales.length
        ) {

            indiceSeleccionado = 0;
        }

        renderizarCanales(
            listaCanales
        );

        actualizarSeleccionVisual();

        console.log(
            "¡Lista actualizada con éxito " +
            "en la TV desde: " +
            fuente +
            "!"
        );

    } else {

        console.warn(
            "La lista descargada desde " +
            fuente +
            " estaba vacía o con formato inválido."
        );
    }
}


// ======================================================
// PARSEAR M3U
// ======================================================

function parsearM3U(m3uContent) {

    var lineas =
        m3uContent.split("\n");

    var canales = [];

    var nombreActual = "";

    for (
        var i = 0;
        i < lineas.length;
        i++
    ) {

        var linea =
            lineas[i].trim();

        if (
            linea.startsWith("#EXTINF:")
        ) {

            var partes =
                linea.split(",");

            nombreActual =
                partes
                    .slice(1)
                    .join(",")
                    .trim();

        } else if (
            linea.length > 0 &&
            !linea.startsWith("#")
        ) {

            canales.push({

                nombre:
                    nombreActual ||
                    "Canal " +
                    (canales.length + 1),

                url: linea
            });

            nombreActual = "";
        }
    }

    return canales;
}


// ======================================================
// RENDERIZAR CANALES
// ======================================================

function renderizarCanales(canales) {

    var ul =
        document.getElementById(
            "playlist"
        );

    if (!ul) {
        return;
    }

    ul.innerHTML = "";

    if (canales.length === 0) {

        ul.innerHTML =
            "<li style='padding:10px;'>" +
            "No se encontraron canales." +
            "</li>";

        return;
    }

    canales.forEach(
        function (canal, index) {

            var li =
                document.createElement("li");

            li.innerText =
                canal.nombre;

            li.setAttribute(
                "data-index",
                index
            );

            if (
                index ===
                indiceSeleccionado
            ) {

                li.classList.add(
                    "selected"
                );
            }

            li.onclick = function () {

                indiceSeleccionado =
                    index;

                actualizarSeleccionVisual();

                reproducirCanal(
                    canal.url
                );

                ocultarLista();
            };

            ul.appendChild(li);
        }
    );
}


// ======================================================
// TECLADO
// ======================================================

function manejarTeclado(e) {

    var keyCode =
        e.keyCode;

    console.log(
        "Tecla presionada KeyCode:",
        keyCode
    );


    // Canal siguiente
    if (
        keyCode === 427 ||
        keyCode === 33
    ) {

        cambiarCanalRelativo(1);

        e.preventDefault();

        return;
    }


    // Canal anterior
    else if (
        keyCode === 428 ||
        keyCode === 34
    ) {

        cambiarCanalRelativo(-1);

        e.preventDefault();

        return;
    }


    // RETURN
    if (keyCode === 10009) {

        if (!listaVisible) {

            manejadorSalidaTriplePulsacion();

        } else {

            ocultarLista();
        }

        return;
    }


    // LISTA VISIBLE
    if (listaVisible) {

        if (keyCode === 38) {

            if (indiceSeleccionado > 0) {

                indiceSeleccionado--;

                actualizarSeleccionVisual();
            }

        }

        else if (keyCode === 40) {

            if (
                indiceSeleccionado <
                listaCanales.length - 1
            ) {

                indiceSeleccionado++;

                actualizarSeleccionVisual();
            }

        }

        else if (keyCode === 13) {

            if (
                listaCanales[
                    indiceSeleccionado
                ]
            ) {

                reproducirCanal(
                    listaCanales[
                        indiceSeleccionado
                    ].url
                );

                ocultarLista();
            }

        }

        else if (keyCode === 27) {

            ocultarLista();
        }

    }

    // LISTA OCULTA
    else {

        if (
            keyCode === 38 ||
            keyCode === 40 ||
            keyCode === 13 ||
            keyCode === 27
        ) {

            mostrarLista();
        }
    }
}


// ======================================================
// OCULTAR LISTA
// ======================================================

function ocultarLista() {

    var list =
        document.getElementById(
            "channel-list"
        );

    if (list) {

        list.classList.add("hidden");

        listaVisible = false;
    }
}


// ======================================================
// MOSTRAR LISTA
// ======================================================

function mostrarLista() {

    var list =
        document.getElementById(
            "channel-list"
        );

    if (list) {

        list.classList.remove(
            "hidden"
        );

        listaVisible = true;
    }
}


// ======================================================
// ACTUALIZAR SELECCIÓN
// ======================================================

function actualizarSeleccionVisual() {

    var elementos =
        document.querySelectorAll(
            "#playlist li"
        );

    elementos.forEach(
        function (el, idx) {

            if (
                idx ===
                indiceSeleccionado
            ) {

                el.classList.add(
                    "selected"
                );

                el.scrollIntoView({
                    block: "nearest"
                });

            } else {

                el.classList.remove(
                    "selected"
                );
            }
        }
    );
}


// ======================================================
// REPRODUCIR CANAL
// ======================================================

function reproducirCanal(streamUrl) {
    console.log("Reproduciendo:", streamUrl);

    var canalActual = listaCanales[indiceSeleccionado];
    if (canalActual) {
        mostrarOSD(indiceSeleccionado + 1, canalActual.nombre);
    }

    // Detectar si el canal pertenece a Dailymotion
    if (esDailymotion(streamUrl)) {
        var videoId = obtenerIdDailymotion(streamUrl);

        if (videoId) {
            // URL de tu servidor en Render con el ID del canal
            var urlProxy = "https://proxy-dailymotion-tv.onrender.com/get-dailymotion-stream?id=" + videoId;

            fetch(urlProxy)
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    if (data && data.streamUrl) {
                        console.log("URL M3U8 obtenida con éxito:", data.streamUrl);
                        lanzarAVPlay(data.streamUrl);
                    } else {
                        console.error("No se pudo obtener la URL de transmisión.");
                    }
                })
                .catch(function (err) {
                    console.error("Error al conectar con el proxy:", err);
                });
            return;
        }
    }

    // Reproducción para enlaces M3U8 estándar
    lanzarAVPlay(streamUrl);
}

// ======================================================
// OSD
// ======================================================

function mostrarOSD(
    numeroCanal,
    nombreCanal
) {

    var banner =
        document.getElementById(
            "osd-banner"
        );

    var numEl =
        document.getElementById(
            "osd-number"
        );

    var titleEl =
        document.getElementById(
            "osd-title"
        );

    if (
        !banner ||
        !numEl ||
        !titleEl
    ) {

        return;
    }


    var numFormateado =
        (
            numeroCanal < 10 ?
            "0" :
            ""
        ) +
        numeroCanal;


    numEl.innerText =
        numFormateado;

    titleEl.innerText =
        nombreCanal;


    banner.classList.add(
        "show"
    );


    if (osdTimeout) {

        clearTimeout(
            osdTimeout
        );
    }


    osdTimeout =
        setTimeout(
            function () {

                banner.classList.remove(
                    "show"
                );

            },
            4000
        );
}


// ======================================================
// CAMBIAR CANAL
// ======================================================

function cambiarCanalRelativo(
    direccion
) {

    if (
        listaCanales.length === 0
    ) {

        return;
    }


    var nuevoIndice =
        indiceSeleccionado +
        direccion;


    if (nuevoIndice < 0) {

        nuevoIndice =
            listaCanales.length - 1;

    }

    else if (
        nuevoIndice >=
        listaCanales.length
    ) {

        nuevoIndice = 0;
    }


    indiceSeleccionado =
        nuevoIndice;


    actualizarSeleccionVisual();


    reproducirCanal(
        listaCanales[
            indiceSeleccionado
        ].url
    );
}


// ======================================================
// SALIDA TRIPLE
// ======================================================

function manejadorSalidaTriplePulsacion() {

    contadorSalir++;


    clearTimeout(
        temporizadorSalir
    );


    temporizadorSalir =
        setTimeout(
            function () {

                contadorSalir = 0;

            },
            1500
        );


    if (contadorSalir === 1) {

        console.log(
            "Presiona 2 veces más para salir."
        );

    }

    else if (
        contadorSalir === 2
    ) {

        console.log(
            "Presiona 1 vez más para salir."
        );

    }

    else if (
        contadorSalir >= 3
    ) {

        console.log(
            "Cerrando la aplicación..."
        );


        if (
            window.tizen &&
            window.tizen.application
        ) {

            tizen.application
                .getCurrentApplication()
                .exit();
        }
    }
}
function lanzarAVPlay(urlFinal) {
    // Si veníamos de otra reproducción, preparamos el contenedor
    prepararAVPlay();

    if (typeof webapis !== "undefined" && webapis.avplay) {
        try {
            webapis.avplay.stop();
            webapis.avplay.close();
        } catch (e1) {
            console.log("Limpieza de AVPlay:", e1);
        }

        try {
            webapis.avplay.open(urlFinal);
            webapis.avplay.setDisplayRect(0, 0, window.innerWidth || 1920, window.innerHeight || 1080);

            var listener = {
                onbufferingstart: function () {
                    console.log("Cargando buffer...");
                },
                onbufferingcomplete: function () {
                    console.log("Buffer listo.");
                },
                onerror: function (error) {
                    console.error("Error en AVPlay:", error);
                }
            };

            webapis.avplay.setListener(listener);

            webapis.avplay.prepareAsync(
                function () {
                    console.log("AVPlay preparado. Iniciando reproducción...");
                    webapis.avplay.play();
                },
                function (err) {
                    console.error("Error en prepareAsync:", err);
                }
            );
        } catch (e2) {
            console.error("Excepción en AVPlay:", e2);
        }
    } else {
        // Modo de prueba para navegador web PC
        var videoElement = document.getElementById("htmlvideo");
        if (videoElement) {
            videoElement.src = urlFinal;
            videoElement.play().catch(function (err) {
                console.log("Interacción requerida para reproducir HTML5 video:", err);
            });
        }
    }
}