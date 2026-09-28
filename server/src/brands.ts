/**
 * Manufacturer inference. Each brand lists patterns (lower-case, whole-word)
 * that identify it; product-family hints (iphone => Apple) are included so
 * listings that never spell out the brand still get attributed.
 */
export interface Brand {
  name: string;
  patterns: string[];
}

export const BRANDS: Brand[] = [
  { name: 'Apple', patterns: ['apple', 'iphone', 'ipad', 'macbook', 'imac', 'mac mini', 'mac studio', 'airpods', 'apple watch'] },
  { name: 'Samsung', patterns: ['samsung', 'galaxy'] },
  { name: 'Google', patterns: ['google', 'pixel'] },
  { name: 'Motorola', patterns: ['motorola', 'moto'] },
  { name: 'OnePlus', patterns: ['oneplus', 'one plus'] },
  { name: 'Nothing', patterns: ['nothing phone', 'nothing ear'] },
  { name: 'Xiaomi', patterns: ['xiaomi', 'redmi', 'poco'] },
  { name: 'Sony', patterns: ['sony', 'playstation', 'ps5', 'ps4', 'xperia', 'wh-1000', 'wf-1000'] },
  { name: 'Microsoft', patterns: ['microsoft', 'xbox', 'surface'] },
  { name: 'Nintendo', patterns: ['nintendo', 'switch oled', 'switch 2'] },
  { name: 'Valve', patterns: ['valve', 'steam deck'] },
  { name: 'Garmin', patterns: ['garmin', 'fenix', 'forerunner', 'venu', 'vivoactive', 'epix'] },
  { name: 'Fitbit', patterns: ['fitbit'] },
  { name: 'Amazfit', patterns: ['amazfit'] },
  { name: 'Withings', patterns: ['withings'] },
  { name: 'Huawei', patterns: ['huawei'] },
  { name: 'Amazon', patterns: ['amazon', 'kindle', 'fire hd', 'fire max', 'echo'] },
  { name: 'ASUS', patterns: ['asus', 'rog', 'tuf gaming', 'zenbook', 'vivobook', 'zenfone', 'proart'] },
  { name: 'MSI', patterns: ['msi'] },
  { name: 'Gigabyte', patterns: ['gigabyte', 'aorus'] },
  { name: 'ASRock', patterns: ['asrock'] },
  { name: 'EVGA', patterns: ['evga'] },
  { name: 'Zotac', patterns: ['zotac'] },
  { name: 'PNY', patterns: ['pny'] },
  { name: 'Sapphire', patterns: ['sapphire'] },
  { name: 'PowerColor', patterns: ['powercolor'] },
  { name: 'XFX', patterns: ['xfx'] },
  { name: 'NVIDIA', patterns: ['nvidia', 'geforce', 'founders edition'] },
  { name: 'AMD', patterns: ['amd', 'ryzen', 'radeon', 'threadripper', 'epyc'] },
  { name: 'Intel', patterns: ['intel', 'core i3', 'core i5', 'core i7', 'core i9', 'core ultra', 'arc a', 'arc b'] },
  { name: 'Corsair', patterns: ['corsair', 'vengeance', 'dominator'] },
  { name: 'G.Skill', patterns: ['g.skill', 'gskill', 'g skill', 'trident z', 'ripjaws', 'flare x'] },
  { name: 'Kingston', patterns: ['kingston', 'hyperx', 'fury beast', 'fury renegade'] },
  { name: 'Crucial', patterns: ['crucial'] },
  { name: 'TeamGroup', patterns: ['teamgroup', 'team group', 't-force', 't force'] },
  { name: 'Patriot', patterns: ['patriot', 'viper'] },
  { name: 'ADATA', patterns: ['adata', 'xpg'] },
  { name: 'Western Digital', patterns: ['western digital', 'wd', 'wd_black', 'wd black', 'sandisk'] },
  { name: 'Seagate', patterns: ['seagate', 'barracuda', 'ironwolf', 'firecuda'] },
  { name: 'SK hynix', patterns: ['sk hynix', 'hynix', 'solidigm'] },
  { name: 'Sabrent', patterns: ['sabrent', 'rocket 4', 'rocket 5'] },
  { name: 'Dell', patterns: ['dell', 'alienware', 'xps', 'inspiron', 'latitude'] },
  { name: 'HP', patterns: ['hp', 'omen', 'hewlett', 'pavilion', 'envy x360', 'victus'] },
  { name: 'Lenovo', patterns: ['lenovo', 'thinkpad', 'legion', 'ideapad', 'yoga'] },
  { name: 'Acer', patterns: ['acer', 'predator', 'nitro'] },
  { name: 'Razer', patterns: ['razer', 'blade 14', 'blade 16'] },
  { name: 'Framework', patterns: ['framework laptop'] },
  { name: 'LG', patterns: ['lg', 'ultragear', 'ultrawide'] },
  { name: 'BenQ', patterns: ['benq', 'zowie', 'mobiuz'] },
  { name: 'ViewSonic', patterns: ['viewsonic'] },
  { name: 'AOC', patterns: ['aoc', 'agon'] },
  { name: 'Alienware', patterns: [] },
  { name: 'Bose', patterns: ['bose', 'quietcomfort'] },
  { name: 'Sennheiser', patterns: ['sennheiser', 'momentum 4'] },
  { name: 'Beats', patterns: ['beats'] },
  { name: 'JBL', patterns: ['jbl'] },
  { name: 'Jabra', patterns: ['jabra'] },
  { name: 'Anker', patterns: ['anker', 'soundcore'] },
  { name: 'Logitech', patterns: ['logitech', 'logi'] },
  { name: 'Seasonic', patterns: ['seasonic'] },
  { name: 'be quiet!', patterns: ['be quiet!', 'be quiet', 'bequiet'] },
  { name: 'Thermaltake', patterns: ['thermaltake', 'toughpower'] },
  { name: 'Cooler Master', patterns: ['cooler master', 'coolermaster'] },
  { name: 'NZXT', patterns: ['nzxt'] },
  { name: 'SilverStone', patterns: ['silverstone'] },
  { name: 'Biostar', patterns: ['biostar'] },
];

const ALIASES: Record<string, string> = {
  wd: 'Western Digital',
  'western digital': 'Western Digital',
  sandisk: 'Western Digital',
  gskill: 'G.Skill',
  'g skill': 'G.Skill',
  'team group': 'TeamGroup',
  hynix: 'SK hynix',
  bequiet: 'be quiet!',
  'be quiet': 'be quiet!',
  coolermaster: 'Cooler Master',
};

/** Canonical brand for a user supplied manufacturer string, if known. */
export function canonicalBrand(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];
  for (const b of BRANDS) {
    if (b.name.toLowerCase() === key) return b.name;
  }
  return null;
}

/**
 * Infer the manufacturer from listing text. The brand whose pattern occurs
 * earliest in the text wins, which keeps "ASUS GeForce RTX 5080" attributed
 * to ASUS rather than NVIDIA.
 */
export function inferManufacturer(text: string): string | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9.!_&+-]+/g, ' ')} `;
  let best: { name: string; pos: number } | null = null;
  for (const b of BRANDS) {
    for (const p of b.patterns) {
      const needle = ` ${p} `;
      const pos = t.indexOf(needle);
      if (pos !== -1 && (best === null || pos < best.pos)) {
        best = { name: b.name, pos };
      }
    }
  }
  return best ? best.name : null;
}
