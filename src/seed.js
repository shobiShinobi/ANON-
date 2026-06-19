// Generate a 12-word recovery seed using a CSPRNG (crypto.getRandomValues).
// 128-word list => log2(128) * 12 = 84 bits of entropy, plenty for a recovery
// phrase that gates a scrypt-hashed credential on the server.

const WORDS = [
  'apple', 'brave', 'campus', 'delta', 'eagle', 'falcon', 'ghost', 'hover', 'index', 'jungle',
  'karma', 'lunar', 'matrix', 'nexus', 'orbit', 'pulse', 'quantum', 'radar', 'solar', 'tango',
  'umbra', 'vertex', 'willow', 'xenon', 'yonder', 'zephyr', 'amber', 'basin', 'cobalt', 'dune',
  'ember', 'flint', 'glacier', 'harbor', 'ivory', 'jasper', 'kettle', 'lagoon', 'meadow', 'nimbus',
  'onyx', 'prairie', 'quartz', 'ridge', 'summit', 'tundra', 'umber', 'valley', 'walnut', 'yarrow',
  'zinc', 'anchor', 'breeze', 'cedar', 'dapple', 'echo', 'fable', 'grove', 'hazel', 'iris',
  'juniper', 'kelp', 'linen', 'maple', 'nectar', 'opal', 'pebble', 'quill', 'raven', 'sable',
  'thicket', 'ursa', 'velvet', 'wisp', 'cipher', 'beacon', 'cinder', 'drift', 'fjord', 'gale',
  'hollow', 'inlet', 'jetty', 'knoll', 'lantern', 'marsh', 'north', 'oasis', 'pylon', 'quay',
  'reef', 'shoal', 'trail', 'upland', 'vista', 'wharf', 'cascade', 'bramble', 'comet', 'dawn',
  'field', 'gully', 'heath', 'isle', 'lake', 'moor', 'pine', 'quiet', 'river', 'stone',
  'tide', 'vale', 'wind', 'aspen', 'birch', 'crag', 'fern', 'glen', 'mesa', 'peak',
  'spire', 'wave', 'frost', 'spark', 'cove', 'dell', 'fen', 'rill',
];

export function generateSeed() {
  const idx = new Uint32Array(12);
  crypto.getRandomValues(idx);
  return Array.from(idx, (n) => WORDS[n % WORDS.length]).join(' ');
}
