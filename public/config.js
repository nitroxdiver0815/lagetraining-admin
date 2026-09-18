window.LAGETRAINING_ADMIN_CONFIG = {
  portalUrl: "https://www.arcgis.com",
  oauthAppId: "HIER_OAUTH_APP_ID_EINTRAGEN",
  featureServiceUrl: "https://services-eu1.arcgis.com/XfUqDXJfAezaKUnU/arcgis/rest/services/Lagetraining_Daten_Trainer/FeatureServer",

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

  labels: {
    vehicle: ["radio_call_sign", "vehicle_name", "vehicle_code"],
    location: ["location_name", "location_code"]
  },

  fireStationTypeCode: "FEUERWACHE"
};
