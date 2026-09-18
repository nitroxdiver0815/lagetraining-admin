(() => {
  "use strict";

  const config = window.LAGETRAINING_ADMIN_CONFIG;
  const elements = {
    signInButton: document.querySelector("#signInButton"),
    vehicleSelect: document.querySelector("#vehicleSelect"),
    locationSelect: document.querySelector("#locationSelect"),
    assignButton: document.querySelector("#assignButton"),
    reloadButton: document.querySelector("#reloadButton"),
    currentAssignment: document.querySelector("#currentAssignment"),
    status: document.querySelector("#status")
  };

  let arcgisRequest;
  let identityManager;
  let credential;
  let vehicles = [];
  let locations = [];

  function setStatus(message, type = "") {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`.trim();
  }

  function validateConfig() {
    const missing = [];

    if (!config) {
      throw new Error("Die Datei config.js wurde nicht geladen.");
    }

    if (!config.oauthAppId || config.oauthAppId.startsWith("HIER_")) {
      missing.push("oauthAppId");
    }

    if (!config.featureServiceUrl || config.featureServiceUrl.startsWith("HIER_")) {
      missing.push("featureServiceUrl");
    }

    if (missing.length) {
      throw new Error(
        `Konfiguration unvollständig: ${missing.join(", ")} in public/config.js eintragen.`
      );
    }
  }

  function layerUrl(layerId) {
    return `${config.featureServiceUrl.replace(/\/$/, "")}/${layerId}`;
  }

  function normalizeGuid(value) {
    return String(value || "")
      .replace(/[{}]/g, "")
      .trim()
      .toLowerCase();
  }

  function displayValue(attributes, candidates, fallback) {
    for (const fieldName of candidates) {
      const value = attributes[fieldName];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return fallback;
  }

  function fillSelect(select, records, valueField, labelFields, emptyLabel) {
    select.replaceChildren(new Option(emptyLabel, ""));

    records
      .map((feature) => ({
        value: feature.attributes[valueField],
        label: displayValue(
          feature.attributes,
          labelFields,
          String(feature.attributes[valueField] || "Unbenannter Datensatz")
        )
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "de"))
      .forEach((entry) => select.add(new Option(entry.label, entry.value)));

    select.disabled = false;
  }

  async function queryLayer(url, where = "1=1") {
    const response = await arcgisRequest(`${url}/query`, {
      method: "post",
      query: {
        f: "json",
        token: credential.token,
        where,
        outFields: "*",
        returnGeometry: false
      },
      responseType: "json"
    });

    return response.data.features || [];
  }

  function sqlLiteral(value) {
    if (typeof value === "number") {
      return String(value);
    }

    return `'${String(value).replace(/'/g, "''")}'`;
  }

  async function loadData() {
    setStatus("Fahrzeuge und Wachen werden geladen …");
    elements.assignButton.disabled = true;
    elements.reloadButton.disabled = true;

    const stationWhere =
      `${config.fields.locationType} = ${sqlLiteral(config.fireStationTypeCode)}`;

    [vehicles, locations] = await Promise.all([
      queryLayer(layerUrl(config.layers.vehicles)),
      queryLayer(layerUrl(config.layers.locations), stationWhere)
    ]);

    fillSelect(
      elements.vehicleSelect,
      vehicles,
      config.fields.objectId,
      config.labels.vehicle,
      "Fahrzeug auswählen"
    );

    fillSelect(
      elements.locationSelect,
      locations,
      config.fields.globalId,
      config.labels.location,
      "Heimatwache auswählen"
    );

    elements.reloadButton.disabled = false;
    updateSelectionState();
    setStatus(
      `${vehicles.length} Fahrzeuge und ${locations.length} Feuerwachen geladen.`,
      "success"
    );
  }

  function selectedVehicle() {
    const selectedObjectId = elements.vehicleSelect.value;

    return vehicles.find(
      (feature) =>
        String(feature.attributes[config.fields.objectId]) === selectedObjectId
    );
  }

  function selectedLocation() {
    const selectedGuid = normalizeGuid(elements.locationSelect.value);

    return locations.find(
      (feature) =>
        normalizeGuid(feature.attributes[config.fields.globalId]) === selectedGuid
    );
  }

  function updateSelectionState() {
    const vehicle = selectedVehicle();
    const location = selectedLocation();

    elements.assignButton.disabled = !(vehicle && location);

    if (!vehicle) {
      elements.currentAssignment.hidden = true;
      return;
    }

    const homeLocationId =
      vehicle.attributes[config.fields.vehicleHomeLocationId];
    const currentLocation = locations.find(
      (feature) =>
        normalizeGuid(feature.attributes[config.fields.globalId]) ===
        normalizeGuid(homeLocationId)
    );

    const currentLabel = currentLocation
      ? displayValue(
          currentLocation.attributes,
          config.labels.location,
          homeLocationId
        )
      : homeLocationId
        ? `Unbekannte Location (${homeLocationId})`
        : "Noch keine Heimatwache zugeordnet";

    elements.currentAssignment.textContent =
      `Aktuelle Zuordnung: ${currentLabel}`;
    elements.currentAssignment.hidden = false;

    if (currentLocation && !elements.locationSelect.value) {
      elements.locationSelect.value =
        currentLocation.attributes[config.fields.globalId];
      elements.assignButton.disabled = false;
    }
  }

  async function assignHomeLocation() {
    const vehicle = selectedVehicle();
    const location = selectedLocation();

    if (!vehicle || !location) {
      setStatus("Bitte Fahrzeug und Heimatwache auswählen.", "error");
      return;
    }

    elements.assignButton.disabled = true;
    setStatus("Zuordnung wird gespeichert …");

    const attributes = {
      [config.fields.objectId]:
        vehicle.attributes[config.fields.objectId],
      [config.fields.vehicleHomeLocationId]:
        location.attributes[config.fields.globalId]
    };

    const response = await arcgisRequest(
      `${layerUrl(config.layers.vehicles)}/applyEdits`,
      {
        method: "post",
        query: {
          f: "json",
          token: credential.token,
          updates: JSON.stringify([{ attributes }]),
          rollbackOnFailure: true
        },
        responseType: "json"
      }
    );

    const result = response.data.updateResults?.[0];

    if (!result?.success) {
      const message =
        result?.error?.description ||
        result?.error?.message ||
        "Die Zuordnung konnte nicht gespeichert werden.";
      throw new Error(message);
    }

    vehicle.attributes[config.fields.vehicleHomeLocationId] =
      location.attributes[config.fields.globalId];

    updateSelectionState();
    setStatus("Heimatwache wurde erfolgreich zugeordnet.", "success");
  }

  async function signIn() {
    try {
      validateConfig();
      setStatus("ArcGIS-Anmeldung wird geöffnet …");
      credential = await identityManager.getCredential(
        `${config.portalUrl.replace(/\/$/, "")}/sharing`
      );
      elements.signInButton.textContent = "Angemeldet";
      elements.signInButton.disabled = true;
      await loadData();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Anmeldung fehlgeschlagen.", "error");
    }
  }

  function initialize() {
    require(
      ["esri/request", "esri/identity/IdentityManager", "esri/identity/OAuthInfo"],
      (request, IdentityManager, OAuthInfo) => {
        arcgisRequest = request;
        identityManager = IdentityManager;

        try {
          validateConfig();

          const info = new OAuthInfo({
            appId: config.oauthAppId,
            portalUrl: config.portalUrl,
            popup: true
          });

          identityManager.registerOAuthInfos([info]);
          elements.signInButton.addEventListener("click", signIn);
          elements.reloadButton.addEventListener("click", () => {
            loadData().catch((error) => {
              console.error(error);
              setStatus(error.message || "Daten konnten nicht geladen werden.", "error");
            });
          });
          elements.vehicleSelect.addEventListener("change", updateSelectionState);
          elements.locationSelect.addEventListener("change", updateSelectionState);
          elements.assignButton.addEventListener("click", () => {
            assignHomeLocation().catch((error) => {
              console.error(error);
              setStatus(error.message || "Speichern fehlgeschlagen.", "error");
              updateSelectionState();
            });
          });

          identityManager
            .checkSignInStatus(
              `${config.portalUrl.replace(/\/$/, "")}/sharing`
            )
            .then((existingCredential) => {
              credential = existingCredential;
              elements.signInButton.textContent = "Angemeldet";
              elements.signInButton.disabled = true;
              return loadData();
            })
            .catch(() => {
              setStatus("Bitte mit dem ArcGIS-Trainerkonto anmelden.");
            });
        } catch (error) {
          console.error(error);
          setStatus(error.message, "error");
          elements.signInButton.disabled = true;
        }
      }
    );
  }

  initialize();
})();
