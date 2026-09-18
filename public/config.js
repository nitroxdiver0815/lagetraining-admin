window.LAGETRAINING_ADMIN_CONFIG = {
  portalUrl: "https://www.arcgis.com",
  oauthAppId: "HIER_OAUTH_APP_ID_EINTRAGEN",
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

  labels: {
    vehicle: ["radio_call_sign", "vehicle_name", "vehicle_code"],
    location: ["location_name", "location_code"]
  },

  fireStationTypeCode: "FEUERWACHE"
};
