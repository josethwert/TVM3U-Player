window.onload = function () {
    // URL de ejemplo de tu lista M3U
    var m3uUrl = "https://ejemplo.com/tu_lista.m3u";
    
    cargarListaM3U(m3uUrl);
};

// Cargar y parsear la lista M3U
function cargarListaM3U(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var canales = parsearM3U(xhr.responseText);
            renderizarCanales(canales);
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

// Mostrar los canales en pantalla
function renderizarCanales(canales) {
    var ul = document.getElementById("playlist");
    ul.innerHTML = "";

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

// Reproducir un flujo de video mediante AVPlay API de Tizen
function reproducirCanal(streamUrl) {
    try {
        webapis.avplay.stop();
        webapis.avplay.close();
        
        webapis.avplay.open(streamUrl);
        webapis.avplay.setDisplayRect(0, 0, 1920, 1080); // Ajusta según la resolución del TV
        
        var listener = {
            onbufferingstart: function () { console.log("Buffering..."); },
            onbufferingcomplete: function () { console.log("Buffering complete."); },
            onerror: function (error) { console.error("Error en AVPlay:", error); }
        };
        
        webapis.avplay.setListener(listener);
        webapis.avplay.prepare();
        webapis.avplay.play();
    } catch (e) {
        console.error("Excepción al intentar reproducir:", e);
    }
}