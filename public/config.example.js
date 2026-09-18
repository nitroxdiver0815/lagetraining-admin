window.LAGETRAINING_ADMIN_CONFIG = {
  portalUrl: "https://www.arcgis.com",
  oauthAppId: "HIER_OAUTH_APP_ID_EINTRAGEN",

  // Basis-URL der editierbaren Trainer-Sicht, ohne Layer-ID.
  // Beispiel:
  // https://services-eu1.arcgis.com/.../arcgis/rest/services/Lagetraining_Daten_Trainer/FeatureServer
  featureServiceUrl: "HIER_FEATURESERVICE_URL_EINTRAGEN",

  layers: {
    locations: 0,
    vehicles: 10
  },

  fields: {
    objectId: "OBJECTID",
    globalId: "GlobalID",
    vehicleHomeLocationId: "home_location_id",
    locationType: "location_type"
  },

  // Bei Bedarf an die tatsächlich verwendeten Feldnamen anpassen.
  labels: {
    vehicle: ["radio_call_sign", "vehicle_name", "vehicle_code"],
    location: ["location_name", "location_code"]
  },

  // Domain location_type: FIRE_STATION = Feuerwache
  fireStationTypeCode: "FIRE_STATION"
};
