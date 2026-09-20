window.LAGETRAINING_ADMIN_CONFIG = {
  portalUrl: "https://www.arcgis.com",
  oauthAppId: "0sjHE1H45PUtL5k3",
  featureServiceUrl: "https://services-eu1.arcgis.com/XfUqDXJfAezaKUnU/arcgis/rest/services/Lagetraining_Daten_Trainer/FeatureServer",
  abekServiceUrl: "https://services-eu1.arcgis.com/XfUqDXJfAezaKUnU/arcgis/rest/services/abek_catalog/FeatureServer",

  layers: {
    locations: 0,
    vehicles: 10,
    scenarioTemplates: 11,
    scenarioLocations: 12,
    scenarioVehicles: 13,
    scenarioDispatch: 16,
    abekCatalog: 0
  },

  fields: {
    objectId: "OBJECTID",
    globalId: "GlobalID",
    vehicleHomeLocationId: "home_location_id",
    locationType: "location_type"
  },

  labels: {
    scenario: ["scenario_name", "scenario_code"],
    vehicle: ["radio_call_sign", "vehicle_name", "vehicle_code"],
    location: ["location_name", "location_code"]
  },

  fireStationTypeCode: "FIRE_STATION"
};
