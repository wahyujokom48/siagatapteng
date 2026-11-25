export type RegionGroup = 'Tapanuli Tengah' | 'Kota Sibolga';

export interface District {
  id: string;
  name: string;
  region: RegionGroup;
  lat: number;
  lon: number;
  elevationNote: string;
  riskProfile: 'Tinggi' | 'Sedang';
  riverBasin: string;
}

export const MONITORED_DISTRICTS: District[] = [
  // Kabupaten Tapanuli Tengah
  {
    id: 'pandan',
    name: 'Pandan',
    region: 'Tapanuli Tengah',
    lat: 1.6908,
    lon: 98.8286,
    elevationNote: 'Pesisir & Ibu Kota Kab.',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Aek Sipan / Pesisir',
  },
  {
    id: 'tukka',
    name: 'Tukka',
    region: 'Tapanuli Tengah',
    lat: 1.72,
    lon: 98.87,
    elevationNote: 'Kaki Bukit & Aliran Sungai',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Aek Tukka',
  },
  {
    id: 'sarudik',
    name: 'Sarudik',
    region: 'Tapanuli Tengah',
    lat: 1.725,
    lon: 98.805,
    elevationNote: 'Hilir & Pemukiman Padat',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Sarudik',
  },
  {
    id: 'sitahuis',
    name: 'Sitahuis',
    region: 'Tapanuli Tengah',
    lat: 1.805,
    lon: 98.825,
    elevationNote: 'Dataran Tinggi / Hulu',
    riskProfile: 'Tinggi',
    riverBasin: 'Hulu Sungai Tapteng-Sibolga',
  },
  {
    id: 'kolang',
    name: 'Kolang',
    region: 'Tapanuli Tengah',
    lat: 1.855,
    lon: 98.66,
    elevationNote: 'Lembah & Sungai Besar',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Kolang',
  },
  {
    id: 'badiri',
    name: 'Badiri',
    region: 'Tapanuli Tengah',
    lat: 1.63,
    lon: 98.875,
    elevationNote: 'Dataran Rendah & Perkebunan',
    riskProfile: 'Sedang',
    riverBasin: 'DAS Badiri',
  },
  {
    id: 'pinangsori',
    name: 'Pinangsori',
    region: 'Tapanuli Tengah',
    lat: 1.564,
    lon: 98.905,
    elevationNote: 'Dataran Rendah / Bandara',
    riskProfile: 'Sedang',
    riverBasin: 'DAS Lumut - Pinangsori',
  },
  {
    id: 'sorkam',
    name: 'Sorkam',
    region: 'Tapanuli Tengah',
    lat: 1.908,
    lon: 98.57,
    elevationNote: 'Pesisir Utara',
    riskProfile: 'Sedang',
    riverBasin: 'DAS Sorkam',
  },
  {
    id: 'barus',
    name: 'Barus',
    region: 'Tapanuli Tengah',
    lat: 2.008,
    lon: 98.403,
    elevationNote: 'Pesisir & Muara Sungai',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Aek Sirahar',
  },
  {
    id: 'sibabangun',
    name: 'Sibabangun',
    region: 'Tapanuli Tengah',
    lat: 1.515,
    lon: 98.94,
    elevationNote: 'Perbukitan Selatan',
    riskProfile: 'Sedang',
    riverBasin: 'DAS Sibabangun',
  },

  // Kota Sibolga (Berbatasan langsung dengan Tapanuli Tengah)
  {
    id: 'sibolga-utara',
    name: 'Sibolga Utara',
    region: 'Kota Sibolga',
    lat: 1.7475,
    lon: 98.779,
    elevationNote: 'Perbukitan & Rawan Longsor',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Aek Doras / Perbukitan',
  },
  {
    id: 'sibolga-kota',
    name: 'Sibolga Kota',
    region: 'Kota Sibolga',
    lat: 1.7395,
    lon: 98.785,
    elevationNote: 'Pusat Kota & Pesisir Teluk',
    riskProfile: 'Tinggi',
    riverBasin: 'Drainase Kota & Teluk Tapian Nauli',
  },
  {
    id: 'sibolga-sambas',
    name: 'Sibolga Sambas',
    region: 'Kota Sibolga',
    lat: 1.732,
    lon: 98.792,
    elevationNote: 'Pesisir & Pemukiman Padat',
    riskProfile: 'Tinggi',
    riverBasin: 'Hilir Sungai Sibolga',
  },
  {
    id: 'sibolga-selatan',
    name: 'Sibolga Selatan',
    region: 'Kota Sibolga',
    lat: 1.7215,
    lon: 98.798,
    elevationNote: 'Perbatasan Sarudik & Pesisir',
    riskProfile: 'Tinggi',
    riverBasin: 'DAS Aek Parombunan / Sarudik',
  },
];
