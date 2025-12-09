if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/AQMel_Painel/service-worker.js")
      .then(() => console.log("Service Worker registrado!"))
      .catch(err => console.error("Erro no SW:", err));
  });
}
