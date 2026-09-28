/**
 * Category catalogue. Each category declares the attribute fields shown in
 * the search form. Any field left blank is treated as "any".
 *
 * `match` controls how a value is matched against a listing:
 *  - text:     case-insensitive token match against the listing text
 *  - capacity: normalised storage/memory capacity match (128GB == 128 GB)
 *  - size:     numeric size match with unit (44mm, 27", 6.1-inch)
 *  - exact:    the option value must appear verbatim (case-insensitive)
 */
export type MatchKind = 'text' | 'capacity' | 'size' | 'exact';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'select';
  match: MatchKind;
  placeholder?: string;
  /** For selects: values offered. "" (any) is always added by the UI. */
  options?: string[];
  /** For text inputs: suggestions offered through a datalist. */
  suggestions?: string[];
  /** Whether the value is appended to the retailer search text. Default true. */
  includeInSearch?: boolean;
}

export interface CategoryDef {
  id: string;
  label: string;
  /** Words appended to the retailer search to keep results on-topic. */
  searchTerms: string[];
  /** Words that indicate an accessory rather than the device itself. */
  excludeTerms: string[];
  /** Well-known manufacturers offered as suggestions. */
  manufacturers: string[];
  fields: FieldDef[];
}

const STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
const COLOR_SUGGESTIONS = [
  'Black', 'White', 'Silver', 'Gray', 'Graphite', 'Blue', 'Green', 'Red', 'Pink',
  'Purple', 'Gold', 'Titanium', 'Midnight', 'Starlight', 'Natural', 'Desert',
];
const COMMON_ACCESSORY_TERMS = [
  'case', 'cover', 'skin', 'screen protector', 'tempered glass', 'charger', 'cable',
  'adapter', 'mount', 'stand', 'holder', 'strap', 'band', 'sleeve', 'dock', 'stylus',
  'replacement', 'battery for', 'compatible with', 'for iphone', 'for samsung', 'for galaxy',
  'for apple watch', 'for pixel', 'lens protector', 'wallet', 'sticker', 'decal',
];

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'smartphone',
    label: 'Smartphone',
    searchTerms: ['smartphone'],
    excludeTerms: [...COMMON_ACCESSORY_TERMS, 'sim card', 'earbuds', 'power bank'],
    manufacturers: ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus', 'Nothing', 'Sony', 'Xiaomi', 'ASUS'],
    fields: [
      { key: 'storage', label: 'Storage', type: 'select', match: 'capacity', options: STORAGE_OPTIONS },
      { key: 'color', label: 'Color', type: 'text', match: 'text', suggestions: COLOR_SUGGESTIONS, placeholder: 'Any color' },
      { key: 'carrier', label: 'Carrier', type: 'select', match: 'text', options: ['Unlocked', 'Verizon', 'AT&T', 'T-Mobile'] },
    ],
  },
  {
    id: 'smartwatch',
    label: 'Smart Watch',
    searchTerms: ['smartwatch'],
    excludeTerms: [...COMMON_ACCESSORY_TERMS, 'watch band', 'bands', 'protector', 'charging cable'],
    manufacturers: ['Apple', 'Samsung', 'Google', 'Garmin', 'Fitbit', 'Amazfit', 'Withings', 'Huawei'],
    fields: [
      { key: 'caseSize', label: 'Case size', type: 'select', match: 'size', options: ['38mm', '40mm', '41mm', '42mm', '44mm', '45mm', '46mm', '47mm', '49mm'] },
      { key: 'connectivity', label: 'Connectivity', type: 'select', match: 'text', options: ['GPS', 'Cellular', 'LTE', 'Bluetooth'] },
      { key: 'color', label: 'Color', type: 'text', match: 'text', suggestions: COLOR_SUGGESTIONS, placeholder: 'Any color' },
    ],
  },
  {
    id: 'tablet',
    label: 'Tablet',
    searchTerms: ['tablet'],
    excludeTerms: [...COMMON_ACCESSORY_TERMS, 'keyboard case', 'pencil', 'pen tip'],
    manufacturers: ['Apple', 'Samsung', 'Amazon', 'Lenovo', 'Microsoft', 'Google', 'OnePlus'],
    fields: [
      { key: 'storage', label: 'Storage', type: 'select', match: 'capacity', options: STORAGE_OPTIONS },
      { key: 'connectivity', label: 'Connectivity', type: 'select', match: 'text', options: ['Wi-Fi', 'Cellular', '5G'] },
      { key: 'color', label: 'Color', type: 'text', match: 'text', suggestions: COLOR_SUGGESTIONS, placeholder: 'Any color' },
    ],
  },
  {
    id: 'laptop',
    label: 'Laptop',
    searchTerms: ['laptop'],
    excludeTerms: [...COMMON_ACCESSORY_TERMS, 'backpack', 'bag', 'docking station', 'cooling pad'],
    manufacturers: ['Apple', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'Microsoft', 'Razer', 'Samsung', 'LG', 'Framework'],
    fields: [
      { key: 'cpu', label: 'Processor', type: 'text', match: 'text', placeholder: 'e.g. Ryzen 7, i7, M3', suggestions: ['M3', 'M4', 'Core i5', 'Core i7', 'Core Ultra 7', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9', 'Snapdragon X'] },
      { key: 'ram', label: 'Memory', type: 'select', match: 'capacity', options: ['8GB', '16GB', '24GB', '32GB', '64GB'] },
      { key: 'storage', label: 'Storage', type: 'select', match: 'capacity', options: ['256GB', '512GB', '1TB', '2TB', '4TB'] },
      { key: 'screenSize', label: 'Screen size', type: 'select', match: 'size', options: ['13"', '14"', '15"', '16"', '17"'] },
    ],
  },
  {
    id: 'cpu',
    label: 'Processor (CPU)',
    searchTerms: ['processor', 'cpu'],
    excludeTerms: ['cooler', 'thermal paste', 'fan', 'motherboard combo', 'water block', 'laptop', 'notebook'],
    manufacturers: ['AMD', 'Intel'],
    fields: [
      { key: 'socket', label: 'Socket', type: 'select', match: 'text', options: ['AM5', 'AM4', 'LGA1851', 'LGA1700', 'sTR5'] },
      { key: 'cores', label: 'Cores', type: 'text', match: 'text', placeholder: 'e.g. 8-core', includeInSearch: false },
    ],
  },
  {
    id: 'gpu',
    label: 'Graphics card (GPU)',
    searchTerms: ['graphics card'],
    excludeTerms: ['bracket', 'support', 'riser', 'cable', 'water block', 'backplate', 'laptop', 'notebook'],
    manufacturers: ['NVIDIA', 'AMD', 'Intel', 'ASUS', 'MSI', 'Gigabyte', 'EVGA', 'Zotac', 'Sapphire', 'PowerColor', 'XFX', 'PNY'],
    fields: [
      { key: 'vram', label: 'VRAM', type: 'select', match: 'capacity', options: ['8GB', '12GB', '16GB', '20GB', '24GB', '32GB'] },
      { key: 'chipset', label: 'Chip', type: 'text', match: 'text', placeholder: 'e.g. RTX 5070, RX 9070 XT', suggestions: ['RTX 5090', 'RTX 5080', 'RTX 5070 Ti', 'RTX 5070', 'RTX 5060', 'RX 9070 XT', 'RX 9070', 'RX 7800 XT', 'Arc B580'] },
    ],
  },
  {
    id: 'memory',
    label: 'Memory (RAM)',
    searchTerms: ['memory', 'ram'],
    excludeTerms: ['laptop', 'sodimm', 'so-dimm', 'server', 'ecc', 'heatsink only', 'microsd', 'sd card', 'flash drive', 'usb'],
    manufacturers: ['Corsair', 'G.Skill', 'Kingston', 'Crucial', 'TeamGroup', 'Patriot', 'ADATA', 'Samsung'],
    fields: [
      { key: 'capacity', label: 'Capacity', type: 'select', match: 'capacity', options: ['16GB', '32GB', '48GB', '64GB', '96GB', '128GB'] },
      { key: 'type', label: 'Type', type: 'select', match: 'exact', options: ['DDR5', 'DDR4'] },
      { key: 'speed', label: 'Speed', type: 'text', match: 'text', placeholder: 'e.g. 6000', suggestions: ['3200', '3600', '5600', '6000', '6400', '7200', '8000'] },
    ],
  },
  {
    id: 'storage',
    label: 'Storage (SSD / HDD)',
    searchTerms: ['ssd'],
    excludeTerms: ['enclosure', 'heatsink only', 'adapter', 'cable', 'dock', 'caddy', 'bracket', 'microsd', 'sd card', 'flash drive'],
    manufacturers: ['Samsung', 'WD', 'Western Digital', 'Seagate', 'Crucial', 'Kingston', 'SK hynix', 'Sabrent', 'TeamGroup', 'Corsair'],
    fields: [
      { key: 'capacity', label: 'Capacity', type: 'select', match: 'capacity', options: ['500GB', '1TB', '2TB', '4TB', '8TB', '16TB', '20TB'] },
      { key: 'interface', label: 'Interface', type: 'select', match: 'text', options: ['NVMe', 'PCIe 5.0', 'PCIe 4.0', 'SATA', 'USB'] },
      { key: 'formFactor', label: 'Form factor', type: 'select', match: 'text', options: ['M.2 2280', '2.5"', '3.5"', 'Portable'] },
    ],
  },
  {
    id: 'motherboard',
    label: 'Motherboard',
    searchTerms: ['motherboard'],
    excludeTerms: ['standoff', 'screws', 'cable', 'i/o shield', 'bracket', 'laptop'],
    manufacturers: ['ASUS', 'MSI', 'Gigabyte', 'ASRock', 'NZXT', 'Biostar'],
    fields: [
      { key: 'socket', label: 'Socket', type: 'select', match: 'text', options: ['AM5', 'AM4', 'LGA1851', 'LGA1700'] },
      { key: 'chipset', label: 'Chipset', type: 'text', match: 'text', placeholder: 'e.g. X870E, B650, Z890', suggestions: ['X870E', 'X870', 'B850', 'B650E', 'B650', 'Z890', 'B860', 'Z790', 'B760'] },
      { key: 'formFactor', label: 'Form factor', type: 'select', match: 'text', options: ['ATX', 'Micro ATX', 'Mini ITX', 'E-ATX'] },
    ],
  },
  {
    id: 'psu',
    label: 'Power supply (PSU)',
    searchTerms: ['power supply'],
    excludeTerms: ['cable', 'extension', 'sleeved', 'adapter', 'tester', 'laptop', 'charger'],
    manufacturers: ['Corsair', 'Seasonic', 'EVGA', 'be quiet!', 'Thermaltake', 'Cooler Master', 'MSI', 'ASUS', 'SilverStone', 'NZXT'],
    fields: [
      { key: 'wattage', label: 'Wattage', type: 'select', match: 'text', options: ['550W', '650W', '750W', '850W', '1000W', '1200W', '1600W'] },
      { key: 'rating', label: '80 PLUS rating', type: 'select', match: 'text', options: ['Bronze', 'Gold', 'Platinum', 'Titanium'] },
      { key: 'modular', label: 'Modular', type: 'select', match: 'text', options: ['Fully Modular', 'Semi Modular'] },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    searchTerms: ['monitor'],
    excludeTerms: ['arm', 'mount', 'stand', 'cable', 'light bar', 'privacy filter', 'riser', 'laptop'],
    manufacturers: ['LG', 'Samsung', 'Dell', 'ASUS', 'Acer', 'MSI', 'Gigabyte', 'BenQ', 'Alienware', 'ViewSonic', 'AOC'],
    fields: [
      { key: 'screenSize', label: 'Size', type: 'select', match: 'size', options: ['24"', '27"', '32"', '34"', '38"', '42"', '49"'] },
      { key: 'resolution', label: 'Resolution', type: 'select', match: 'text', options: ['1080p', '1440p', '4K', 'Ultrawide'] },
      { key: 'refreshRate', label: 'Refresh rate', type: 'select', match: 'text', options: ['60Hz', '120Hz', '144Hz', '165Hz', '240Hz', '360Hz'] },
      { key: 'panel', label: 'Panel', type: 'select', match: 'text', options: ['OLED', 'IPS', 'VA', 'Mini LED'] },
    ],
  },
  {
    id: 'headphones',
    label: 'Headphones / Earbuds',
    searchTerms: ['headphones'],
    excludeTerms: ['case', 'cover', 'ear tips', 'ear pads', 'replacement', 'cable', 'stand', 'hook'],
    manufacturers: ['Apple', 'Sony', 'Bose', 'Samsung', 'Sennheiser', 'Beats', 'JBL', 'Google', 'Jabra', 'Anker'],
    fields: [
      { key: 'type', label: 'Type', type: 'select', match: 'text', options: ['Earbuds', 'Over-Ear', 'On-Ear', 'Wireless', 'Wired'] },
      { key: 'color', label: 'Color', type: 'text', match: 'text', suggestions: COLOR_SUGGESTIONS, placeholder: 'Any color' },
    ],
  },
  {
    id: 'console',
    label: 'Game console',
    searchTerms: ['console'],
    excludeTerms: [...COMMON_ACCESSORY_TERMS, 'controller', 'headset', 'game', 'skin', 'faceplate'],
    manufacturers: ['Sony', 'Microsoft', 'Nintendo', 'Valve', 'ASUS'],
    fields: [
      { key: 'storage', label: 'Storage', type: 'select', match: 'capacity', options: ['64GB', '256GB', '512GB', '1TB', '2TB'] },
      { key: 'edition', label: 'Edition', type: 'text', match: 'text', placeholder: 'e.g. Digital, Pro, OLED', suggestions: ['Digital Edition', 'Pro', 'Slim', 'OLED', 'Series X', 'Series S'] },
    ],
  },
  {
    id: 'other',
    label: 'Other electronics',
    searchTerms: [],
    excludeTerms: [],
    manufacturers: [],
    fields: [
      { key: 'attribute', label: 'Attribute', type: 'text', match: 'text', placeholder: 'Any extra attribute', includeInSearch: true },
    ],
  },
];

export const CATEGORY_MAP: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

export function getCategory(id: string | undefined): CategoryDef {
  return (id && CATEGORY_MAP[id]) || CATEGORY_MAP.other;
}
