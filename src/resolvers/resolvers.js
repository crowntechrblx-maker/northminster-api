const { pool } = require('../models/db');
const { GraphQLScalarType } = require('graphql');

const ObjectIDScalar = new GraphQLScalarType({ name:'ObjectID', serialize:v=>String(v), parseValue:v=>String(v), parseLiteral:ast=>ast.value });
const JSONScalar = new GraphQLScalarType({ name:'JSON', serialize:v=>v, parseValue:v=>v, parseLiteral:ast=>ast.value });

function toPlayer(r) { if(!r) return null; return {id:r.id,created:r.created,roblox:r.roblox,cash:parseFloat(r.cash),_raw:r}; }
function toVehicle(r) { if(!r) return null; return {id:r.id,created:r.created,numberPlate:r.number_plate,colour:r.colour,make:r.make,model:r.model,year:r.year,inventory:r.inventory,_playerId:r.player_id,_orgId:r.org_id,_propertyId:r.property_id}; }
function toProperty(r) { if(!r) return null; return {id:r.id,created:r.created,location:r.location,_playerId:r.player_id}; }
function toOrg(r) { if(!r) return null; return {id:r.id,created:r.created,name:r.name,groupId:r.group_id,discoverable:r.discoverable,type:r.type,tag:r.tag,customPermissions:r.custom_permissions,roleSet:r.role_set}; }
function toBankAccount(r) { if(!r) return null; return {id:r.id,balance:parseFloat(r.balance),_playerId:r.player_id,_orgId:r.organisation_id}; }
function toLicense(r) { if(!r) return null; return {id:r.id,created:r.created,suspendedUntil:r.suspended_until,hasTheory:r.has_theory,endorsements:r.endorsements||[],categories:r.categories||[],_playerId:r.player_id}; }
function toFlag(r) { if(!r) return null; return {id:r.id,created:r.created,expires:r.expires,reason:r.reason,active:r.active,_playerSubjectId:r.player_subject,_vehicleSubjectId:r.vehicle_subject,_issuerId:r.issuer_id}; }
function toMarker(r) { if(!r) return null; return {id:r.id,created:r.created,reason:r.reason,_vehicleSubjectId:r.vehicle_subject,_issuerId:r.issuer_id}; }
function toRecord(r) { if(!r) return null; return {id:r.id,created:r.created,type:r.type,charges:r.charges||[],_issuerId:r.issuer_id,_subjectId:r.subject_id}; }
function toTransaction(r) { if(!r) return null; return {id:r.id,created:r.created,type:r.type,amount:parseFloat(r.amount),_fromId:r.from_id,_toId:r.to_id}; }

async function getOrCreatePlayer(roblox) {
  const {rows} = await pool.query('SELECT * FROM players WHERE roblox=$1',[roblox]);
  if(rows[0]) return rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query('INSERT INTO players (roblox,cash) VALUES ($1,0) RETURNING *',[roblox]);
    const player = p.rows[0];
    await client.query('INSERT INTO bank_accounts (balance,player_id) VALUES (0,$1)',[player.id]);
    await client.query('INSERT INTO licenses (player_id,has_theory,categories,endorsements) VALUES ($1,false,\'[]\',\'[]\') ON CONFLICT DO NOTHING',[player.id]);
    await client.query('COMMIT');
    return player;
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

const resolvers = {
  ObjectID: ObjectIDScalar,
  JSON: JSONScalar,

  Query: {
    async player(_,{id,roblox}) {
      if(roblox) return toPlayer(await getOrCreatePlayer(roblox));
      if(id) { const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[id]); return toPlayer(rows[0]); }
      return null;
    },
    async players(_,{take=50,skip=0}) { const {rows}=await pool.query('SELECT * FROM players ORDER BY created DESC LIMIT $1 OFFSET $2',[take,skip]); return rows.map(toPlayer); },
    async vehicle(_,{id,numberPlate}) {
      let rows;
      if(id) ({rows}=await pool.query('SELECT * FROM vehicles WHERE id=$1',[id]));
      else if(numberPlate) ({rows}=await pool.query('SELECT * FROM vehicles WHERE number_plate=$1',[numberPlate]));
      return rows&&rows[0]?toVehicle(rows[0]):null;
    },
    async vehicles(_,{take,skip=0,player,org,property}) {
      const conds=[],params=[];
      if(player){params.push(player);conds.push('player_id=$'+params.length);}
      if(org){params.push(org);conds.push('org_id=$'+params.length);}
      if(property){params.push(property);conds.push('property_id=$'+params.length);}
      const where=conds.length?'WHERE '+conds.join(' AND '):'';
      params.push(take);const lim='LIMIT $'+params.length;
      params.push(skip);const off='OFFSET $'+params.length;
      const {rows}=await pool.query('SELECT * FROM vehicles '+where+' ORDER BY created DESC '+lim+' '+off,params);
      const cp=conds.length?params.slice(0,conds.length):[];
      const {rows:cr}=await pool.query('SELECT COUNT(*) FROM vehicles '+where,cp);
      const makesMap={};for(const r of rows){if(!makesMap[r.make])makesMap[r.make]=new Set();makesMap[r.make].add(r.model);}
      return {vehicles:rows.map(toVehicle),total:parseInt(cr[0].count),makes:Object.entries(makesMap).map(([name,models])=>({name,models:[...models]}))};
    },
    async property(_,{id}) { const {rows}=await pool.query('SELECT * FROM properties WHERE id=$1',[id]); return toProperty(rows[0]); },
    async properties(_,{player}) { const {rows}=player?await pool.query('SELECT * FROM properties WHERE player_id=$1',[player]):await pool.query('SELECT * FROM properties'); return rows.map(toProperty); },
    async organisation(_,{id,name,group}) {
      let rows;
      if(id)({rows}=await pool.query('SELECT * FROM organisations WHERE id=$1',[id]));
      else if(name)({rows}=await pool.query('SELECT * FROM organisations WHERE name=$1',[name]));
      else if(group)({rows}=await pool.query('SELECT * FROM organisations WHERE group_id=$1',[group]));
      return rows&&rows[0]?toOrg(rows[0]):null;
    },
    async organisations(_,{take=50,skip=0}) { const {rows}=await pool.query('SELECT * FROM organisations LIMIT $1 OFFSET $2',[take,skip]); return rows.map(toOrg); },
    async bankAccount(_,{id}) { const {rows}=await pool.query('SELECT * FROM bank_accounts WHERE id=$1',[id]); return toBankAccount(rows[0]); },
    async license(_,{id}) { const {rows}=await pool.query('SELECT * FROM licenses WHERE id=$1',[id]); return toLicense(rows[0]); },
    async flag(_,{id}) { const {rows}=await pool.query('SELECT * FROM flags WHERE id=$1',[id]); return toFlag(rows[0]); },
    async flags(_,{take,skip=0,issuer,playerSubject,vehicleSubject}) {
      const conds=[],params=[];
      if(issuer){params.push(issuer);conds.push('issuer_id=$'+params.length);}
      if(playerSubject){params.push(playerSubject);conds.push('player_subject=$'+params.length);}
      if(vehicleSubject){params.push(vehicleSubject);conds.push('vehicle_subject=$'+params.length);}
      const where=conds.length?'WHERE '+conds.join(' AND '):'';
      params.push(take);const lim='LIMIT $'+params.length;
      params.push(skip);const off='OFFSET $'+params.length;
      const {rows}=await pool.query('SELECT * FROM flags '+where+' ORDER BY created DESC '+lim+' '+off,params);
      const cp=conds.length?params.slice(0,conds.length):[];
      const {rows:cr}=await pool.query('SELECT COUNT(*) FROM flags '+where,cp);
      return {flags:rows.map(toFlag),total:parseInt(cr[0].count)};
    },
    async marker(_,{id}) { const {rows}=await pool.query('SELECT * FROM markers WHERE id=$1',[id]); return toMarker(rows[0]); },
    async markers(_,{take,skip=0,issuer,vehicleSubject}) {
      const conds=[],params=[];
      if(issuer){params.push(issuer);conds.push('issuer_id=$'+params.length);}
      if(vehicleSubject){params.push(vehicleSubject);conds.push('vehicle_subject=$'+params.length);}
      const where=conds.length?'WHERE '+conds.join(' AND '):'';
      params.push(take);const lim='LIMIT $'+params.length;
      params.push(skip);const off='OFFSET $'+params.length;
      const {rows}=await pool.query('SELECT * FROM markers '+where+' ORDER BY created DESC '+lim+' '+off,params);
      const cp=conds.length?params.slice(0,conds.length):[];
      const {rows:cr}=await pool.query('SELECT COUNT(*) FROM markers '+where,cp);
      return {markers:rows.map(toMarker),total:parseInt(cr[0].count)};
    },
    async record(_,{id}) { const {rows}=await pool.query('SELECT * FROM records WHERE id=$1',[id]); return toRecord(rows[0]); },
    async records(_,{subject,take=20,skip=0,type}) {
      const conds=[],params=[];
      if(subject){params.push(subject);conds.push('subject_id=$'+params.length);}
      if(type){params.push(type);conds.push('type=$'+params.length);}
      const where=conds.length?'WHERE '+conds.join(' AND '):'';
      params.push(take);const lim='LIMIT $'+params.length;
      params.push(skip);const off='OFFSET $'+params.length;
      const {rows}=await pool.query('SELECT * FROM records '+where+' ORDER BY created DESC '+lim+' '+off,params);
      const cp=conds.length?params.slice(0,conds.length):[];
      const {rows:cr}=await pool.query('SELECT COUNT(*) FROM records '+where,cp);
      // fpns = fixed penalty notices (type=FPN)
      const fpnParams=subject?[subject]:[];
      const fpnWhere=subject?'WHERE subject_id=$1 AND type=\'FPN\'':'WHERE type=\'FPN\'';
      const {rows:fpnRows}=await pool.query('SELECT * FROM records '+fpnWhere+' ORDER BY created DESC',fpnParams);
      return {records:rows.map(toRecord),total:parseInt(cr[0].count),fpns:fpnRows.map(toRecord)};
    },
    async transaction(_,{id}) { const {rows}=await pool.query('SELECT * FROM transactions WHERE id=$1',[id]); return toTransaction(rows[0]); },
  },

  Mutation: {
    async updatePlayer(_,{id,updatePlayerInput:i}) {
      const sets=[],params=[];
      if(i.cash!==undefined){params.push(i.cash);sets.push('cash=$'+params.length);}
      if(!sets.length) throw new Error('Nothing to update');
      params.push(id);
      const {rows}=await pool.query('UPDATE players SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);
      return toPlayer(rows[0]);
    },
    async createVehicle(_,{createVehicleInput:i}) {
      const {rows}=await pool.query('INSERT INTO vehicles (number_plate,colour,make,model,year,player_id,org_id,property_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[i.numberPlate,i.colour,i.make,i.model,i.year,i.player||null,i.org||null,i.property||null]);
      return toVehicle(rows[0]);
    },
    async updateVehicle(_,{id,updateVehicleInput:i}) {
      const sets=[],params=[];const map={numberPlate:'number_plate',colour:'colour',make:'make',model:'model',year:'year'};
      for(const[k,col] of Object.entries(map)){if(i[k]!==undefined){params.push(i[k]);sets.push(col+'=$'+params.length);}}
      if(!sets.length) throw new Error('Nothing to update');
      params.push(id);const {rows}=await pool.query('UPDATE vehicles SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);
      return toVehicle(rows[0]);
    },
    async deleteVehicle(_,{id}) { await pool.query('DELETE FROM vehicles WHERE id=$1',[id]); return true; },
    async createProperty(_,{createPropertyInput:i}) {
      const {rows}=await pool.query('INSERT INTO properties (location,player_id) VALUES ($1,$2) RETURNING *',[i.location,i.player]);
      return toProperty(rows[0]);
    },
    async deleteProperty(_,{id}) { await pool.query('DELETE FROM properties WHERE id=$1',[id]); return true; },
    async sellProperty(_,{id}) { await pool.query('DELETE FROM properties WHERE id=$1',[id]); return true; },
    async sellAndCreateProperty(_,{sellId,createPropertyInput:i}) {
      const client=await pool.connect();
      try{await client.query('BEGIN');await client.query('DELETE FROM properties WHERE id=$1',[sellId]);const {rows}=await client.query('INSERT INTO properties (location,player_id) VALUES ($1,$2) RETURNING *',[i.location,i.player]);await client.query('COMMIT');return toProperty(rows[0]);}
      catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    },
    async replaceProperty(_,{sellId,createPropertyInput:i}) {
      const client=await pool.connect();
      try{await client.query('BEGIN');await client.query('DELETE FROM properties WHERE id=$1',[sellId]);const {rows}=await client.query('INSERT INTO properties (location,player_id) VALUES ($1,$2) RETURNING *',[i.location,i.player]);await client.query('COMMIT');return toProperty(rows[0]);}
      catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    },
    async updateProperty(_,{updatePropertyInput:i}) {
      const {rows}=await pool.query('SELECT * FROM properties WHERE id=$1',[i.id]);
      return toProperty(rows[0]);
    },
    async createOrganisation(_,{createOrganisationInput:i}) {
      const client=await pool.connect();
      try{await client.query('BEGIN');const {rows}=await client.query('INSERT INTO organisations (name,group_id,discoverable,type,tag) VALUES ($1,$2,$3,$4,$5) RETURNING *',[i.name,i.groupId||null,i.discoverable??true,i.type||'civilian',i.tag||null]);const org=rows[0];await client.query('INSERT INTO bank_accounts (balance,organisation_id) VALUES (0,$1)',[org.id]);await client.query('COMMIT');return toOrg(org);}
      catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    },
    async updateOrganisation(_,{id,input}) {
      const allowed=['name','group_id','discoverable','type','tag','custom_permissions','role_set'];
      const sets=[],params=[];
      for(const[k,v] of Object.entries(input)){if(allowed.includes(k)){params.push(typeof v==='object'?JSON.stringify(v):v);sets.push(k+'=$'+params.length);}}
      if(!sets.length) throw new Error('Nothing to update');
      params.push(id);const {rows}=await pool.query('UPDATE organisations SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);
      return toOrg(rows[0]);
    },
    async createLicense(_,{createLicenseInput:i}) {
      const {rows}=await pool.query('INSERT INTO licenses (player_id,has_theory,categories,endorsements) VALUES ($1,$2,\'[]\',\'[]\') ON CONFLICT (player_id) DO UPDATE SET has_theory=$2 RETURNING *',[i.player,i.hasTheory||false]);
      return toLicense(rows[0]);
    },
    async updateLicense(_,{updateLicenseInput:i}) {
      const sets=[],params=[];
      if(i.suspendedUntil!==undefined){params.push(i.suspendedUntil);sets.push('suspended_until=$'+params.length);}
      if(i.hasTheory!==undefined){params.push(i.hasTheory);sets.push('has_theory=$'+params.length);}
      if(i.endorsements!==undefined){params.push(JSON.stringify(i.endorsements));sets.push('endorsements=$'+params.length);}
      if(!sets.length) throw new Error('Nothing to update');
      params.push(i.id);const {rows}=await pool.query('UPDATE licenses SET '+sets.join(',')+' WHERE id=$'+params.length+' RETURNING *',params);
      return toLicense(rows[0]);
    },
    async giveCategory(_,{id,type}) {
      const {rows:existing}=await pool.query('SELECT categories FROM licenses WHERE id=$1',[id]);
      if(!existing[0]) throw new Error('License not found');
      const cats=existing[0].categories||[];
      if(!cats.find(c=>c.type===type)) cats.push({type,issued:new Date().toISOString()});
      const {rows}=await pool.query('UPDATE licenses SET categories=$1 WHERE id=$2 RETURNING *',[JSON.stringify(cats),id]);
      return toLicense(rows[0]);
    },
    async removeCategory(_,{id,type}) {
      const {rows:existing}=await pool.query('SELECT categories FROM licenses WHERE id=$1',[id]);
      if(!existing[0]) throw new Error('License not found');
      const cats=(existing[0].categories||[]).filter(c=>c.type!==type);
      const {rows}=await pool.query('UPDATE licenses SET categories=$1 WHERE id=$2 RETURNING *',[JSON.stringify(cats),id]);
      return toLicense(rows[0]);
    },
    async createFlag(_,{createFlagInput:i}) {
      const {rows}=await pool.query('INSERT INTO flags (reason,expires,player_subject,vehicle_subject,issuer_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',[i.reason,i.expires||null,i.playerSubject||null,i.vehicleSubject||null,i.issuer||null]);
      return toFlag(rows[0]);
    },
    async removeFlag(_,{id}) { const {rows}=await pool.query('UPDATE flags SET active=false WHERE id=$1 RETURNING *',[id]); return toFlag(rows[0]); },
    async createMarker(_,{createMarkerInput:i}) {
      const {rows}=await pool.query('INSERT INTO markers (reason,vehicle_subject,issuer_id) VALUES ($1,$2,$3) RETURNING *',[i.reason,i.vehicleSubject||null,i.issuer||null]);
      return toMarker(rows[0]);
    },
    async removeMarker(_,{id}) { const {rows}=await pool.query('DELETE FROM markers WHERE id=$1 RETURNING *',[id]); return toMarker(rows[0]); },
    async createRecord(_,{createRecordInput:i}) {
      const {rows}=await pool.query('INSERT INTO records (type,issuer_id,subject_id,charges) VALUES ($1,$2,$3,$4) RETURNING *',[i.type,i.issuer||null,i.subject||null,JSON.stringify(i.charges||[])]);
      return toRecord(rows[0]);
    },
    async createTransaction(_,{createTransactionInput:i}) {
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const {rows}=await client.query('INSERT INTO transactions (type,amount,from_id,to_id) VALUES ($1,$2,$3,$4) RETURNING *',[i.type,i.amount,i.from||null,i.to||null]);
        if(i.from){await client.query('UPDATE bank_accounts SET balance=balance-$1 WHERE id=$2',[i.amount,i.from]);}
        if(i.to){await client.query('UPDATE bank_accounts SET balance=balance+$1 WHERE id=$2',[i.amount,i.to]);}
        await client.query('COMMIT');
        return toTransaction(rows[0]);
      }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    },
    async createCmdrLog(_,{createCmdrLogInput:i}) {
      const {rows}=await pool.query('INSERT INTO cmdr_logs (executor,command,args) VALUES ($1,$2,$3) RETURNING *',[i.executor||null,i.command||null,JSON.stringify(i.args||[])]);
      return {id:rows[0].id,created:rows[0].created,executor:rows[0].executor,command:rows[0].command,args:rows[0].args};
    },
    async heartbeat() { return true; },
  },

  Player: {
    async account(p) { const {rows}=await pool.query('SELECT * FROM bank_accounts WHERE player_id=$1',[p.id]); return toBankAccount(rows[0]); },
    async permissions(p) { const {rows}=await pool.query('SELECT * FROM permissions WHERE player_id=$1',[p.id]); return rows.map(r=>({name:r.name,source:r.source})); },
    async license(p) { const {rows}=await pool.query('SELECT * FROM licenses WHERE player_id=$1',[p.id]); return toLicense(rows[0]); },
    async properties(p) { const {rows}=await pool.query('SELECT * FROM properties WHERE player_id=$1',[p.id]); return rows.map(toProperty); },
    async vehicles(p) { const {rows}=await pool.query('SELECT * FROM vehicles WHERE player_id=$1',[p.id]); return rows.map(toVehicle); },
  },
  Vehicle: {
    async player(p) { if(!p._playerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]); return toPlayer(rows[0]); },
    async org(p) { if(!p._orgId) return null; const {rows}=await pool.query('SELECT * FROM organisations WHERE id=$1',[p._orgId]); return toOrg(rows[0]); },
    async property(p) { if(!p._propertyId) return null; const {rows}=await pool.query('SELECT * FROM properties WHERE id=$1',[p._propertyId]); return toProperty(rows[0]); },
  },
  Property: {
    async player(p) { if(!p._playerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]); return toPlayer(rows[0]); },
  },
  BankAccount: {
    async player(p) { if(!p._playerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]); return toPlayer(rows[0]); },
    async organisation(p) { if(!p._orgId) return null; const {rows}=await pool.query('SELECT * FROM organisations WHERE id=$1',[p._orgId]); return toOrg(rows[0]); },
  },
  Organisation: {
    async bankAccount(p) { const {rows}=await pool.query('SELECT * FROM bank_accounts WHERE organisation_id=$1',[p.id]); return toBankAccount(rows[0]); },
  },
  License: {
    async player(p) { if(!p._playerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerId]); return toPlayer(rows[0]); },
  },
  Flag: {
    async playerSubject(p) { if(!p._playerSubjectId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._playerSubjectId]); return toPlayer(rows[0]); },
    async vehicleSubject(p) { if(!p._vehicleSubjectId) return null; const {rows}=await pool.query('SELECT * FROM vehicles WHERE id=$1',[p._vehicleSubjectId]); return toVehicle(rows[0]); },
    async issuer(p) { if(!p._issuerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._issuerId]); return toPlayer(rows[0]); },
  },
  Marker: {
    async vehicleSubject(p) { if(!p._vehicleSubjectId) return null; const {rows}=await pool.query('SELECT * FROM vehicles WHERE id=$1',[p._vehicleSubjectId]); return toVehicle(rows[0]); },
    async issuer(p) { if(!p._issuerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._issuerId]); return toPlayer(rows[0]); },
  },
  Record: {
    async issuer(p) { if(!p._issuerId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._issuerId]); return toPlayer(rows[0]); },
    async subject(p) { if(!p._subjectId) return null; const {rows}=await pool.query('SELECT * FROM players WHERE id=$1',[p._subjectId]); return toPlayer(rows[0]); },
  },
  Transaction: {
    async from(p) { if(!p._fromId) return null; const {rows}=await pool.query('SELECT * FROM bank_accounts WHERE id=$1',[p._fromId]); return toBankAccount(rows[0]); },
    async to(p) { if(!p._toId) return null; const {rows}=await pool.query('SELECT * FROM bank_accounts WHERE id=$1',[p._toId]); return toBankAccount(rows[0]); },
  },
};

module.exports = resolvers;
