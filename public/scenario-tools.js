(() => {
  "use strict";

  const config = window.LAGETRAINING_ADMIN_CONFIG;
  const tool = document.documentElement.dataset.tool;
  const byId = (id) => document.getElementById(id);
  const signInButton = byId("signInButton");
  const scenarioSelect = byId("scenarioSelect");
  const saveButton = byId("saveButton");
  const statusElement = byId("status");
  const requestedScenarioId = new URLSearchParams(location.search).get("scenario_id");

  let arcgisRequest;
  let identityManager;
  let credential;
  let scenarios = [];
  let locations = [];
  let vehicles = [];
  let abekRecords = [];
  let assignments = [];
  let dispatchRecord = null;

  function setStatus(message, type = "") {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`.trim();
  }

  function validateConfig() {
    if (!config?.oauthAppId || !config?.featureServiceUrl) {
      throw new Error("Die Anwendungskonfiguration ist unvollständig.");
    }
  }

  function serviceLayerUrl(layerId, serviceUrl = config.featureServiceUrl) {
    return `${serviceUrl.replace(/\/$/, "")}/${layerId}`;
  }

  function normalizeGuid(value) {
    return String(value || "").replace(/[{}]/g, "").trim().toLowerCase();
  }

  function guidSql(value) {
    return `'{${normalizeGuid(value)}}'`;
  }

  function validatedGuid(value) {
    const normalized = normalizeGuid(value);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
      throw new Error(`Ungültige GUID: ${value || "(leer)"}`);
    }
    return normalized;
  }

  function editErrorMessage(prefix, error, attributes) {
    const serverMessage = [
      error?.description,
      error?.message,
      ...(Array.isArray(error?.details) ? error.details : [])
    ].filter(Boolean).join(" | ") || "Unbekannter ArcGIS-Fehler";
    return `${prefix}: ${serverMessage} ` +
      `(scenario_id=${attributes.scenario_id}, ` +
      `initial_abek_id=${attributes.initial_abek_id})`;
  }

  function requestErrorMessage(prefix, error, attributes) {
    const details = [
      error?.message,
      error?.details?.message,
      error?.details?.raw?.message,
      ...(Array.isArray(error?.details?.raw?.details)
        ? error.details.raw.details
        : [])
    ].filter(Boolean).join(" | ") || "Unbekannter Anfragefehler";
    return `${prefix}: ${details} ` +
      `(scenario_id=${attributes.scenario_id}, ` +
      `initial_abek_id=${attributes.initial_abek_id})`;
  }

  function sqlLiteral(value) {
    if (typeof value === "number") return String(value);
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  function labelFor(attributes, fields, fallback = "Unbenannter Datensatz") {
    for (const field of fields) {
      const value = attributes[field];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
    return fallback;
  }

  function attributeValue(attributes, fieldName) {
    if (Object.prototype.hasOwnProperty.call(attributes, fieldName)) {
      return attributes[fieldName];
    }
    const matchingKey = Object.keys(attributes).find(
      (key) => key.toLowerCase() === fieldName.toLowerCase()
    );
    return matchingKey ? attributes[matchingKey] : undefined;
  }

  function combinedLabel(attributes, fields) {
    const values = fields
      .map((field) => attributes[field])
      .filter((value) => value !== null && value !== undefined && String(value).trim())
      .map((value) => String(value).trim());
    return values.join(" · ") || "Unbenannter Datensatz";
  }

  async function queryLayer(layerId, where = "1=1", serviceUrl) {
    const features = [];
    const pageSize = 2000;
    let resultOffset = 0;
    let exceededTransferLimit;

    do {
      const response = await arcgisRequest(
        `${serviceLayerUrl(layerId, serviceUrl)}/query`,
        {
          method: "post",
          query: {
            f: "json",
            token: credential.token,
            where,
            outFields: "*",
            returnGeometry: false,
            orderByFields: "OBJECTID",
            resultOffset,
            resultRecordCount: pageSize
          },
          responseType: "json"
        }
      );

      const page = response.data.features || [];
      features.push(...page);
      resultOffset += page.length;
      exceededTransferLimit = response.data.exceededTransferLimit === true;

      if (exceededTransferLimit && page.length === 0) {
        throw new Error("ArcGIS meldet weitere Datensätze, liefert aber keine Folgeseite.");
      }
    } while (exceededTransferLimit);

    return features;
  }

  async function applyEdits(layerId, edits) {
    const response = await arcgisRequest(
      `${serviceLayerUrl(layerId)}/applyEdits`,
      {
        method: "post",
        query: {
          f: "json",
          token: credential.token,
          rollbackOnFailure: true,
          ...edits
        },
        responseType: "json"
      }
    );
    return response.data;
  }

  function fillSelect(select, records, valueField, labelFactory, emptyLabel) {
    select.replaceChildren(new Option(emptyLabel, ""));
    records
      .map((feature) => ({
        value: feature.attributes[valueField],
        label: labelFactory(feature.attributes)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"))
      .forEach((item) => select.add(new Option(item.label, item.value)));
    select.disabled = false;
  }

  function featureByGuid(records, field, guid) {
    const normalized = normalizeGuid(guid);
    return records.find(
      (feature) => normalizeGuid(feature.attributes[field]) === normalized
    );
  }

  function configureScenarioSelect() {
    fillSelect(
      scenarioSelect,
      scenarios,
      config.fields.globalId,
      (attributes) => combinedLabel(attributes, config.labels.scenario),
      "Szenario auswählen"
    );

    if (requestedScenarioId) {
      const scenario = featureByGuid(
        scenarios,
        config.fields.globalId,
        requestedScenarioId
      );
      if (scenario) {
        scenarioSelect.value = scenario.attributes[config.fields.globalId];
        scenarioSelect.disabled = true;
      }
    }
  }

  function selectedScenarioId() {
    return scenarioSelect.value;
  }

  function renderEmpty(container, text) {
    container.innerHTML = "";
    const element = document.createElement("p");
    element.className = "empty";
    element.textContent = text;
    container.append(element);
  }

  function createAssignmentRow(title, detail, objectId, onDelete) {
    const row = document.createElement("div");
    row.className = "assignment";

    const text = document.createElement("div");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = title;
    span.textContent = detail;
    text.append(strong, span);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "danger";
    button.textContent = "Zuordnung entfernen";
    button.addEventListener("click", () => onDelete(objectId));

    row.append(text, button);
    return row;
  }

  async function loadBaseData() {
    scenarios = await queryLayer(config.layers.scenarioTemplates);
    configureScenarioSelect();
  }

  async function initializeLocationsTool() {
    locations = await queryLayer(config.layers.locations);
    fillSelect(
      byId("locationSelect"),
      locations,
      config.fields.globalId,
      (attributes) => combinedLabel(attributes, config.labels.location),
      "Ort auswählen"
    );

    scenarioSelect.addEventListener("change", loadLocationAssignments);
    saveButton.addEventListener("click", saveLocationAssignment);
    await loadLocationAssignments();
  }

  async function loadLocationAssignments() {
    const scenarioId = selectedScenarioId();
    saveButton.disabled = !scenarioId;
    assignments = [];

    if (!scenarioId) {
      renderEmpty(byId("assignmentList"), "Bitte zuerst ein Szenario auswählen.");
      return;
    }

    assignments = await queryLayer(
      config.layers.scenarioLocations,
      `scenario_id = ${guidSql(scenarioId)}`
    );

    const container = byId("assignmentList");
    container.innerHTML = "";

    if (!assignments.length) {
      renderEmpty(container, "Noch keine Orte zugeordnet.");
      return;
    }

    assignments.forEach((assignment) => {
      const attributes = assignment.attributes;
      const locationFeature = featureByGuid(
        locations,
        config.fields.globalId,
        attributes.location_id
      );
      const title = locationFeature
        ? combinedLabel(locationFeature.attributes, config.labels.location)
        : `Unbekannter Ort (${attributes.location_id})`;
      const detail =
        `Rolle: ${attributes.location_role}` +
        (attributes.is_primary === 1 ? " · Primärer Ort" : "");

      container.append(
        createAssignmentRow(
          title,
          detail,
          attributes[config.fields.objectId],
          deleteLocationAssignment
        )
      );
    });
  }

  async function saveLocationAssignment() {
    const scenarioId = selectedScenarioId();
    const locationId = byId("locationSelect").value;

    if (!scenarioId || !locationId) {
      setStatus("Bitte Szenario und Ort auswählen.", "error");
      return;
    }

    const duplicate = assignments.some(
      (feature) =>
        normalizeGuid(feature.attributes.location_id) === normalizeGuid(locationId) &&
        feature.attributes.location_role === byId("locationRole").value
    );

    if (duplicate) {
      setStatus("Diese Ortszuordnung ist bereits vorhanden.", "error");
      return;
    }

    saveButton.disabled = true;
    setStatus("Ortszuordnung wird gespeichert …");

    const attributes = {
      scenario_id: scenarioId,
      location_id: locationId,
      location_role: byId("locationRole").value,
      display_order: byId("displayOrder").value
        ? Number(byId("displayOrder").value)
        : null,
      is_primary: Number(byId("locationPrimary").value),
      scenario_notes: byId("locationNotes").value.trim() || null
    };

    const result = await applyEdits(config.layers.scenarioLocations, {
      adds: JSON.stringify([{ attributes }])
    });
    const addResult = result.addResults?.[0];

    if (!addResult?.success) {
      throw new Error(addResult?.error?.description || "Speichern fehlgeschlagen.");
    }

    setStatus("Ort wurde dem Szenario zugeordnet.", "success");
    await loadLocationAssignments();
  }

  async function deleteLocationAssignment(objectId) {
    if (!confirm("Diese Ortszuordnung wirklich entfernen?")) return;
    const result = await applyEdits(config.layers.scenarioLocations, {
      deletes: String(objectId)
    });
    if (!result.deleteResults?.[0]?.success) {
      throw new Error(
        result.deleteResults?.[0]?.error?.description || "Löschen fehlgeschlagen."
      );
    }
    setStatus("Ortszuordnung wurde entfernt.", "success");
    await loadLocationAssignments();
  }

  async function initializeVehiclesTool() {
    [vehicles, locations] = await Promise.all([
      queryLayer(config.layers.vehicles),
      queryLayer(
        config.layers.locations,
        `${config.fields.locationType} = ${sqlLiteral(config.fireStationTypeCode)}`
      )
    ]);

    fillSelect(
      byId("vehicleSelect"),
      vehicles,
      config.fields.globalId,
      (attributes) => combinedLabel(attributes, config.labels.vehicle),
      "Fahrzeug auswählen"
    );

    fillSelect(
      byId("startLocationSelect"),
      locations,
      config.fields.globalId,
      (attributes) => combinedLabel(attributes, config.labels.location),
      "Startwache auswählen"
    );

    byId("vehicleSelect").addEventListener("change", preselectHomeLocation);
    scenarioSelect.addEventListener("change", loadVehicleAssignments);
    saveButton.addEventListener("click", saveVehicleAssignment);
    await loadVehicleAssignments();
  }

  function preselectHomeLocation() {
    const vehicle = featureByGuid(
      vehicles,
      config.fields.globalId,
      byId("vehicleSelect").value
    );
    const homeId = vehicle?.attributes[config.fields.vehicleHomeLocationId];
    const station = featureByGuid(locations, config.fields.globalId, homeId);
    if (station) {
      byId("startLocationSelect").value =
        station.attributes[config.fields.globalId];
    }
  }

  async function loadVehicleAssignments() {
    const scenarioId = selectedScenarioId();
    saveButton.disabled = !scenarioId;
    assignments = [];

    if (!scenarioId) {
      renderEmpty(byId("assignmentList"), "Bitte zuerst ein Szenario auswählen.");
      return;
    }

    assignments = await queryLayer(
      config.layers.scenarioVehicles,
      `scenario_id = ${guidSql(scenarioId)}`
    );

    const container = byId("assignmentList");
    container.innerHTML = "";

    if (!assignments.length) {
      renderEmpty(container, "Noch keine Fahrzeuge zugeordnet.");
      return;
    }

    assignments.forEach((assignment) => {
      const attributes = assignment.attributes;
      const vehicle = featureByGuid(
        vehicles,
        config.fields.globalId,
        attributes.vehicle_id
      );
      const station = featureByGuid(
        locations,
        config.fields.globalId,
        attributes.start_location_id
      );
      const title = vehicle
        ? combinedLabel(vehicle.attributes, config.labels.vehicle)
        : `Unbekanntes Fahrzeug (${attributes.vehicle_id})`;
      const stationName = station
        ? combinedLabel(station.attributes, config.labels.location)
        : "Startwache unbekannt";
      const detail =
        `Start: ${stationName}` +
        (attributes.crew_configuration
          ? ` · Besatzung: ${attributes.crew_configuration}`
          : "");

      container.append(
        createAssignmentRow(
          title,
          detail,
          attributes[config.fields.objectId],
          deleteVehicleAssignment
        )
      );
    });
  }

  async function saveVehicleAssignment() {
    const scenarioId = selectedScenarioId();
    const vehicleId = byId("vehicleSelect").value;
    const startLocationId = byId("startLocationSelect").value;

    if (!scenarioId || !vehicleId || !startLocationId) {
      setStatus("Bitte Szenario, Fahrzeug und Startwache auswählen.", "error");
      return;
    }

    const duplicate = assignments.some(
      (feature) =>
        normalizeGuid(feature.attributes.vehicle_id) === normalizeGuid(vehicleId)
    );

    if (duplicate) {
      setStatus("Dieses Fahrzeug ist dem Szenario bereits zugeordnet.", "error");
      return;
    }

    saveButton.disabled = true;
    setStatus("Fahrzeugzuordnung wird gespeichert …");

    const attributes = {
      scenario_id: scenarioId,
      vehicle_id: vehicleId,
      start_location_id: startLocationId,
      crew_configuration: byId("crewConfiguration").value.trim() || null,
      dispatch_order: byId("dispatchOrder").value
        ? Number(byId("dispatchOrder").value)
        : null,
      is_primary: Number(byId("vehiclePrimary").value),
      scenario_notes: byId("vehicleNotes").value.trim() || null
    };

    const result = await applyEdits(config.layers.scenarioVehicles, {
      adds: JSON.stringify([{ attributes }])
    });
    const addResult = result.addResults?.[0];

    if (!addResult?.success) {
      throw new Error(addResult?.error?.description || "Speichern fehlgeschlagen.");
    }

    setStatus("Fahrzeug wurde dem Szenario zugeordnet.", "success");
    await loadVehicleAssignments();
  }

  async function deleteVehicleAssignment(objectId) {
    if (!confirm("Diese Fahrzeugzuordnung wirklich entfernen?")) return;
    const result = await applyEdits(config.layers.scenarioVehicles, {
      deletes: String(objectId)
    });
    if (!result.deleteResults?.[0]?.success) {
      throw new Error(
        result.deleteResults?.[0]?.error?.description || "Löschen fehlgeschlagen."
      );
    }
    setStatus("Fahrzeugzuordnung wurde entfernt.", "success");
    await loadVehicleAssignments();
  }

  function abekLabel(attributes) {
    return combinedLabel(attributes, [
      "einsatzbereich",
      "stichwort",
      "schlagwort",
      "kategorie"
    ]);
  }

  async function initializeDispatchTool() {
    abekRecords = await queryLayer(
      config.layers.abekCatalog,
      "is_active = 1",
      config.abekServiceUrl
    );

    fillSelect(
      byId("abekSelect"),
      abekRecords,
      "GlobalID",
      abekLabel,
      "ABEK-Einsatzstichwort auswählen"
    );

    scenarioSelect.addEventListener("change", loadDispatchRecord);
    saveButton.addEventListener("click", saveDispatchRecord);
    await loadDispatchRecord();
  }

  async function loadDispatchRecord() {
    const scenarioId = selectedScenarioId();
    saveButton.disabled = !scenarioId;
    dispatchRecord = null;

    ["abekSelect", "incidentType", "talkgroupName", "talkgroupShortDial",
      "incidentInformation", "dispatchFreeText"].forEach((id) => {
      byId(id).value = "";
    });

    if (!scenarioId) return;

    const records = await queryLayer(
      config.layers.scenarioDispatch,
      `scenario_id = ${guidSql(scenarioId)}`
    );
    dispatchRecord = records[0] || null;

    if (!dispatchRecord) {
      setStatus("Für dieses Szenario sind noch keine Alarmierungsdaten vorhanden.");
      return;
    }

    const attributes = dispatchRecord.attributes;
    const initialAbekId = attributeValue(attributes, "initial_abek_id");
    const storedAbekId = normalizeGuid(initialAbekId);
    const abekOption = storedAbekId
      ? Array.from(byId("abekSelect").options).find(
          (option) => option.value && normalizeGuid(option.value) === storedAbekId
        )
      : null;

    byId("abekSelect").value = abekOption?.value || "";
    byId("incidentType").value = attributes.incident_type || "";
    byId("talkgroupName").value = attributes.talkgroup_name || "";
    byId("talkgroupShortDial").value = attributes.talkgroup_short_dial || "";
    byId("incidentInformation").value = attributes.incident_information || "";
    byId("dispatchFreeText").value = attributes.dispatch_free_text || "";
    if (abekOption) {
      setStatus("Vorhandene Alarmierungsdaten wurden geladen.", "success");
    } else {
      setStatus(
        `Alarmierungsdaten geladen, aber ABEK-GUID ` +
          `${initialAbekId ?? "(leer/nicht geliefert)"} ` +
          `wurde in ${abekRecords.length} aktiven ABEK-Datensätzen nicht gefunden. ` +
          `Gelieferte Felder: ${Object.keys(attributes).join(", ")}.`,
        "error"
      );
    }
  }

  async function saveDispatchRecord() {
    const scenarioId = selectedScenarioId();
    const abekId = byId("abekSelect").value;
    const incidentType = byId("incidentType").value.trim();
    const talkgroupName = byId("talkgroupName").value.trim();

    if (!scenarioId || !abekId || !incidentType || !talkgroupName) {
      setStatus(
        "Szenario, ABEK-Einsatzstichwort, Einsatzart und Sprechgruppe sind erforderlich.",
        "error"
      );
      return;
    }

    saveButton.disabled = true;
    setStatus("Alarmierungsdaten werden gespeichert …");

    const attributes = {
      scenario_id: validatedGuid(scenarioId),
      initial_abek_id: validatedGuid(abekId),
      incident_type: incidentType,
      talkgroup_name: talkgroupName,
      talkgroup_short_dial: byId("talkgroupShortDial").value.trim() || null,
      incident_information: byId("incidentInformation").value.trim() || null,
      dispatch_free_text: byId("dispatchFreeText").value.trim() || null
    };

    let result;
    try {
      if (dispatchRecord) {
        attributes[config.fields.objectId] =
          dispatchRecord.attributes[config.fields.objectId];
        result = await applyEdits(config.layers.scenarioDispatch, {
          updates: JSON.stringify([{ attributes }])
        });
        if (!result.updateResults?.[0]?.success) {
          throw new Error(editErrorMessage(
            "Aktualisieren fehlgeschlagen",
            result.updateResults?.[0]?.error,
            attributes
          ));
        }
      } else {
        result = await applyEdits(config.layers.scenarioDispatch, {
          adds: JSON.stringify([{ attributes }])
        });
        if (!result.addResults?.[0]?.success) {
          throw new Error(editErrorMessage(
            "Anlegen fehlgeschlagen",
            result.addResults?.[0]?.error,
            attributes
          ));
        }
      }
    } catch (error) {
      const message = error.message?.startsWith("Anlegen fehlgeschlagen") ||
        error.message?.startsWith("Aktualisieren fehlgeschlagen")
        ? error.message
        : requestErrorMessage("ArcGIS-Anfrage fehlgeschlagen", error, attributes);
      setStatus(message, "error");
      saveButton.disabled = false;
      return;
    }

    setStatus("Alarmierungsdaten wurden gespeichert.", "success");
    await loadDispatchRecord();
  }

  async function startApplication() {
    validateConfig();
    setStatus("Daten werden geladen …");
    await loadBaseData();

    if (tool === "locations") await initializeLocationsTool();
    else if (tool === "vehicles") await initializeVehiclesTool();
    else if (tool === "dispatch") await initializeDispatchTool();
    else throw new Error("Unbekanntes Szenario-Werkzeug.");

    signInButton.textContent = "Angemeldet";
    signInButton.disabled = true;
    if (!statusElement.textContent || statusElement.textContent === "Daten werden geladen …") {
      setStatus("Daten wurden geladen.", "success");
    }
  }

  async function signIn() {
    try {
      setStatus("ArcGIS-Anmeldung wird geöffnet …");
      credential = await identityManager.getCredential(
        `${config.portalUrl.replace(/\/$/, "")}/sharing`
      );
      await startApplication();
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
          identityManager.registerOAuthInfos([
            new OAuthInfo({
              appId: config.oauthAppId,
              portalUrl: config.portalUrl,
              popup: true,
              popupCallbackUrl: "oauth-callback.html"
            })
          ]);

          signInButton.addEventListener("click", signIn);

          identityManager
            .checkSignInStatus(
              `${config.portalUrl.replace(/\/$/, "")}/sharing`
            )
            .then((existingCredential) => {
              credential = existingCredential;
              return startApplication();
            })
            .catch(() => {
              setStatus("Bitte mit dem ArcGIS-Trainerkonto anmelden.");
            });
        } catch (error) {
          console.error(error);
          setStatus(error.message, "error");
          signInButton.disabled = true;
        }
      }
    );
  }

  window.addEventListener("unhandledrejection", (event) => {
    console.error(event.reason);
    setStatus(event.reason?.message || "Ein unerwarteter Fehler ist aufgetreten.", "error");
    if (selectedScenarioId()) saveButton.disabled = false;
  });

  initialize();
})();
