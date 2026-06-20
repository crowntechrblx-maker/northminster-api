const { pool } = require('../models/db');
const { GraphQLScalarType } = require('graphql');
const ObjectIDScalar = new GraphQLScalarType({ name: 'ObjectID', serialize: v => String(v), parseValue: v => String(v), parseLiteral: ast => ast.value });
const JSONScalar = new GraphQLScalarType({ name: 'JSON', serialize: v => v, parseValue: v => v, parseLiteral: ast => ast.value });
function toPlayer(r) { if (!r) return null; return { id: r.id, created: r.created, roblox: r.roblox, cash: parseFloat(r.cash) }; }
function toVehicle(r) { if (!r) return null; return { id: r.id, created: r.created, numberPlate: r.number_plate, colour: r.colour, make: r.make, model: r.model, year: r.year, inventory: r.inventory, _playerId: r.player_id, _orgId: r.org_id, _propertyId: r.property_id }; }
function toProperty(r) { if (!r) return null; return { id: r.id, created: r.created, location: r.location, _playerId: r.player_id }; }
function toOrg(r) { if (!r) return null; return { id: r.id, created: r.created, name: r.name, groupId: r.group_id, discoverable: r.discoverable, type: r.type, tag: r.tag, customPermissions: r.custom_permissions, roleSet: r.role_set }; }
function toBankAccount(r) { if (!r) return null; return { id: r.id, balance: parseFloat(r.balance), _playerId: r.player_id, _orgId: r.organisation_id }; }
async function getOrCreatePlayer(roblox) {
  const { rows } = await pool.query('SELECT * FROM players WHERE roblox = $1', [roblox]);
  if (rows[0]) return rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query('INSERT INTO players (roblox,cash) VALUES ($1,0) RETURNING *', [roblox]);
    const player = p.rows[0];
    await client.query('INSERT INTO bank_accounts (balance,player_id) VALUES (0,$1)', [player.id]);
    await client.query("INSERT INTO licenses (player_id,has_theory,categories) VALUES ($1,false,'[]')", [player.id]);
    await client.query('COMMIT'); return player;
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
module.exports = { pool, ObjectIDScalar, JSONScalar, toPlayer, toVehicle, toProperty, toOrg, toBankAccount, getOrCreatePlayer };