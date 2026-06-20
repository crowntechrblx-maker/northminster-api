const { pool, ObjectIDScalar, JSONScalar, toPlayer, toVehicle, toProperty, toOrg, toBankAccount, getOrCreatePlayer } = require('./helpers');
const resolvers = {
  ObjectID: ObjectIDScalar, JSON: JSONScalar,
  Query: {
    async player(_, { id, roblox }) { if (roblox) return toPlayer(await getOrCreatePlayer(roblox)); if (id) { const { rows } = await pool.query('SELECT * FROM players WHERE id=$1',[id]); return toPlayer(rows[0]); } return null; },
    async players(_, { take=50, skip=0 }) { const { rows } = await pool.query('SELECT * FROM players ORDER BY created DESC LIMIT $1 OFFSET $2',[take,skip]); return rows.map(toPlayer); },
    async vehicle(_, { id, numberPlate }) { let rows; if (id) ({rows}=await pool.query('SELECT * FROM vehicles WHERE id=$1',[id])); else if (numberPlate) ({rows}=await pool.query('SELECT * FROM vehicles WHERE number_plate=$1',[numberPlate])); return rows&&rows[0]?toVehicle(rows[0]):null; },
    async vehicles(_, { take, skip=0, player, org, property }) {
      const conds=[],params=[];
      if(player){params.push(player);conds.push('player_id=$'+params.length);}
      if(org){params.push(org);conds.push('org_id=$'+params.length);}
      if(property){params.push(property);conds.push('property_id=$'+params.length);}
      const where=conds.length?'WHERE '+conds.join(' AND '):'';
      params.push(take);const lim='LIMIT $'+params.length;params.push(skip);const off='OFFSET $'+params.length;
      const {rows}=await pool.query('SELECT * FROM vehicles '+where+' ORDER BY created DESC '+lim+' '+off,params);
      const cp=conds.length?params.slice(0,conds.length):[];
      const {rows:cr}=await pool.query('SELECT COUNT(*) FROM vehicles '+where,cp);
      const mm={};for(const r of rows){if(!mm[r.make])mm[r.make]=new Set();mm[r.make].add(r.model);}
      return{vehicles:rows.map(toVehicle),total:parseInt(cr[0].count),makes:Object.entries(mm).map(([name,m])=>({name,models:[...m]}))};
    },
    async property(_,{id}){const{rows}=await pool.query('SELECT * FROM properties WHERE id=$1',[id]);return toProperty(rows[0]);},
    async properties(_,{player}){const{rows}=player?await pool.query('SELECT * FROM properties WHERE player_id=$1',[player]):await pool.query('SELECT * FROM properties');return rows.map(toProperty);},
    async organisation(_,{id,name,group}){let rows;if(id)({rows}=await pool.query('SELECT * FROM organisations WHERE id=$1',[id]));else if(name)({rows}=await pool.query('SELECT * FROM organisations WHERE name=$1',[name]));else if(group)({rows}=await pool.query('SELECT * FROM organisations WHERE group_id=$1',[group]));return rows&&rows[0]?toOrg(rows[0]):null;},
    async organisations(_,{take=50,skip=0}){const{rows}=await pool.query('SELECT * FROM organisations ORDER BY created DESC LIMIT $1 OFFSET $2',[take,skip]);return rows.map(toOrg);},
    async bankAccount(_,{id}){const{rows}=await pool.query('SELECT * FROM bank_accounts WHERE id=$1',[id]);return toBankAccount(rows[0]);},
  },
  Mutation: {
    async updatePlayer(_,{id,updatePlayerInput:i}){const sets=[],params=[];if(i.cash!==undefined){params.push(i.cash);sets.push('cash=$'+params.length);}if(!sets.length)throw new Error('Nothing to update');params.push(id);const{rows}=await pool.query('UPDATE players SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);return toPlayer(rows[0]);},
    async createVehicle(_,{createVehicleInput:i}){const{rows}=await pool.query('INSERT INTO vehicles (number_plate,colour,make,model,year,player_id,org_id,property_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[i.numberPlate,i.colour,i.make,i.model,i.year,i.player||null,i.org||null,i.property||null]);return toVehicle(rows[0]);},
    async updateVehicle(_,{id,updateVehicleInput:i}){const sets=[],params=[],map={numberPlate:'number_plate',colour:'colour',make:'make',model:'model',year:'year'};for(const[k,col]of Object.entries(map)){if(i[k]!==undefined){params.push(i[k]);sets.push(col+'=$'+params.length);}}if(!sets.length)throw new Error('Nothing to update');params.push(id);const{rows}=await pool.query('UPDATE vehicles SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);return toVehicle(rows[0]);},
    async deleteVehicle(_,{id}){await pool.query('DELETE FROM vehicles WHERE id=$1',[id]);return true;},
    async createProperty(_,{createPropertyInput:i}){const{rows}=await pool.query('INSERT INTO properties (location,player_id) VALUES ($1,$2) RETURNING *',[i.location,i.player]);return toProperty(rows[0]);},
    async deleteProperty(_,{id}){await pool.query('DELETE FROM properties WHERE id=$1',[id]);return true;},
    async replaceProperty(_,{sellId,createPropertyInput:i}){const client=await pool.connect();try{await client.query('BEGIN');await client.query('DELETE FROM properties WHERE id=$1',[sellId]);const{rows}=await client.query('INSERT INTO properties (location,player_id) VALUES ($1,$2) RETURNING *',[i.location,i.player]);await client.query('COMMIT');return toProperty(rows[0]);}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
    async createOrganisation(_,{createOrganisationInput:i}){const client=await pool.connect();try{await client.query('BEGIN');const{rows}=await client.query("INSERT INTO organisations (name,group_id,discoverable,type,tag) VALUES ($1,$2,$3,$4,$5) RETURNING *",[i.name,i.groupId||null,i.discoverable??true,i.type||'civilian',i.tag||null]);await client.query('INSERT INTO bank_accounts (balance,organisation_id) VALUES (0,$1)',[rows[0].id]);await client.query('COMMIT');return toOrg(rows[0]);}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
    async updateOrganisation(_,{id,input}){const allowed=['name','group_id','discoverable','type','tag','custom_permissions','role_set'],sets=[],params=[];for(const[k,v]of Object.entries(input)){if(allowed.includes(k)){params.push(typeof v==='object'?JSON.stringify(v):v);sets.push(k+'=$'+params.length);}}if(!sets.length)throw new Error('Nothing to update');params.push(id);const{rows}=await pool.query('UPDATE organisations SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);return toOrg(rows[0]);},
    async heartbeat(){return true;},
  },
  Player: {
    async account(p){const{rows}=await pool.query('SELECT * FROM bank_accounts WHERE player_id=$1',[p.id]);return toBankAccount(rows[0]);},
    async permissions(p){const{rows}=await pool.query('SELECT * FROM permissions WHERE player_id=$1',[p.id]);return rows.map(r=>({name:r.name,source:r.source}));},
    async license(p){const{rows}=await pool.query('SELECT * FROM licenses WHERE player_id=$1',[p.id]);if(!rows[0])return null;const r=rows[0];return{id:r.id,created:r.created,suspendedUntil:r.suspended_until,hasTheory:r.has_theory,categories:r.categories||[]};},
    async properties(p){const{rows}=await pool.query('SELECT * FROM properties WHERE player_id=$1',[p.id]);return rows.map(toProperty);},
    async vehicles(p){const{rows}=await pool.query('SELECT * FROM vehicles WHERE player_id=$1',[p.id]);return rows.map(toVehicle);},
  },
  Vehicle: {
    async player(p){if(!p._playerId)return null;const{rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]);return toPlayer(rows[0]);},
    async org(p){if(!p._orgId)return null;const{rows}=await pool.query('SELECT * FROM organisations WHERE id=$1',[p._orgId]);return toOrg(rows[0]);},
    async property(p){if(!p._propertyId)return null;const{rows}=await pool.query('SELECT * FROM properties WHERE id=$1',[p._propertyId]);return toProperty(rows[0]);},
  },
  Property:{async player(p){if(!p._playerId)return null;const{rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]);return toPlayer(rows[0]);}},
  BankAccount:{
    async player(p){if(!p._playerId)return null;const{rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]);return toPlayer(rows[0]);},
    async organisation(p){if(!p._orgId)return null;const{rows}=await pool.query('SELECT * FROM organisations WHERE id=$1',[p._orgId]);return toOrg(rows[0]);},
  },
  Organisation:{async bankAccount(p){const{rows}=await pool.query('SELECT * FROM bank_accounts WHERE organisation_id=$1',[p.id]);return toBankAccount(rows[0]);}},
};
module.exports = resolvers;