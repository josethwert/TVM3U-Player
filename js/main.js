window.onload = function () {
    // Ruta relativa a la lista M3U local dentro del proyecto
    var rutaListaLocal = "Lista/custom_url.m3u";
    
    cargarListaM3U(rutaListaLocal);
};

// Cargar la lista M3U (funciona tanto para archivos locales como para URLs http/https)
function cargarListaM3U(rutaArchivo) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", rutaArchivo, true);
    
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            // El código 200 aplica para HTTP/HTTPS y el código 0 para solicitudes de archivos locales (file:// / app://)
            if (xhr.status === 200 || xhr.status === 0) {
                var canales = parsearM3U(xhr.responseText);
                renderizarCanales(canales);
            } else {
                console.error("Error al cargar la lista M3U local. Estado:", xhr.status);
            }
        }
    };
    
    xhr.send();
}

// Convertir el texto M3U en un arreglo de objetos { nombre, url }
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

// Mostrar la lista en pantalla
function renderizarCanales(canales) {
    var ul = document.getElementById("playlist");
    if (!ul) return;
    
    ul.innerHTML = "";

    if (canales.length === 0) {
        ul.innerHTML = "<li style='padding:10px;'>No se encontraron canales en la lista local.</li>";
        return;
    }

    canales.forEach(function (canal) {
        var li = document.createElement("li");
        li.innerText = canal.nombre;
        li.style.padding = "10px";
        li.style.cursor = "pointer";
        
        li.onclick = function () {
            reproducirCanal(canal.url);
        };
        
        ul.appendChild(li);
    });
}

// Inicializar reproducción con AVPlay
function reproducirCanal(streamUrl) {
    try {
        if (typeof webapis !== "undefined" && webapis.avplay) {
            webapis.avplay.stop();
            webapis.avplay.close();
            
            webapis.avplay.open(streamUrl);
            webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
            
            var listener = {
                onbufferingstart: function () { console.log("Buffering..."); },
                onbufferingcomplete: function () { console.log("Buffering completado."); },
                onerror: function (error) { console.error("Error en AVPlay:", error); }
            };
            
            webapis.avplay.setListener(listener);
            webapis.avplay.prepare();
            webapis.avplay.play();
        } else {
            console.log("Simulación de reproducción en PC/Browser:", streamUrl);
        }
    } catch (e) {
        console.error("Error al ejecutar AVPlay:", e);
    }
}