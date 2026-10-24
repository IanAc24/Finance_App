// What accounts 1..15 are used for by the workflow / money / edge specs
// (Agent D). Merged into the manifest by accounts.js. No passwords here.
export const SCENARIOS_D = {
  1: ['D workflows: full flow register -> add -> history -> edit -> delete -> sign out/in'],
  2: ['D money-ui: currency separation (CRC vs USD) on Home, History and the report'],
  3: ['D money-ui: 100 expenses of $0.10 add up to $10.00'],
  4: ['D money-ui: duplicate saves (5 rapid clicks, throttled CPU)'],
  5: ['D money-ui: zero / blank / invalid amount and missing category'],
  6: ['D workflows: two concurrent browser contexts (with account 7)'],
  7: ['D workflows: second concurrent context (with account 6)'],
  8: ['D workflows: switch account in the same context (8 -> 9)'],
  9: ['D workflows: second account of the switch test'],
  10: ['D money-ui: randomized regression (about 25 varied transactions)'],
  11: ['D edge: empty History and Statistics, fresh profile starts empty'],
  12: ['D edge: 320px layout with long note and long custom category'],
  13: ['D edge: amount limits, reload during navigation'],
  14: ['D edge: keyboard-only and touch flows on Add'],
  15: ['D edge: second tab of the same origin, offline toggle'],
}
