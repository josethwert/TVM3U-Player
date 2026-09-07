var listaCanales = [];
var indiceSeleccionado = 0;
var listaVisible = true;

// URL directa al archivo M3U crudo (raw) en GitHub
var URL_GITHUB_M3U = "https://raw.githubusercontent.com/josethwert/TVM3U-Player/main/Lista/custom_url.m3u";
var RUTA_LOCAL_M3U = "Lista/custom_url.m3u";

window.onload = function () {
    inicializarReproductorHTML();
    registrarTeclasTizen();
    
    // 1. Cargar primero la lista local para garantizar un inicio rápido
    cargarListaLocal();
    
    // 2. Verificar e integrar automáticamente cambios desde GitHub
    sincronizarListaDesdeGitHub();
    
    document.addEventListener("keydown", manejarTeclado);
};

function inicializarReproductorHTML() {
    var wrapper = document.getElementById("media-player-wrapper");
    if (typeof webapis !== "undefined" && webapis.avplay) {
        wrapper.innerHTML = '<object id="avplayer" type="application/avplayer" style="width:100%; height:100%;"></object>';
    } else {
        wrapper.innerHTML = '<video id="htmlvideo" style="width:100%; height:100%; background:#000;" controls autoplay></video>';
    }
}

function registrarTeclasTizen() {
    try {
        if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
            // Teclas de reproducción
            tizen.tvinputdevice.registerKey("MediaPlay");
            tizen.tvinputdevice.registerKey("MediaStop");
            tizen.tvinputdevice.registerKey("MediaPause");

            // Registro de teclas de cambio de canal para Tizen OS
            tizen.tvinputdevice.registerKey("ChannelUp");
            tizen.tvinputdevice.registerKey("ChannelDown");
            
            // Alternativas específicas de algunos modelos Tizen
            try { tizen.tvinputdevice.registerKey("Up"); } catch(e){}
            try { tizen.tvinputdevice.registerKey("Down"); } catch(e){}
        }
    } catch (e) {
        console.log("No es un entorno Tizen nativo:", e);
    }
}

// Carga la lista M3U local empaquetada con la app
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

// Descarga la versión más reciente alojada en GitHub
// URL directa al archivo M3U crudo en GitHub
var URL_GITHUB_M3U = "https://raw.githubusercontent.com/josethwert/TVM3U-Player/main/Lista/custom_url.m3u";
// URL proxy de respaldo para evitar bloqueos CORS/SSL estrictos en Samsung Tizen
var URL_PROXY_M3U = "https://api.allorigins.win/raw?url=" + encodeURIComponent(URL_GITHUB_M3U);
var RUTA_LOCAL_M3U = "Lista/custom_url.m3u";

// Descarga la versión más reciente alojada en GitHub usando Fetch API / XMLHttpRequest
function sincronizarListaDesdeGitHub() {
    var timestamp = new Date().getTime();
    var urlFinal = URL_GITHUB_M3U + "?t=" + timestamp;

    console.log("Iniciando descarga desde GitHub...");

    // Intentar primero con la API fetch nativa de Tizen
    if (window.fetch) {
        fetch(urlFinal, { cache: "reload" })
            .then(function (response) {
                if (!response.ok) throw new Error("HTTP Status " + response.status);
                return response.text();
            })
            .then(function (data) {
                procesarYActualizarLista(data, "GitHub Directo (Fetch)");
            })
            .catch(function (err) {
                console.warn("Falló Fetch directo. Intentando vía Proxy CORS:", err);
                descargarViaProxy(timestamp);
            });
    } else {
        descargarViaXHR(urlFinal, timestamp);
    }
}

// Respaldo vía Proxy CORS si el TV bloquea la conexión SSL directa con GitHub
function descargarViaProxy(timestamp) {
    var urlProxy = URL_PROXY_M3U + "&t=" + timestamp;
    
    if (window.fetch) {
        fetch(urlProxy, { cache: "no-store" })
            .then(function (res) { return res.text(); })
            .then(function (data) {
                procesarYActualizarLista(data, "GitHub vía Proxy");
            })
            .catch(function (e) {
                console.error("Error definitivo al descargar desde GitHub:", e);
            });
    } else {
        descargarViaXHR(urlProxy, timestamp);
    }
}

// Respaldo XHR clásico con cabeceras estrictas
function descargarViaXHR(targetUrl, timestamp) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", targetUrl, true);
    xhr.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    xhr.setRequestHeader("Pragma", "no-cache");
    xhr.setRequestHeader("Expires", "0");

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200 && xhr.responseText) {
                procesarYActualizarLista(xhr.responseText, "GitHub (XHR)");
            } else {
                console.warn("Error XHR TV Status:", xhr.status);
            }
        }
    };
    xhr.send();
}

// Función encargada de parsear y refrescar la UI en la pantalla del TV
function procesarYActualizarLista(contenidoM3U, fuente) {
    var canalesNuevos = parsearM3U(contenidoM3U);

    if (canalesNuevos && canalesNuevos.length > 0) {
        listaCanales = canalesNuevos;
        
        // Si el índice supera el nuevo tamaño de la lista, se ajusta a 0
        if (indiceSeleccionado >= listaCanales.length) {
            indiceSeleccionado = 0;
        }

        renderizarCanales(listaCanales);
        actualizarSeleccionVisual();
        console.log("¡Lista actualizada con éxito en la TV desde: " + fuente + "!");
    } else {
        console.warn("La lista descargada desde " + fuente + " estaba vacía o con formato inválido.");
    }
}
function parsearM3U(m3uContent) {
    var lineas = m3uContent.split('\n');
    var canales = [];
    var nombreActual = "";

    for (var i = 0; i < lineas.length; i++) {
        var linea = lineas[i].trim();
        
        if (linea.startsWith("#EXTINF:")) {
            var partes = linea.split(',');
            nombreActual = partes.slice(1).join(',').trim();
        } else if (linea.length > 0 && !linea.startsWith("#")) {
            canales.push({
                nombre: nombreActual || "Canal " + (canales.length + 1),
                url: linea
            });
            nombreActual = "";
        }
    }
    return canales;
}

function renderizarCanales(canales) {
    var ul = document.getElementById("playlist");
    if (!ul) return;
    
    ul.innerHTML = "";

    if (canales.length === 0) {
        ul.innerHTML = "<li style='padding:10px;'>No se encontraron canales.</li>";
        return;
    }

    canales.forEach(function (canal, index) {
        var li = document.createElement("li");
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

function manejarTeclado(e) {
    var keyCode = e.keyCode;
    
    // Imprimir en consola para depurar cuál keyCode está enviando tu control remoto
    console.log("Tecla presionada KeyCode:", keyCode);

    // --- 1. ZAPPING RÁPIDO (CH+ / CH-) ---
    // Detecta 427 (ChannelUp nativo), 33 (PageUp/CH+ en algunos modelos)
    if (keyCode === 427 || keyCode === 33) {
        cambiarCanalRelativo(1); // Canal siguiente
        e.preventDefault();
        return;
    }
    // Detecta 428 (ChannelDown nativo), 34 (PageDown/CH- en algunos modelos)
    else if (keyCode === 428 || keyCode === 34) {
        cambiarCanalRelativo(-1); // Canal anterior
        e.preventDefault();
        return;
    }

    // --- 2. CONTROL DE VOLUMEN ---
    if (keyCode === 447 || keyCode === 107) { // VolumeUp
        ajustarVolumen(5);
        return;
    } else if (keyCode === 448 || keyCode === 109) { // VolumeDown
        ajustarVolumen(-5);
        return;
    }

    // --- 3. NAVEGACIÓN DENTRO DE LA LISTA VISIBLE ---
    if (listaVisible) {
        // Arriba (38)
        if (keyCode === 38) {
            if (indiceSeleccionado > 0) {
                indiceSeleccionado--;
                actualizarSeleccionVisual();
            }
        }
        // Abajo (40)
        else if (keyCode === 40) {
            if (indiceSeleccionado < listaCanales.length - 1) {
                indiceSeleccionado++;
                actualizarSeleccionVisual();
            }
        }
        // Enter / OK (13)
        else if (keyCode === 13) {
            if (listaCanales[indiceSeleccionado]) {
                reproducirCanal(listaCanales[indiceSeleccionado].url);
                ocultarLista();
            }
        }
        // Return / Back (10009 o 27)
        else if (keyCode === 10009 || keyCode === 27) {
            ocultarLista();
        }
    } 
    // --- 4. SI LA LISTA ESTÁ OCULTA ---
    else {
        // Al presionar Arriba, Abajo, Enter o Return con la lista oculta, se despliega
        if (keyCode === 38 || keyCode === 40 || keyCode === 13 || keyCode === 10009 || keyCode === 27) {
            mostrarLista();
        }
    }
}

function ocultarLista() {
    var list = document.getElementById("channel-list");
    if (list) {
        list.classList.add("hidden");
        listaVisible = false;
    }
}

function mostrarLista() {
    var list = document.getElementById("channel-list");
    if (list) {
        list.classList.remove("hidden");
        listaVisible = true;
    }
}

function actualizarSeleccionVisual() {
    var elementos = document.querySelectorAll("#playlist li");
    elementos.forEach(function (el, idx) {
        if (idx === indiceSeleccionado) {
            el.classList.add("selected");
            el.scrollIntoView({ block: "nearest" });
        } else {
            el.classList.remove("selected");
        }
    });
}

function reproducirCanal(streamUrl) {
    console.log("Reproduciendo:", streamUrl);
    
    // Obtener los datos del canal actual
    var canalActual = listaCanales[indiceSeleccionado];
    if (canalActual) {
        mostrarOSD(indiceSeleccionado + 1, canalActual.nombre);
    }
    
    if (typeof webapis !== "undefined" && webapis.avplay) {
        try {
            webapis.avplay.stop();
            webapis.avplay.close();
            
            webapis.avplay.open(streamUrl);
            webapis.avplay.setDisplayRect(0, 0, window.innerWidth || 1920, window.innerHeight || 1080);
            
            var listener = {
                onbufferingstart: function () { console.log("Buffering..."); },
                onbufferingcomplete: function () { console.log("Buffering completado."); },
                onerror: function (error) { console.error("Error en AVPlay:", error); }
            };
            
            webapis.avplay.setListener(listener);
            webapis.avplay.prepareAsync(function () {
                webapis.avplay.play();
            }, function (err) {
                console.error("Error en prepareAsync:", err);
            });
        } catch (e) {
            console.error("Excepción en AVPlay:", e);
        }
    } else {
        var videoElement = document.getElementById("htmlvideo");
        if (videoElement) {
            videoElement.src = streamUrl;
            videoElement.play().catch(function(err) {
                console.log("El navegador requiere interacción previa:", err);
            });
        }
    }
}
var osdTimeout = null;

// Función para mostrar el OSD con el canal activo
function mostrarOSD(numeroCanal, nombreCanal) {
    var banner = document.getElementById("osd-banner");
    var numEl = document.getElementById("osd-number");
    var titleEl = document.getElementById("osd-title");

    if (!banner || !numEl || !titleEl) return;

    // Formatear el número de canal con ceros a la izquierda (ej. 01, 02)
    var numFormateado = (numeroCanal < 10 ? "0" : "") + numeroCanal;

    numEl.innerText = numFormateado;
    titleEl.innerText = nombreCanal;

    // Mostrar el banner
    banner.classList.add("show");

    // Reiniciar el temporizador si ya había uno activo
    if (osdTimeout) {
        clearTimeout(osdTimeout);
    }

    // Ocultar automáticamente después de 4000 ms (4 segundos)
    osdTimeout = setTimeout(function () {
        banner.classList.remove("show");
    }, 4000);
}

function registrarTeclasTizen() {
    try {
        if (typeof tizen !== "undefined" && tizen.tvinputdevice) {
            // Teclas de reproducción
            tizen.tvinputdevice.registerKey("MediaPlay");
            tizen.tvinputdevice.registerKey("MediaStop");
            tizen.tvinputdevice.registerKey("MediaPause");

            // Teclas de Zapping (Canal Arriba / Abajo)
            tizen.tvinputdevice.registerKey("ChannelUp");
            tizen.tvinputdevice.registerKey("ChannelDown");

            // Teclas de Volumen (Opcional si usas el control nativo del TV, 
            // pero necesario si manejas el volumen internamente por AVPlay)
            tizen.tvinputdevice.registerKey("VolumeUp");
            tizen.tvinputdevice.registerKey("VolumeDown");
            tizen.tvinputdevice.registerKey("VolumeMute");
        }
    } catch (e) {
        console.log("No es un entorno Tizen nativo:", e);
    }
}

// Función para cambiar de canal directamente sin abrir el menú
function cambiarCanalRelativo(direccion) {
    if (listaCanales.length === 0) return;

    var nuevoIndice = indiceSeleccionado + direccion;

    // Controlar límites (ciclar la lista si llega al final)
    if (nuevoIndice < 0) {
        nuevoIndice = listaCanales.length - 1;
    } else if (nuevoIndice >= listaCanales.length) {
        nuevoIndice = 0;
    }

    indiceSeleccionado = nuevoIndice;
    actualizarSeleccionVisual();
    
    // Reproduce el nuevo canal y dispara el banner OSD automáticamente
    reproducirCanal(listaCanales[indiceSeleccionado].url);
}

// Control interno de volumen con la API de AVPlay
function ajustarVolumen(delta) {
    if (typeof webapis !== "undefined" && webapis.avplay) {
        try {
            var nivelActual = webapis.avplay.getVolume();
            var nuevoNivel = nivelActual + delta;

            if (nuevoNivel > 100) nuevoNivel = 100;
            if (nuevoNivel < 0) nuevoNivel = 0;

            webapis.avplay.setVolume(nuevoNivel);
            console.log("Volumen actual:", nuevoNivel);
        } catch (e) {
            console.error("Error al ajustar volumen:", e);
        }
    }
}