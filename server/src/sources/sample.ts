import type { RawListing } from '../normalize.js';
import type { SourceAdapter, SourceContext } from './types.js';

/**
 * SAMPLE DATA source. Only active when COMPSHOPPER_DEMO=1. It fabricates
 * deterministic listings so the interface can be exercised without network
 * access. Every listing is clearly labelled and links to example.com.
 */
export const SITE = 'example.com';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function rng(seed: number): () => number {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

const SELLERS = ['Sample Store A', 'Sample Store B', 'Sample Marketplace – demo_seller', 'Sample Outlet'];
const STORAGES = ['128GB', '256GB', '512GB', '1TB'];
const COLORS = ['Black', 'White', 'Blue', 'Natural Titanium'];
const EXTRAS = [
  '', '', '', 'Bundle with charger', 'with activation today', 'Renewed', 'Open Box - Excellent', 'Trade-in offer available',
  'Promo code SAVE10', '$33.29/mo financing', 'Clearance', 'Includes $50 gift card',
];

const MODELS: Record<string, string[]> = {
  smartphone: ['Apple iPhone 16 Pro', 'Samsung Galaxy S25 Ultra SM-S938U', 'Google Pixel 9 Pro GA05070', 'Motorola Edge 2025 XT2405'],
  smartwatch: ['Apple Watch Series 10 46mm GPS MWWD3LL/A', 'Samsung Galaxy Watch7 44mm SM-L310', 'Garmin Forerunner 265 010-02810-00', 'Google Pixel Watch 3 45mm'],
  cpu: ['AMD Ryzen 7 9800X3D 100-100001084WOF', 'Intel Core Ultra 7 265K BX80768265K', 'AMD Ryzen 5 9600X 100-100001405WOF', 'Intel Core i5-14600K BX8071514600K'],
  gpu: ['ASUS TUF Gaming GeForce RTX 5070 Ti 16GB TUF-RTX5070TI-O16G-GAMING', 'MSI GeForce RTX 5080 16GB GAMING TRIO OC', 'Sapphire PULSE Radeon RX 9070 XT 16GB 11348-03-20G', 'Gigabyte GeForce RTX 5070 12GB WINDFORCE OC'],
  memory: ['Corsair Vengeance 32GB (2x16GB) DDR5 6000 CMK32GX5M2B6000C36', 'G.Skill Trident Z5 RGB 64GB (2x32GB) DDR5 6400 F5-6400J3239G32GX2-TZ5RK', 'Kingston FURY Beast 32GB DDR5 5600 KF556C36BBEK2-32'],
  storage: ['Samsung 990 PRO 2TB NVMe M.2 SSD MZ-V9P2T0B/AM', 'WD_BLACK SN850X 4TB NVMe SSD WDS400T2X0E', 'Crucial T705 1TB PCIe 5.0 NVMe SSD CT1000T705SSD3', 'Seagate IronWolf 8TB 3.5" HDD ST8000VN004'],
  laptop: ['Apple MacBook Air 13" M4 16GB 512GB MC6T4LL/A', 'Dell XPS 14 Core Ultra 7 32GB 1TB', 'Lenovo Legion 5 15" Ryzen 7 16GB 1TB RTX 5060'],
  monitor: ['LG UltraGear 27" 1440p 240Hz OLED 27GS95QE-B', 'Samsung Odyssey G7 32" 4K 144Hz LS32BG702ENXGO', 'Dell 27" 4K IPS S2722QC'],
};

export function generateSampleListings(ctx: SourceContext): RawListing[] {
  const seed = hash(ctx.searchText + ctx.category.id);
  const rand = rng(seed);
  const names = MODELS[ctx.category.id] ?? [ctx.searchText || 'Sample device'];
  const out: RawListing[] = [];
  let n = 0;
  names.forEach((name, i) => {
    const base = 120 + Math.floor(rand() * 1400);
    SELLERS.forEach((seller, j) => {
      n++;
      const price = Math.round((base + rand() * 300) * 100) / 100;
      // Cycle through storage/colour so every variant exists for every device.
      const storage = ctx.category.fields.some((f) => f.key === 'storage') ? STORAGES[(i + j) % STORAGES.length] : '';
      const color = ctx.category.fields.some((f) => f.key === 'color') ? COLORS[(i * 2 + j) % COLORS.length] : '';
      const extra = EXTRAS[Math.floor(rand() * EXTRAS.length)];
      const title = [name, storage, color, extra].filter(Boolean).join(' ');
      const hasWas = rand() < 0.4;
      out.push({
        externalId: `sample-${n}`,
        title: `[SAMPLE] ${title}`,
        url: `https://example.com/sample/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}?seller=${n}`,
        price,
        wasPrice: hasWas ? Math.round(price * (1.1 + rand() * 0.3) * 100) / 100 : null,
        shippingCost: rand() < 0.6 ? 0 : Math.round(rand() * 15 * 100) / 100,
        seller: `${seller} (SAMPLE DATA)`,
        sellerSite: SITE,
        marketplace: seller.includes('Marketplace'),
        extraText: [extra],
        defaultCondition: 'new',
      });
    });
  });
  return out;
}

export const sample: SourceAdapter = {
  id: 'sample',
  label: 'Sample data (not real)',
  site: SITE,
  availability: () =>
    process.env.COMPSHOPPER_DEMO === '1'
      ? { enabled: true }
      : { enabled: false, reason: 'Set COMPSHOPPER_DEMO=1 to enable fabricated sample listings' },
  async search(ctx: SourceContext) {
    return generateSampleListings(ctx);
  },
};
