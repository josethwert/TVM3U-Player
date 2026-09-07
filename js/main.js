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

window.onload = function () {
    inicializarReproductorHTML();
    registrarTeclasTizen();
    
    // 1. Cargar lista local
    cargarListaLocal();
    
    // 2. Sincronizar desde GitHub
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

            // Teclas de Zapping
            tizen.tvinputdevice.registerKey("ChannelUp");
            tizen.tvinputdevice.registerKey("ChannelDown");

            // Tecla Return / Back
            tizen.tvinputdevice.registerKey("Return");

            // NOTA: Las teclas VolumeUp, VolumeDown y VolumeMute NO se registran
            // para que el sistema operativo de Tizen maneje el volumen nativo directamente.
        }
    } catch (e) {
        console.log("No es un entorno Tizen nativo:", e);
    }
}

// Carga lista local
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

// Descarga desde GitHub
function sincronizarListaDesdeGitHub() {
    var timestamp = new Date().getTime();
    var urlFinal = URL_GITHUB_M3U + "?t=" + timestamp;

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

function procesarYActualizarLista(contenidoM3U, fuente) {
    var canalesNuevos = parsearM3U(contenidoM3U);

    if (canalesNuevos && canalesNuevos.length > 0) {
        listaCanales = canalesNuevos;
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
    console.log("Tecla presionada KeyCode:", keyCode);

    // --- 1. ZAPPING RÁPIDO (CH+ / CH-) ---
    if (keyCode === 427 || keyCode === 33) {
        cambiarCanalRelativo(1);
        e.preventDefault();
        return;
    } else if (keyCode === 428 || keyCode === 34) {
        cambiarCanalRelativo(-1);
        e.preventDefault();
        return;
    }

    // --- 2. BOTÓN RETURN TRIPLE PULSACIÓN (10009 / 27) ---
    if (keyCode === 10009) {
        if (!listaVisible) {
            manejadorSalidaTriplePulsacion();
        } else {
            ocultarLista();
        }
        return;
    }

    // --- 3. NAVEGACIÓN DENTRO DE LA LISTA VISIBLE ---
    if (listaVisible) {
        if (keyCode === 38) { // Arriba
            if (indiceSeleccionado > 0) {
                indiceSeleccionado--;
                actualizarSeleccionVisual();
            }
        } else if (keyCode === 40) { // Abajo
            if (indiceSeleccionado < listaCanales.length - 1) {
                indiceSeleccionado++;
                actualizarSeleccionVisual();
            }
        } else if (keyCode === 13) { // Enter / OK
            if (listaCanales[indiceSeleccionado]) {
                reproducirCanal(listaCanales[indiceSeleccionado].url);
                ocultarLista();
            }
        } else if (keyCode === 27) {
            ocultarLista();
        }
    } 
    // --- 4. SI LA LISTA ESTÁ OCULTA ---
    else {
        if (keyCode === 38 || keyCode === 40 || keyCode === 13 || keyCode === 27) {
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

function mostrarOSD(numeroCanal, nombreCanal) {
    var banner = document.getElementById("osd-banner");
    var numEl = document.getElementById("osd-number");
    var titleEl = document.getElementById("osd-title");

    if (!banner || !numEl || !titleEl) return;

    var numFormateado = (numeroCanal < 10 ? "0" : "") + numeroCanal;

    numEl.innerText = numFormateado;
    titleEl.innerText = nombreCanal;

    banner.classList.add("show");

    if (osdTimeout) {
        clearTimeout(osdTimeout);
    }

    osdTimeout = setTimeout(function () {
        banner.classList.remove("show");
    }, 4000);
}

function cambiarCanalRelativo(direccion) {
    if (listaCanales.length === 0) return;

    var nuevoIndice = indiceSeleccionado + direccion;

    if (nuevoIndice < 0) {
        nuevoIndice = listaCanales.length - 1;
    } else if (nuevoIndice >= listaCanales.length) {
        nuevoIndice = 0;
    }

    indiceSeleccionado = nuevoIndice;
    actualizarSeleccionVisual();
    reproducirCanal(listaCanales[indiceSeleccionado].url);
}

function manejadorSalidaTriplePulsacion() {
    contadorSalir++;

    clearTimeout(temporizadorSalir);
    temporizadorSalir = setTimeout(function () {
        contadorSalir = 0;
    }, 1500);

    if (contadorSalir === 1) {
        console.log("Presiona 2 veces más para salir.");
    } else if (contadorSalir === 2) {
        console.log("Presiona 1 vez más para salir.");
    } else if (contadorSalir >= 3) {
        console.log("Cerrando la aplicación...");
        if (window.tizen && window.tizen.application) {
            tizen.application.getCurrentApplication().exit();
        }
    }
}