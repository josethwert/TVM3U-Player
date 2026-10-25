var listaCanales = [];
var indiceSeleccionado = 0;
var indiceReproduciendo = 0; // NUEVO: Rastrea el canal que suena actualmente
var currentEpgRequestId = 0; // NUEVO: Control para evitar conflictos de respuestas lentas
var listaVisible = true;

// URLs
var URL_GITHUB_M3U = "https://raw.githubusercontent.com/josethwert/TVM3U-Player/main/TVM3U/Lista/custom_url.m3u";
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

                // Si la lista está visible al cargar, mostrar el OSD de inmediato
                if (listaVisible && listaCanales.length > 0) {
                    mostrarOSD(indiceSeleccionado + 1, listaCanales[indiceSeleccionado].nombre);
                }

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

// ======================================================
// PARSEAR M3U (Mejorado para separar Canal y Programa)
// ======================================================

function parsearM3U(m3uContent) {
    var lineas = m3uContent.split("\n");
    var canales = [];
    var nombreCanal = "";
    var programaActual = "";
    var tvgName = "";

    for (var i = 0; i < lineas.length; i++) {
        var linea = lineas[i].trim();

        if (linea.startsWith("#EXTINF:")) {
            // Intentar extraer el atributo tvg-name oficial si la lista lo incluye
            var matchTvgName = linea.match(/tvg-name="([^"]+)"/i);
            tvgName = matchTvgName ? matchTvgName[1] : "";

            // Obtener el texto después de la coma (ej: "Las estrellas - El Chavo del 8" o "Las estrellas 270p")
            var partes = linea.split(",");
            var tituloCompleto = partes.slice(1).join(",").trim();

            // Análisis inteligente para separar Canal y Programa
            if (tituloCompleto.indexOf(" - ") !== -1) {
                // Si el título tiene formato "Canal - Programa" (ej: "Canal 2 - Noticiero")
                var subPartes = tituloCompleto.split(" - ");
                nombreCanal = subPartes[0].trim();
                programaActual = subPartes.slice(1).join(" - ").trim();
            } else {
                // Si es un nombre directo (ej: "Las estrellas 270p"), usamos tvgName si existe como canal,
                // o separamos inteligentemente si contiene espacio y calidad
                nombreCanal = tvgName || tituloCompleto;
                programaActual = tituloCompleto; // O puedes definir un texto por defecto o dinámico
            }

        } else if (linea.length > 0 && !linea.startsWith("#")) {
            // Guardamos el canal con sus campos separados
            canales.push({
                nombre: nombreCanal || ("Canal " + (canales.length + 1)),
                programa: programaActual || "Transmisión en vivo",
                url: linea
            });

            // Limpiar variables para el siguiente canal
            nombreCanal = "";
            programaActual = "";
            tvgName = "";
        }
    }

    return canales;
}


// ======================================================
// RENDERIZAR CANALES (Solo muestra el nombre del canal)
// ======================================================

function renderizarCanales(canales) {
    var ul = document.getElementById("playlist");

    if (!ul) {
        return;
    }

    ul.innerHTML = "";

    if (canales.length === 0) {
        ul.innerHTML = "<li style='padding:10px;'>No se encontraron canales.</li>";
        return;
    }

    canales.forEach(function (canal, index) {
        var li = document.createElement("li");

        // Asignamos únicamente el nombre limpio del canal
        li.innerText = canal.nombre;

        li.setAttribute("data-index", index);

        if (index === indiceSeleccionado) {
            li.classList.add("selected");
        }

        li.onclick = function () {
            indiceSeleccionado = index;
            actualizarSeleccionVisual();
            reproducirCanal(canal.url);
            ocultarLista();
        };

        ul.appendChild(li);
    });
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

                /*
                // Actualizar OSD en tiempo real al subir
                if (listaCanales.length > 0 && listaCanales[indiceSeleccionado]) {
                    var c = listaCanales[indiceSeleccionado];
                    mostrarOSD(indiceSeleccionado + 1, c.nombre, c.programa);
                }
                    */
            }
        }

        else if (keyCode === 40) {
            if (indiceSeleccionado < listaCanales.length - 1) {
                indiceSeleccionado++;
                actualizarSeleccionVisual();
                /*
                // Actualizar OSD en tiempo real al bajar
                if (listaCanales.length > 0 && listaCanales[indiceSeleccionado]) {
                    var c = listaCanales[indiceSeleccionado];
                    mostrarOSD(indiceSeleccionado + 1, c.nombre, c.programa);
                }
                    */
            }
        }

        else if (keyCode === 13) {
            if (listaCanales[indiceSeleccionado]) {
                reproducirCanal(listaCanales[indiceSeleccionado].url);
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
// MOSTRAR/OCULTAR LISTA
// ======================================================

function mostrarLista() {
    var list = document.getElementById("channel-list");
    if (list) {
        list.classList.remove("hidden");
        listaVisible = true;

        if (osdTimeout) {
            clearTimeout(osdTimeout);
        }

        // Al abrir la lista, el OSD muestra la info del canal que SE ESTÁ REPRODUCIENDO, no el seleccionado
        if (listaCanales.length > 0 && listaCanales[indiceReproduciendo]) {
            var c = listaCanales[indiceReproduciendo];
            mostrarOSD(indiceReproduciendo + 1, c.nombre, c.programa);
        }
    }
}

function ocultarLista() {
    var list = document.getElementById("channel-list");
    if (list) {
        list.classList.add("hidden");
        listaVisible = false;

        // Al ocultar la lista, el OSD desaparece tras 4 segundos
        if (osdTimeout) {
            clearTimeout(osdTimeout);
        }
        osdTimeout = setTimeout(function () {
            var banner = document.getElementById("osd-banner");
            if (banner) {
                banner.classList.remove("show");
            }
        }, 4000);
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

    // El canal que el usuario seleccionó pasa a ser el canal activo en reproducción
    indiceReproduciendo = indiceSeleccionado;

    var canalActual = listaCanales[indiceReproduciendo];
    if (canalActual) {
        obtenerProgramaActualParaCanal(streamUrl);
    }

    // 1. Si es de Dailymotion...
    if (esDailymotion(streamUrl)) {
        var videoId = obtenerIdDailymotion(streamUrl);
        if (videoId) {
            obtenerStreamDailymotion(videoId);
            return;
        }
    }

    // 2. Si es M3U8 directo...
    lanzarAVPlay(streamUrl);
}
// ======================================================
// OSD
// ======================================================

function mostrarOSD(numeroCanal, nombreCanal, nombrePrograma) {
    var banner = document.getElementById("osd-banner");
    var numEl = document.getElementById("osd-number");
    var titleEl = document.getElementById("osd-title");
    var programEl = document.getElementById("osd-program");

    if (!banner || !numEl || !titleEl) {
        return;
    }

    var numFormateado = (numeroCanal < 10 ? "0" : "") + numeroCanal;

    numEl.innerText = numFormateado;
    titleEl.innerText = nombreCanal;

    if (programEl) {
        programEl.innerText = "" + (nombrePrograma || nombreCanal);
    }

    // Mostramos el banner
    banner.classList.add("show");

    if (osdTimeout) {
        clearTimeout(osdTimeout);
    }

    // CONDICIÓN: Si la lista está visible, el OSD se queda fijo. 
    // Si la lista está oculta, se oculta automáticamente tras 4 segundos.
    if (!listaVisible) {
        osdTimeout = setTimeout(function () {
            banner.classList.remove("show");
        }, 4000);
    }
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
    prepararAVPlay();

    var canalActual = listaCanales[indiceSeleccionado];
    var nombreCanal = canalActual ? canalActual.nombre : "Canal";

    // Mostramos el OSD inicial de inmediato con el nombre del canal
    mostrarOSD(indiceSeleccionado + 1, nombreCanal, "Cargando programa...");

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
                    console.log("Buffer listo. Esperando metadatos del stream...");
                    
                    // Simulación / Espera de metadatos reales del stream (como hace VLC a los pocos segundos)
                    setTimeout(function() {
                        // Si el canal tiene una descripción o programa real en la lista, úsalo; 
                        // de lo contrario, puedes extraer metadatos si el stream los emite.
                        if (canalActual && canalActual.programa && canalActual.programa !== canalActual.nombre) {
                            actualizarProgramaEnVivo(canalActual.programa);
                        } else {
                            // Si el flujo emitió información de programa tras conectar:
                            actualizarProgramaEnVivo(nombreCanal + " (En vivo)");
                        }
                    }, 30000); // Espera 3 segundos tal como lo hace VLC al sintonizar
                },
                onerror: function (error) {
                    console.error("Error en AVPlay:", error);
                }
            };

            webapis.avplay.setListener(listener);

            webapis.avplay.prepareAsync(
                function () {
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
        // Modo navegador web PC (HTML5 video)
        var videoElement = document.getElementById("htmlvideo");
        if (videoElement) {
            videoElement.src = urlFinal;
            videoElement.play().catch(function (err) {
                console.log("Interacción requerida:", err);
            });

            // Escuchar pistas de metadatos temporales (ID3 / Timed Metadata en HLS)
            videoElement.onloadedmetadata = function() {
                setTimeout(function() {
                    if (videoElement.textTracks && videoElement.textTracks.length > 0) {
                        for (var i = 0; i < videoElement.textTracks.length; i++) {
                            videoElement.textTracks[i].oncuechange = function(e) {
                                if (this.activeCues && this.activeCues.length > 0) {
                                    actualizarProgramaEnVivo(this.activeCues[0].text);
                                }
                            };
                        }
                    } else {
                        // Si no hay metadatos automáticos en el navegador, aplicamos el retardo de 3 segundos igual que VLC
                        actualizarProgramaEnVivo(canalActual.programa !== canalActual.nombre ? canalActual.programa : "Transmisión en curso");
                    }
                }, 30000);
            };
        }
    }
}
// ======================================================
// OBTENER STREAM DAILYMOTION COMPATIBLE CON 720P / TIZEN
// ======================================================

function obtenerStreamDailymotion(videoId) {
    if (!videoId) {
        console.error("ID de Dailymotion no válido.");
        return;
    }

    console.log("Procesando señal Dailymotion:", videoId);

    var metadataUrl = "https://www.dailymotion.com/player/metadata/video/" + videoId + "?t=" + new Date().getTime();

    fetch(metadataUrl, { cache: "no-store" })
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            var masterM3u8Url = null;

            // Extraer la URL principal de la respuesta de metadatos
            if (data && data.qualities && data.qualities.auto && data.qualities.auto.length > 0) {
                masterM3u8Url = data.qualities.auto[0].url;
            } else if (data && data.qualities) {
                var keys = Object.keys(data.qualities);
                for (var k = 0; k < keys.length; k++) {
                    var q = data.qualities[keys[k]];
                    if (Array.isArray(q) && q.length > 0 && q[0].url) {
                        masterM3u8Url = q[0].url;
                        break;
                    }
                }
            }

            if (!masterM3u8Url) {
                console.error("No se encontraron enlaces de video para el ID:", videoId);
                return;
            }

            // Descargar el manifiesto máster desde la TV para parsear la variante HLS adecuada
            return fetch(masterM3u8Url, { cache: "no-store" })
                .then(function (m3uRes) {
                    return m3uRes.text();
                })
                .then(function (m3uText) {
                    var lines = m3uText.split("\n");
                    var finalUrl = "";

                    // Buscar primero sub-variantes que contengan sec2(...) o URLs absolutas de CDN
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        
                        // Omitir líneas vacías y comentarios de M3U8
                        if (line.length === 0 || line.indexOf("#") === 0) {
                            continue;
                        }

                        if (line.indexOf("http") === 0 || line.indexOf("sec2(") !== -1) {
                            finalUrl = line;
                            // Preferir la variante con el token de seguridad activo
                            if (line.indexOf("sec2(") !== -1) {
                                break;
                            }
                        }
                    }

                    // Si no se encuentra variante interna, se utiliza la URL máster directa
                    if (!finalUrl) {
                        finalUrl = masterM3u8Url;
                    }

                    // Limpieza crítica para Tizen AVPlay: eliminar querystrings o fragmentos #cell=
                    if (finalUrl.indexOf("#") !== -1) {
                        finalUrl = finalUrl.split("#")[0];
                    }

                    console.log("URL resuelta para canal " + videoId + ":", finalUrl);
                    lanzarAVPlay(finalUrl);
                });
        })
        .catch(function (err) {
            console.error("Error al procesar el canal de Dailymotion:", err);
        });
}

// ======================================================
// ACTUALIZAR PROGRAMA EN VIVO (Corregido con índice activo)
// ======================================================

function actualizarProgramaEnVivo(nuevoPrograma) {
    if (!nuevoPrograma) return;

    // CORREGIDO: Usamos indiceReproduciendo en lugar de indiceSeleccionado
    if (listaCanales[indiceReproduciendo]) {
        listaCanales[indiceReproduciendo].programa = nuevoPrograma;
    }

    var programEl = document.getElementById("osd-program");
    if (programEl) {
        programEl.innerText = "" + nuevoPrograma;
    }

    console.log("Metadatos en vivo detectados:", nuevoPrograma);
}
// ======================================================
// CONSULTAR PROGRAMA ACTUAL AL SERVIDOR EPG (Con control de carrera)
// ======================================================

function obtenerProgramaActualParaCanal(urlCanal) {
    var requestId = ++currentEpgRequestId; // Asignamos un ID único a esta petición
    var canalTarget = indiceReproduciendo; // Guardamos el canal exacto de esta reproducción

    var urlServidorEPG = "https://proxy-dailymotion-tv.onrender.com/api/epg?url=" + encodeURIComponent(urlCanal);

    if (listaCanales[canalTarget]) {
        var canal = listaCanales[canalTarget];
        mostrarOSD(canalTarget + 1, canal.nombre, "Cargando programa...");
    }

    fetch(urlServidorEPG)
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            // SI EL USUARIO CAMBIÓ DE CANAL MIENTRAS CARGABA, DESCARTAMOS ESTA RESPUESTA
            if (requestId !== currentEpgRequestId) {
                return;
            }

            var nombrePrograma = (data && data.programa) ? data.programa : "Transmisión en vivo";
            
            if (listaCanales[canalTarget]) {
                listaCanales[canalTarget].programa = nombrePrograma;
                var canal = listaCanales[canalTarget];

                // Solo mostramos el OSD si el usuario sigue en este mismo canal
                if (canalTarget === indiceReproduciendo) {
                    mostrarOSD(canalTarget + 1, canal.nombre, nombrePrograma);
                }
            }
        })
        .catch(function (err) {
            if (requestId !== currentEpgRequestId) return;
            console.log("Error al consultar EPG:", err);
            if (listaCanales[canalTarget] && canalTarget === indiceReproduciendo) {
                var canal = listaCanales[canalTarget];
                mostrarOSD(canalTarget + 1, canal.nombre, "Transmisión en vivo");
            }
        });
}

async function cargarEPG(urlCanal) {
    try {
        const response = await fetch(`https://proxy-dailymotion-tv.onrender.com/api/epg?url=${encodeURIComponent(urlCanal)}`);
        const data = await response.json();
        // Actualizar el texto del OSD / cartel de información en la TV
        document.getElementById('info-programa').innerText = data.programa;
    } catch (error) {
        console.error("Error al cargar EPG:", error);
    }
}