/** All golden scenarios, one file per program, with the shared rules applied. */
const { withGoals, withLateJoinRules } = require('./shared');
const lep = require('./lep');
const bm100 = require('./bm100');
const mbw = require('./mbw');

module.exports = withGoals(withLateJoinRules([...lep, ...bm100, ...mbw]));
