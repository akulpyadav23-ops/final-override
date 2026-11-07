const { norm, sha256 } = require('./security');

function getMemberShard(teamName, memberName) {
  const input = `FO|${norm(teamName)}|${norm(memberName)}`;
  return sha256(input).slice(0, 3).toUpperCase();
}

function computeTeamCode(teamName, memberNames) {
  // members sorted ascending by norm(name) (plain string comparison)
  const sortedNames = [...memberNames].sort((a, b) => {
    const na = norm(a);
    const nb = norm(b);
    return na.localeCompare(nb);
  });

  const shards = sortedNames.map(name => getMemberShard(teamName, name));
  return shards.join('-');
}

module.exports = {
  getMemberShard,
  computeTeamCode
};
