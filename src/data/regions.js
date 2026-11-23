// Regions the player can deploy into. `geo` is the user population a region
// serves best. `jur` is the legal jurisdiction (used for data residency and,
// later in the story, legal takedowns). Provider matters for multi-cloud.
export const REGIONS = [
  { id: 'us-east-1', name: 'N. Virginia', geo: 'NA', jur: 'US', provider: 'aws', priceMult: 1.0 },
  { id: 'us-west-2', name: 'Oregon', geo: 'NA', jur: 'US', provider: 'aws', priceMult: 1.0 },
  { id: 'eu-west-1', name: 'Ireland', geo: 'EU', jur: 'EU', provider: 'aws', priceMult: 1.08 },
  { id: 'eu-central-1', name: 'Frankfurt', geo: 'EU', jur: 'EU', provider: 'aws', priceMult: 1.12 },
  { id: 'ap-southeast-1', name: 'Singapore', geo: 'APAC', jur: 'SG', provider: 'aws', priceMult: 1.15 },
  { id: 'ap-northeast-1', name: 'Tokyo', geo: 'APAC', jur: 'JP', provider: 'aws', priceMult: 1.18 },
  { id: 'sa-east-1', name: 'São Paulo', geo: 'SA', jur: 'BR', provider: 'aws', priceMult: 1.45 },
  { id: 'azure-eastus', name: 'Azure East US', geo: 'NA', jur: 'US', provider: 'azure', priceMult: 1.02 },
  { id: 'azure-westeurope', name: 'Azure West Europe', geo: 'EU', jur: 'NL', provider: 'azure', priceMult: 1.1 },
  { id: 'azure-southeastasia', name: 'Azure SE Asia', geo: 'APAC', jur: 'SG', provider: 'azure', priceMult: 1.16 },
  { id: 'gcp-us-central1', name: 'GCP Iowa', geo: 'NA', jur: 'US', provider: 'gcp', priceMult: 0.98 },
  { id: 'gcp-europe-west1', name: 'GCP Belgium', geo: 'EU', jur: 'BE', provider: 'gcp', priceMult: 1.06 },
  { id: 'gcp-asia-east1', name: 'GCP Taiwan', geo: 'APAC', jur: 'TW', provider: 'gcp', priceMult: 1.12 },
];
export const REGION = Object.fromEntries(REGIONS.map(r => [r.id, r]));

export const AZ_SUFFIX = ['a', 'b', 'c'];
export const azId = (regionId, i) => `${regionId}${AZ_SUFFIX[i]}`;

// one-way latency in ms between user geography and region geography
export const GEO_LATENCY = {
  NA: { NA: 18, EU: 85, APAC: 150, SA: 120 },
  EU: { NA: 85, EU: 15, APAC: 170, SA: 190 },
  APAC: { NA: 150, EU: 170, APAC: 25, SA: 300 },
  SA: { NA: 120, EU: 190, APAC: 300, SA: 20 },
};
export const GEOS = ['NA', 'EU', 'APAC', 'SA'];

export const PROVIDERS = {
  aws: { name: 'AWS', color: '#ff9900' },
  azure: { name: 'Azure', color: '#3a96dd' },
  gcp: { name: 'Google Cloud', color: '#34a853' },
};
